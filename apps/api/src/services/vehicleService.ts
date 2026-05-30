import { randomUUID } from 'node:crypto';
import { Vehicle } from '../models/Vehicle.js';

function lean(doc: any) {
  const o = doc.toObject ? doc.toObject() : { ...doc };
  delete o._id;
  return o;
}

export async function listVehicles(filters: Record<string, unknown> = {}) {
  const q: Record<string, unknown> = {};
  if (filters.location_ids && Array.isArray(filters.location_ids) && filters.location_ids.length > 0) {
    q.location_id = { $in: filters.location_ids };
  } else if (filters.location_id) {
    q.location_id = filters.location_id;
  }
  if (typeof filters.is_active === 'boolean') q.is_active = filters.is_active;
  if (typeof filters.is_available === 'boolean') q.is_available = filters.is_available;
  if (filters.brand) q.brand = filters.brand;
  if (filters.model) q.model = filters.model;
  if (filters.ids) {
    const ids = String(filters.ids).split(',').map((s) => s.trim()).filter(Boolean);
    if (ids.length > 0) q.id = { $in: ids };
  }
  const docs = await Vehicle.find(q).sort({ brand: 1, model: 1 }).lean();
  return docs.map((d) => { const o = { ...d } as any; delete o._id; return o; });
}

export async function getVehicleById(id: string) {
  const doc = await Vehicle.findOne({ id }).lean();
  if (!doc) return null;
  const o = { ...doc } as any; delete o._id; return o;
}

export async function createVehicle(data: Record<string, unknown>) {
  const now = new Date().toISOString();
  const doc = new Vehicle({ ...data, id: String(data.id || randomUUID()), created_at: now, updated_at: now });
  await doc.save();
  return lean(doc);
}

export async function updateVehicle(id: string, data: Record<string, unknown>) {
  const doc = await Vehicle.findOneAndUpdate(
    { id },
    { $set: { ...data, updated_at: new Date().toISOString() } },
    { new: true },
  );
  return doc ? lean(doc) : null;
}

export async function deleteVehicle(id: string) {
  await Vehicle.deleteOne({ id });
}

export async function bulkInsertVehicles(records: Record<string, unknown>[]) {
  const now = new Date().toISOString();
  const docs = records.map((r) => ({ ...r, id: String(r.id || randomUUID()), created_at: now, updated_at: now }));
  return Vehicle.insertMany(docs, { ordered: false });
}
