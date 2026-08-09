import { randomUUID } from 'node:crypto';
import { StaffActivityEvent } from '../models/StaffActivityEvent.js';
import { StaffActivitySession } from '../models/StaffActivitySession.js';
import { TestDrive } from '../models/TestDrive.js';
import { Vehicle } from '../models/Vehicle.js';
import { runDbQuery } from './databaseService.js';

const STAFF_ONLY_ROLES = new Set(['sales', 'security']);

type ActivityInsightsScope = {
  role?: string | null;
  profileId?: string | null;
  locationId?: string | null;
  locationIds?: string[] | null;
  brandIds?: string[] | null;
  dealerLocationIds?: string[] | null;
  selectedLocationId?: string | null;
};

type ActivityInsightsCounts = {
  testDrives: {
    all: number;
    scheduled: number;
    confirmed: number;
    show: number;
    in_progress: number;
    completed: number;
    no_show: number;
    cancelled: number;
    rescheduled: number;
  };
  staffEvents: number;
  openTasks: number;
  activeSessions: number;
};

function getLocalDateYMD(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function resolveLocationIds(scope: ActivityInsightsScope) {
  const selectedLocationId = (scope.selectedLocationId || '').trim();
  const assignedLocationIds = Array.isArray(scope.locationIds)
    ? scope.locationIds.filter(Boolean)
    : (scope.locationId ? [scope.locationId] : []);

  if (scope.role === 'dealer_admin') {
    const dealerLocationIds = Array.isArray(scope.dealerLocationIds)
      ? scope.dealerLocationIds.filter(Boolean)
      : [];
    if (selectedLocationId && dealerLocationIds.includes(selectedLocationId)) {
      return [selectedLocationId];
    }
    return dealerLocationIds;
  }

  if (scope.role && ['gro', 'sales', 'sales_admin', 'branch_admin', 'security'].includes(scope.role)) {
    if (selectedLocationId && assignedLocationIds.includes(selectedLocationId)) {
      return [selectedLocationId];
    }
    return assignedLocationIds;
  }

if (selectedLocationId && assignedLocationIds.includes(selectedLocationId)) {
      return [selectedLocationId];
    }

  if (selectedLocationId) return [selectedLocationId];
  if (scope.locationId) return [scope.locationId];
  return [];
}

export async function getActivityInsightsCounts(scope: ActivityInsightsScope): Promise<ActivityInsightsCounts> {
  const localNow = new Date();
  const startOfDay = new Date(localNow);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  const todayYMD = getLocalDateYMD(localNow);
  const locationIds = resolveLocationIds(scope);
  const brandIds =  Array.isArray(scope.brandIds)
    ? scope.brandIds.filter(Boolean)
    : [];

  const testDriveQuery: Record<string, unknown> = {
    scheduled_date: todayYMD,
  };
  if (locationIds.length === 1) {
    testDriveQuery.location_id = locationIds[0];
  } else if (locationIds.length > 1) {
    testDriveQuery.location_id = { $in: locationIds };
  }

  if (brandIds.length > 0) {
    const brandScopedVehicles = await Vehicle.find(
      {
        brandId: { $in: brandIds },
        demo_for_vehicle_id: { $exists: true, $nin: [null, ''] },
      },
      { id: 1 },
    ).lean();
    const vehicleIdsFromBrandScope = brandScopedVehicles
      .map((v) => v.id)
      .filter((id): id is string => Boolean(id));
    if (vehicleIdsFromBrandScope.length === 0) {
      return {
        testDrives: {
          all: 0,
          scheduled: 0,
          confirmed: 0,
          show: 0,
          in_progress: 0,
          completed: 0,
          no_show: 0,
          cancelled: 0,
          rescheduled: 0,
        },
        staffEvents: 0,
        openTasks: 0,
        activeSessions: 0,
      };
    }
    testDriveQuery.vehicle_id = { $in: vehicleIdsFromBrandScope };
  }

  const [testDriveRows, staffEventsCount, openTasksResult, activeSessionsCount] = await Promise.all([
    TestDrive.find(testDriveQuery, { status: 1 }).lean(),
    scope.profileId
      ? StaffActivityEvent.countDocuments({
          profile_id: scope.profileId,
          happened_at: { $gte: startOfDay.toISOString(), $lt: endOfDay.toISOString() },
        })
      : Promise.resolve(0),
    runDbQuery({
      table: 'sales_tasks',
      action: 'select',
      select: 'id',
      filters: STAFF_ONLY_ROLES.has(scope.role ?? '') && scope.profileId
        ? [
            { field: 'status', op: 'eq', value: 'open' },
            { field: 'assigned_to_profile_id', op: 'eq', value: scope.profileId },
          ]
        : [{ field: 'status', op: 'eq', value: 'open' }],
      options: { count: 'exact', head: true },
      limit: 1,
    }),
    StaffActivitySession.countDocuments(
      locationIds.length > 0
        ? { is_online: true, location_id: locationIds.length === 1 ? locationIds[0] : { $in: locationIds } }
        : { is_online: true },
    ),
  ]);

  const testDrives = {
    all: 0,
    scheduled: 0,
    confirmed: 0,
    show: 0,
    in_progress: 0,
    completed: 0,
    no_show: 0,
    cancelled: 0,
    rescheduled: 0,
  };

  for (const row of testDriveRows as Array<{ status?: string }>) {
    const status = row.status;
    if (status && status in testDrives) {
      testDrives[status as keyof typeof testDrives] += 1;
      testDrives.all += 1;
    }
  }

  return {
    testDrives,
    staffEvents: staffEventsCount,
    openTasks: openTasksResult.count ?? 0,
    activeSessions: activeSessionsCount,
  };
}

function lean(doc: { toObject?: () => unknown } & object) {
  const raw = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  const o = (raw && typeof raw === 'object') ? { ...(raw as Record<string, unknown>) } : {};
  delete (o as { _id?: unknown })._id;
  return o;
}

// ── Events ────────────────────────────────────────────────────────────────────

export async function logEvent(data: Record<string, unknown>) {
  const now = new Date().toISOString();
  const doc = new StaffActivityEvent({
    ...data,
    id: String(data.id || randomUUID()),
    happened_at: String(data.happened_at || now),
    created_at: now,
  });
  await doc.save();
  return lean(doc);
}

export async function listEvents(filters: Record<string, unknown> = {}, limit = 200) {
  const q: Record<string, unknown> = {};
  if (filters.user_id) q.user_id = filters.user_id;
  if (filters.profile_id) q.profile_id = filters.profile_id;
  if (filters.location_ids && Array.isArray(filters.location_ids) && filters.location_ids.length > 0) {
    q.location_id = { $in: filters.location_ids };
  } else if (filters.location_id) {
    q.location_id = filters.location_id;
  }
  if (filters.session_id) q.session_id = filters.session_id;
  if (filters.event_type) q.event_type = filters.event_type;
  if (filters.role) q.role = filters.role;
  if (filters.event_types) {
    const types = String(filters.event_types).split(',').map((s) => s.trim()).filter(Boolean);
    if (types.length > 0) q.event_type = { $in: types };
  }
  const docs = await StaffActivityEvent.find(q).sort({ happened_at: -1 }).limit(limit).lean();
  return docs.map((d) => {
    const o = { ...d } as Record<string, unknown>;
    delete (o as { _id?: unknown })._id;
    return o;
  });
}

// ── Sessions ──────────────────────────────────────────────────────────────────

export async function startSession(data: Record<string, unknown>) {
  const now = new Date().toISOString();
  const doc = new StaffActivitySession({
    ...data,
    id: String(data.id || randomUUID()),
    login_at: now,
    last_seen_at: now,
    is_online: true,
    active_seconds: 0,
    idle_seconds: 0,
    created_at: now,
  });
  await doc.save();
  return lean(doc);
}

export async function touchSession(id: string, activeSeconds: number, idleSeconds: number) {
  await StaffActivitySession.updateOne(
    { id },
    { $set: { last_seen_at: new Date().toISOString(), is_online: true }, $inc: { active_seconds: activeSeconds, idle_seconds: idleSeconds } },
  );
}

export async function endSession(id: string) {
  await StaffActivitySession.updateOne(
    { id },
    { $set: { logout_at: new Date().toISOString(), is_online: false } },
  );
}

export async function getActiveSessionByUserId(userId: string) {
  const doc = await StaffActivitySession.findOne({ user_id: userId, is_online: true }).sort({ login_at: -1 }).lean();
  if (!doc) return null;
  const o = { ...doc } as Record<string, unknown>;
  delete (o as { _id?: unknown })._id;
  return o;
}

export async function listOnlineSessions(locationId?: string, locationIds?: string[]) {
  const q: Record<string, unknown> = { is_online: true };
  if (locationIds && locationIds.length > 0) {
    q.location_id = { $in: locationIds };
  } else if (locationId) {
    q.location_id = locationId;
  }
  const docs = await StaffActivitySession.find(q).sort({ last_seen_at: -1 }).lean();
  return docs.map((d) => {
    const o = { ...d } as Record<string, unknown>;
    delete (o as { _id?: unknown })._id;
    return o;
  });
}
