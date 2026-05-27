import { randomUUID } from 'node:crypto';
import { Customer } from '../models/Customer.js';

function escapeRegex(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function lean(doc: any) {
  const o = doc.toObject ? doc.toObject() : { ...doc };
  delete o._id;
  return o;
}

export async function findCustomerByPhone(phone: string) {
  const doc = await Customer.findOne({ phone }).lean();
  if (!doc) return null;
  const o = { ...doc } as any; delete o._id; return o;
}

export async function findCustomerByEmail(email: string) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return null;
  const exactInsensitive = new RegExp(`^${escapeRegex(normalized)}$`, 'i');
  const doc = await Customer.findOne({ email: exactInsensitive }).lean();
  if (!doc) return null;
  const o = { ...doc } as any;
  delete o._id;
  return o;
}

export async function getCustomerById(id: string) {
  const doc = await Customer.findOne({ id }).lean();
  if (!doc) return null;
  const o = { ...doc } as any; delete o._id; return o;
}

export async function listCustomers(filters: Record<string, unknown> = {}) {
  const q: Record<string, unknown> = {};
  if (filters.search) {
    q.$or = [
      { full_name: { $regex: String(filters.search), $options: 'i' } },
      { phone: { $regex: String(filters.search), $options: 'i' } },
    ];
  }
  const docs = await Customer.find(q).sort({ full_name: 1 }).limit(200).lean();
  return docs.map((d) => { const o = { ...d } as any; delete o._id; return o; });
}

export async function createCustomer(data: Record<string, unknown>) {
  const now = new Date().toISOString();
  const doc = new Customer({ ...data, id: String(data.id || randomUUID()), created_at: now, updated_at: now });
  await doc.save();
  return lean(doc);
}

export async function updateCustomer(id: string, data: Record<string, unknown>) {
  const doc = await Customer.findOneAndUpdate(
    { id },
    { $set: { ...data, updated_at: new Date().toISOString() } },
    { new: true },
  );
  return doc ? lean(doc) : null;
}

export async function incrementTestDriveCount(id: string) {
  await Customer.updateOne({ id }, { $inc: { total_test_drives: 1 } });
}
