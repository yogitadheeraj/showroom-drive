import { randomUUID } from 'node:crypto';
import { Communication } from '../models/Communication.js';

function lean(doc: any) {
  const o = doc.toObject ? doc.toObject() : { ...doc };
  delete o._id;
  return o;
}

export async function listCommunications(filters: Record<string, unknown> = {}, limit = 200) {
  const q: Record<string, unknown> = {};
  if (filters.customer_id) q.customer_id = filters.customer_id;
  if (filters.test_drive_id) q.test_drive_id = filters.test_drive_id;
  if (filters.status) q.status = filters.status;
  if (filters.type) q.type = filters.type;
  const docs = await Communication.find(q).sort({ created_at: -1 }).limit(limit).lean();
  return docs.map((d) => { const o = { ...d } as any; delete o._id; return o; });
}

export async function createCommunication(data: Record<string, unknown>) {
  const now = new Date().toISOString();
  const doc = new Communication({ ...data, id: String(data.id || randomUUID()), created_at: now });
  await doc.save();
  return lean(doc);
}

export async function updateCommunicationStatus(id: string, status: string, extra: Record<string, unknown> = {}) {
  const doc = await Communication.findOneAndUpdate(
    { id },
    { $set: { status, ...extra } },
    { new: true },
  );
  return doc ? lean(doc) : null;
}
