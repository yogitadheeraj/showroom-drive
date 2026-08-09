import { Request, Response } from 'express';
import * as userRoleService from '../services/userRoleService.js';
import * as profileService from '../services/profileService.js';
import { sendMail } from '../services/mailService.js';
import type { AppRole } from '../models/UserRole.js';
import { applyLocationScope } from '../middleware/locationFilter.js';

const ROLE_LABELS: Record<string, string> = {
  superadmin: 'Super Admin',
  dealer_admin: 'Dealer Admin',
  brand_admin: 'Brand Admin',
  sales_admin: 'Sales Admin',
  gro: 'GRO',
  sales: 'Sales Person',
  security: 'Security',
};

export async function getRoleController(req: Request, res: Response) {
  const { userId } = req.params;
  const data = await userRoleService.getRoleByUserId(userId);
  if (!data) return res.status(404).json({ error: 'Role not found' });
  res.json({ data });
}

export async function listRolesController(req: Request, res: Response) {
  const role = req.authUser?.role;
  const isSuperAdmin = role === 'superadmin' || role === 'super_admin';
  const filters = { ...(req.query as Record<string, unknown>) };

  if (!isSuperAdmin) {
    const profileFilters: Record<string, unknown> = {};
    applyLocationScope(req, profileFilters);

    if (Array.isArray(req.authUser?.brand_ids) && req.authUser.brand_ids.length > 0) {
      profileFilters.brand_ids = req.authUser.brand_ids;
    }

    const scopedProfiles = await profileService.listProfiles(profileFilters);
    const scopedUserIds = scopedProfiles
      .map((profile: any) => profile.user_id)
      .filter(Boolean);

    if (scopedUserIds.length === 0) {
      res.json({ data: [] });
      return;
    }

    if (filters.user_ids) {
      const requestedUserIds = String(filters.user_ids)
        .split(',')
        .map((userId) => userId.trim())
        .filter(Boolean);
      const allowed = new Set(scopedUserIds.map(String));
      filters.user_ids = requestedUserIds.filter((userId) => allowed.has(userId));
      if ((filters.user_ids as string[]).length === 0) {
        res.json({ data: [] });
        return;
      }
    } else {
      filters.user_ids = scopedUserIds;
    }
  }

  const data = await userRoleService.listUserRoles(filters);
  res.json({ data });
}

export async function upsertRoleController(req: Request, res: Response) {
  const { user_id, role, notify, userEmail, userName, previousRole } =
    req.body as { user_id: string; role: AppRole; notify?: boolean; userEmail?: string; userName?: string; previousRole?: string };
  if (!user_id || !role) return res.status(400).json({ error: 'user_id and role are required' });
  const data = await userRoleService.upsertUserRole(user_id, role);

  // Send role-assignment email if requested and role changed
  if (notify && userEmail && role !== previousRole) {
    const newLabel = ROLE_LABELS[role] ?? role;
    const prevLabel = previousRole ? (ROLE_LABELS[previousRole] ?? previousRole) : null;
    const isPromotion = prevLabel !== null;
    const subject = isPromotion ? `Your role has been updated — ${newLabel}` : `Welcome! You've been assigned the ${newLabel} role`;
    const html = `
      <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:8px">
        <h2 style="color:#1a1a1a;margin-bottom:8px">${isPromotion ? '🎉 Role Updated' : '👋 Welcome Aboard'}</h2>
        <p style="color:#374151">Hello <strong>${userName ?? 'there'}</strong>,</p>
        ${isPromotion
          ? `<p style="color:#374151">Your role has been updated from <strong>${prevLabel}</strong> to <strong>${newLabel}</strong>.</p>`
          : `<p style="color:#374151">You have been assigned the <strong>${newLabel}</strong> role.</p>`}
        <p style="color:#374151">Please log in to your account to access your updated permissions.</p>
        <p style="color:#6b7280;font-size:13px;margin-top:24px">If you have any questions, please contact your administrator.</p>
      </div>`;
    sendMail({ to: userEmail, subject, html }).catch(() => null);
  }

  res.json({ data });
}

export async function deleteRoleController(req: Request, res: Response) {
  await userRoleService.deleteUserRole(req.params.userId);
  res.status(204).end();
}
