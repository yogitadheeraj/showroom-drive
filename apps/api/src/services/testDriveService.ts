import { randomUUID } from 'node:crypto';
import { TestDrive, TestDriveStatus } from '../models/TestDrive.js';
import { Customer } from '../models/Customer.js';
import { Vehicle } from '../models/Vehicle.js';
import { Location } from '../models/Location.js';
import { Profile } from '../models/Profile.js';

function toPlain(doc: any) {
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  delete obj._id;
  return obj;
}

export async function listTestDrives(filters: Record<string, unknown> = {}) {
  const query: Record<string, unknown> = {};
  if (filters.location_id) query.location_id = filters.location_id;
  if (filters.location_ids && Array.isArray(filters.location_ids) && filters.location_ids.length > 0) {
    query.location_id = { $in: filters.location_ids };
  }
  if (filters.customer_id) query.customer_id = filters.customer_id;
  if (filters.vehicle_id) query.vehicle_id = filters.vehicle_id;
  if (filters.sales_person_id) query.assigned_sales_person_id = filters.sales_person_id;
  if (filters.assigned_sales_person_id) query.assigned_sales_person_id = filters.assigned_sales_person_id;
  if (filters.assigned_gro_id) query.assigned_gro_id = filters.assigned_gro_id;
  if (filters.status) query.status = filters.status;
  if (filters.scheduled_date) query.scheduled_date = filters.scheduled_date;
  if (filters.statuses && Array.isArray(filters.statuses)) {
    query.status = { $in: filters.statuses };
  }
  const limit = typeof filters.limit === 'number' && filters.limit > 0 ? filters.limit : undefined;
  const includeRelated = filters.include_related !== false;

  const findQuery = TestDrive.find(query)
    .sort({ scheduled_date: -1, scheduled_time: 1 })
    .lean();

  if (limit) {
    findQuery.limit(limit);
  }

  const docs = await findQuery;
  const rows = docs.map((d) => {
    const o = { ...d } as any;
    delete o._id;
    return o;
  });

  if (!includeRelated || rows.length === 0) {
    return rows;
  }

  const customerIds = Array.from(new Set(rows.map((row: any) => row.customer_id).filter(Boolean)));
  const vehicleIds = Array.from(new Set(rows.map((row: any) => row.vehicle_id).filter(Boolean)));
  const locationIds = Array.from(new Set(rows.map((row: any) => row.location_id).filter(Boolean)));
  const assignedProfileIds = Array.from(
    new Set(
      rows
        .flatMap((row: any) => [row.assigned_sales_person_id, row.assigned_gro_id])
        .filter(Boolean)
    )
  );

  const [customers, vehicles, locations, profiles] = await Promise.all([
    customerIds.length > 0
      ? Customer.find({ id: { $in: customerIds } }, { id: 1, full_name: 1, phone: 1, email: 1 }).lean()
      : Promise.resolve([] as any[]),
    vehicleIds.length > 0
      ? Vehicle.find({ id: { $in: vehicleIds } }, { id: 1, brand: 1, model_name: 1, variant: 1 }).lean()
      : Promise.resolve([] as any[]),
    locationIds.length > 0
      ? Location.find({ id: { $in: locationIds } }, { id: 1, name: 1, city: 1 }).lean()
      : Promise.resolve([] as any[]),
    assignedProfileIds.length > 0
      ? Profile.find({ id: { $in: assignedProfileIds } }, { id: 1, full_name: 1, phone: 1 }).lean()
      : Promise.resolve([] as any[]),
  ]);

  const customerMap = new Map((customers || []).map((c: any) => [c.id, c]));
  const vehicleMap = new Map((vehicles || []).map((v: any) => [v.id, v]));
  const locationMap = new Map((locations || []).map((l: any) => [l.id, l]));
  const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

  return rows.map((row: any) => {
    const customer = customerMap.get(row.customer_id);
    const vehicle = vehicleMap.get(row.vehicle_id);
    const location = locationMap.get(row.location_id);
    const assignedSales = row.assigned_sales_person_id ? profileMap.get(row.assigned_sales_person_id) : null;
    const assignedGro = row.assigned_gro_id ? profileMap.get(row.assigned_gro_id) : null;

    return {
      ...row,
      customers: customer
        ? {
            id: customer.id,
            full_name: customer.full_name,
            phone: customer.phone,
            email: customer.email,
          }
        : null,
      vehicles: vehicle
        ? {
            id: vehicle.id,
            brand: vehicle.brand,
            model: vehicle.model_name,
            model_name: vehicle.model_name,
            variant: vehicle.variant,
          }
        : null,
      locations: location
        ? {
            id: location.id,
            name: location.name,
            city: location.city,
          }
        : null,
      assigned_sales_person: assignedSales
        ? {
            id: assignedSales.id,
            full_name: assignedSales.full_name,
            phone: assignedSales.phone,
          }
        : null,
      assigned_gro: assignedGro
        ? {
            id: assignedGro.id,
            full_name: assignedGro.full_name,
            phone: assignedGro.phone,
          }
        : null,
    };
  });
}

export async function getTestDriveById(id: string) {
  const doc = await TestDrive.findOne({ id }).lean();
  if (!doc) return null;
  const o = { ...doc } as any; delete o._id; return o;
}

export async function createTestDrive(data: Record<string, unknown>) {
  const now = new Date().toISOString();
  const assignedGroId = (data.assigned_gro_id as string | null | undefined) ?? (data.gro_id as string | null | undefined) ?? null;
  const cancelledReason = (data.cancelled_reason as string | null | undefined) ?? (data.cancellation_reason as string | null | undefined) ?? null;

  const doc = new TestDrive({
    ...data,
    id: typeof data.id === 'string' && data.id ? data.id : randomUUID(),
    source: typeof data.source === 'string' && data.source ? data.source : 'online',
    assigned_gro_id: assignedGroId,
    gro_id: assignedGroId,
    cancelled_reason: cancelledReason,
    cancellation_reason: cancelledReason,
    slot_duration_minutes:
      typeof data.slot_duration_minutes === 'number' && data.slot_duration_minutes > 0
        ? data.slot_duration_minutes
        : 30,
    status: (data.status as TestDriveStatus) || 'scheduled',
    feedback_submitted: data.feedback_submitted ?? false,
    created_at: now,
    updated_at: now,
  });
  await doc.save();
  return toPlain(doc);
}

export async function updateTestDrive(id: string, data: Record<string, unknown>) {
  const assignedGroId = (data.assigned_gro_id as string | null | undefined) ?? (data.gro_id as string | null | undefined);
  const cancelledReason = (data.cancelled_reason as string | null | undefined) ?? (data.cancellation_reason as string | null | undefined);
  const patch: Record<string, unknown> = {
    ...data,
    updated_at: new Date().toISOString(),
  };

  if (assignedGroId !== undefined) {
    patch.assigned_gro_id = assignedGroId;
    patch.gro_id = assignedGroId;
  }
  if (cancelledReason !== undefined) {
    patch.cancelled_reason = cancelledReason;
    patch.cancellation_reason = cancelledReason;
  }

  const doc = await TestDrive.findOneAndUpdate(
    { id },
    { $set: patch },
    { new: true },
  );
  if (!doc) return null;
  return toPlain(doc);
}

export async function deleteTestDrive(id: string) {
  await TestDrive.deleteOne({ id });
}

export async function countTestDrives(filters: Record<string, unknown> = {}) {
  const query: Record<string, unknown> = {};
  if (filters.location_id) query.location_id = filters.location_id;
  if (filters.location_ids && Array.isArray(filters.location_ids) && filters.location_ids.length > 0) {
    query.location_id = { $in: filters.location_ids };
  }
  if (filters.status) query.status = filters.status;
  if (filters.statuses && Array.isArray(filters.statuses)) {
    query.status = { $in: filters.statuses };
  }
  if (filters.scheduled_date) query.scheduled_date = filters.scheduled_date;
  return TestDrive.countDocuments(query);
}
