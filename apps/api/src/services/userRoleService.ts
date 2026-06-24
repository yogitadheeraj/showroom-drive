import { randomUUID } from 'node:crypto';
import { UserRole, AppRole } from '../models/UserRole.js';
import { resolveAuthRoleContext } from './authRoleResolverService.js';
import { normalizeAppRole } from './roleService.js';

function lean(doc: any) {
  const o = doc.toObject ? doc.toObject() : { ...doc };
  delete o._id;
  return o;
}

export async function getRoleByUserId(userId: string) {
  const doc = await UserRole.findOne({ user_id: userId }).lean();
  if (doc) {
    const o = { ...doc } as any;
    delete o._id;
    o.role = normalizeAppRole(o.role);
    return o;
  }

  const resolved = await resolveAuthRoleContext(userId);
  if (!resolved.role) return null;
  return {
    id: null,
    user_id: userId,
    role: resolved.role,
    entity_id: null,
    brand_id: null,
    location_id: null,
    hierarchy_level: null,
  };
}

export async function listUserRoles(filters: Record<string, unknown> = {}) {
  const q: Record<string, unknown> = {};
  if (filters.role) q.role = filters.role;
  const docs = await UserRole.find(q).lean();
  return docs.map((d) => { const o = { ...d } as any; delete o._id; return o; });
}

export async function upsertUserRole(userId: string, role: AppRole) {
  const normalizedRole = normalizeAppRole(role);
  if (!normalizedRole) {
    throw new Error('Invalid role');
  }

  const doc = await UserRole.findOneAndUpdate(
    { user_id: userId },
    { $set: { user_id: userId, role: normalizedRole }, $setOnInsert: { id: randomUUID() } },
    { upsert: true, new: true },
  );
  return lean(doc);
}

export async function deleteUserRole(userId: string) {
  await UserRole.deleteOne({ user_id: userId });
}
