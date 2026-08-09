import { randomUUID } from 'node:crypto';
import { UserRole, AppRole } from '../models/UserRole.js';

function lean(doc: any) {
  const o = doc.toObject ? doc.toObject() : { ...doc };
  delete o._id;
  return o;
}

export async function getRoleByUserId(userId: string) {
  const doc = await UserRole.findOne({ user_id: userId }).lean();
  if (!doc) return null;
  const o = { ...doc } as any; delete o._id; return o;
}

export async function listUserRoles(filters: Record<string, unknown> = {}) {
  const q: Record<string, unknown> = {};
  if (filters.role) q.role = filters.role;
  if (filters.user_ids) {
    const rawIds = Array.isArray(filters.user_ids)
      ? filters.user_ids
      : String(filters.user_ids).split(',');
    const userIds = rawIds.map((id) => String(id).trim()).filter(Boolean);
    if (userIds.length > 0) q.user_id = { $in: userIds };
  }
  const docs = await UserRole.find(q).lean();
  return docs.map((d) => { const o = { ...d } as any; delete o._id; return o; });
}

export async function upsertUserRole(userId: string, role: AppRole) {
  const doc = await UserRole.findOneAndUpdate(
    { user_id: userId },
    { $set: { user_id: userId, role }, $setOnInsert: { id: randomUUID() } },
    { upsert: true, new: true },
  );
  return lean(doc);
}

export async function deleteUserRole(userId: string) {
  await UserRole.deleteOne({ user_id: userId });
}
