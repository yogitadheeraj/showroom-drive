import { randomUUID } from 'node:crypto';
import { ReportDispatchConfig, type ReportDispatchFormat, type ReportDispatchRecipientRole, type ReportDispatchType } from '../models/ReportDispatchConfig.js';
import { UserRole } from '../models/UserRole.js';
import { Profile } from '../models/Profile.js';
import { Location } from '../models/Location.js';

type AppUserRole = 'superadmin' | 'super_admin' | 'dealer_admin' | 'sales_admin' | 'branch_admin' | string;

function normalizeFormats(value: unknown): ReportDispatchFormat[] {
  const src = Array.isArray(value) ? value : [];
  const allowed: ReportDispatchFormat[] = ['excel', 'pdf'];
  const out = src
    .map((v) => String(v || '').trim().toLowerCase())
    .filter((v): v is ReportDispatchFormat => allowed.includes(v as ReportDispatchFormat));
  return out.length ? Array.from(new Set(out)) : ['excel'];
}

function normalizeRecipientRoles(value: unknown): ReportDispatchRecipientRole[] {
  const src = Array.isArray(value) ? value : [];
  const allowed: ReportDispatchRecipientRole[] = ['dealer_admin', 'sales'];
  const out = src
    .map((v) => String(v || '').trim().toLowerCase())
    .filter((v): v is ReportDispatchRecipientRole => allowed.includes(v as ReportDispatchRecipientRole));
  return out.length ? Array.from(new Set(out)) : ['dealer_admin'];
}

function normalizeReportType(value: unknown): ReportDispatchType {
  const v = String(value || 'test_drive_daily').trim();
  return v === 'activity_daily' ? 'activity_daily' : 'test_drive_daily';
}

function normalizeSendTimeUtc(value: unknown): string {
  const v = String(value || '18:00').trim();
  if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(v)) {
    throw new Error('send_time_utc must be in HH:mm (UTC) format');
  }
  return v;
}

async function getActorContext(userId: string) {
  const [roleDoc, profileDoc] = await Promise.all([
    UserRole.findOne({ user_id: userId }, { role: 1 }).lean(),
    Profile.findOne({ user_id: userId }, { location_id: 1 }).lean(),
  ]);

  return {
    role: (roleDoc?.role || '') as AppUserRole,
    location_id: (profileDoc as any)?.location_id ? String((profileDoc as any).location_id) : null,
  };
}

async function ensureCanManage(userId: string, locationId: string) {
  const actor = await getActorContext(userId);

  if (actor.role === 'superadmin' || actor.role === 'super_admin') {
    return;
  }

  if (actor.role === 'dealer_admin') {
    const actorLoc = actor.location_id ? await Location.findOne({ id: actor.location_id }, { dealer_id: 1 }).lean() : null;
    const targetLoc = await Location.findOne({ id: locationId }, { dealer_id: 1 }).lean();
    if (!actorLoc?.dealer_id || !targetLoc?.dealer_id || actorLoc.dealer_id !== targetLoc.dealer_id) {
      throw new Error('Forbidden: Dealer Admin can manage only own dealer locations');
    }
    return;
  }

  if (actor.role === 'sales_admin' || actor.role === 'branch_admin') {
    if (actor.location_id !== locationId) {
      throw new Error('Forbidden: Branch Admin can manage only own location');
    }
    return;
  }

  throw new Error('Forbidden: insufficient permissions');
}

export async function listReportDispatchConfigs(filters: { location_id?: string } = {}) {
  const query: Record<string, unknown> = {};
  if (filters.location_id) query.location_id = filters.location_id;

  const docs = await ReportDispatchConfig.find(query).sort({ updated_at: -1 }).lean();
  return docs.map((doc: any) => {
    const out = { ...doc };
    delete out._id;
    return out;
  });
}

export async function getReportDispatchConfig(locationId: string, reportType: ReportDispatchType) {
  const doc = await ReportDispatchConfig.findOne({ location_id: locationId, report_type: reportType }).lean();
  if (!doc) return null;
  const out = { ...doc } as any;
  delete out._id;
  return out;
}

export async function upsertReportDispatchConfig(userId: string, data: Record<string, unknown>) {
  const locationId = String(data.location_id || '').trim();
  if (!locationId) throw new Error('location_id is required');

  await ensureCanManage(userId, locationId);

  const reportType = normalizeReportType(data.report_type);
  const sendTimeUtc = normalizeSendTimeUtc(data.send_time_utc);
  const formats = normalizeFormats(data.formats);
  const recipientRoles = normalizeRecipientRoles(data.recipient_roles);
  const enabled = typeof data.enabled === 'boolean' ? data.enabled : true;

  const now = new Date().toISOString();

  const doc = await ReportDispatchConfig.findOneAndUpdate(
    { location_id: locationId, report_type: reportType },
    {
      $setOnInsert: {
        id: randomUUID(),
        created_by_user_id: userId,
        created_at: now,
      },
      $set: {
        enabled,
        send_time_utc: sendTimeUtc,
        recipient_roles: recipientRoles,
        formats,
        updated_by_user_id: userId,
        updated_at: now,
      },
    },
    { upsert: true, new: true },
  ).lean();

  const out = { ...doc } as any;
  delete out._id;
  return out;
}

export async function deleteReportDispatchConfig(userId: string, locationId: string, reportType: ReportDispatchType) {
  await ensureCanManage(userId, locationId);

  const doc = await ReportDispatchConfig.findOneAndDelete({
    location_id: locationId,
    report_type: reportType,
  }).lean();

  if (!doc) return null;
  const out = { ...doc } as any;
  delete out._id;
  return out;
}
