import { Request, Response } from 'express';
import * as userRoleService from '../services/userRoleService.js';
import type { AppRole } from '../models/UserRole.js';

export async function getRoleController(req: Request, res: Response) {
  const { userId } = req.params;
  const data = await userRoleService.getRoleByUserId(userId);
  if (!data) return res.status(404).json({ error: 'Role not found' });
  res.json({ data });
}

export async function listRolesController(req: Request, res: Response) {
  const data = await userRoleService.listUserRoles(req.query as Record<string, unknown>);
  res.json({ data });
}

export async function upsertRoleController(req: Request, res: Response) {
  const { user_id, role } = req.body as { user_id: string; role: AppRole };
  if (!user_id || !role) return res.status(400).json({ error: 'user_id and role are required' });
  const data = await userRoleService.upsertUserRole(user_id, role);
  res.json({ data });
}

export async function deleteRoleController(req: Request, res: Response) {
  await userRoleService.deleteUserRole(req.params.userId);
  res.status(204).end();
}
