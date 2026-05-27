import { randomUUID } from 'node:crypto';
import { TestDrive, TestDriveStatus } from '../models/TestDrive.js';

function toPlain(doc: any) {
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  delete obj._id;
  return obj;
}

export async function listTestDrives(filters: Record<string, unknown> = {}) {
  const query: Record<string, unknown> = {};
  if (filters.location_id) query.location_id = filters.location_id;
  if (filters.customer_id) query.customer_id = filters.customer_id;
  if (filters.vehicle_id) query.vehicle_id = filters.vehicle_id;
  if (filters.sales_person_id) query.sales_person_id = filters.sales_person_id;
  if (filters.status) query.status = filters.status;
  if (filters.scheduled_date) query.scheduled_date = filters.scheduled_date;
  if (filters.statuses && Array.isArray(filters.statuses)) {
    query.status = { $in: filters.statuses };
  }
  const docs = await TestDrive.find(query)
    .sort({ scheduled_date: -1, scheduled_time: 1 })
    .lean();
  return docs.map((d) => { const o = { ...d } as any; delete o._id; return o; });
}

export async function getTestDriveById(id: string) {
  const doc = await TestDrive.findOne({ id }).lean();
  if (!doc) return null;
  const o = { ...doc } as any; delete o._id; return o;
}

export async function createTestDrive(data: Record<string, unknown>) {
  const now = new Date().toISOString();
  const doc = new TestDrive({
    ...data,
    id: typeof data.id === 'string' && data.id ? data.id : randomUUID(),
    status: (data.status as TestDriveStatus) || 'scheduled',
    feedback_submitted: data.feedback_submitted ?? false,
    created_at: now,
    updated_at: now,
  });
  await doc.save();
  return toPlain(doc);
}

export async function updateTestDrive(id: string, data: Record<string, unknown>) {
  const doc = await TestDrive.findOneAndUpdate(
    { id },
    { $set: { ...data, updated_at: new Date().toISOString() } },
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
  if (filters.status) query.status = filters.status;
  if (filters.statuses && Array.isArray(filters.statuses)) {
    query.status = { $in: filters.statuses };
  }
  if (filters.scheduled_date) query.scheduled_date = filters.scheduled_date;
  return TestDrive.countDocuments(query);
}
