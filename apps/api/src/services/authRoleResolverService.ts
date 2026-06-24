import { UserRoleAssignmentNew } from '../models/UserRoleAssignmentNew.js';
import { RolePermissionNew } from '../models/RolePermissionNew.js';

export type ResolvedAuthRoleContext = {
  role: string | null;
  permissions: string[];
  hierarchyRoleCode: string | null;
};

function mapHierarchyRoleCodeToAppRole(roleCode: unknown): string {
  const normalized = String(roleCode || '').trim().toUpperCase();
  if (normalized === 'SUPER_ADMIN') return 'superadmin';
  if (normalized === 'ENTITY_ADMIN') return 'entity_admin';
  if (normalized === 'DEALER_ADMIN') return 'dealer_admin';
  if (normalized === 'SALES_ADMIN') return 'sales_admin';
  if (normalized === 'SALES_PERSON') return 'sales_person';
  if (normalized === 'GRO') return 'gro';
  if (normalized === 'SECURITY') return 'security';
  return '';
}

export async function resolveAuthRoleContext(userId: string): Promise<ResolvedAuthRoleContext> {
  const assignment = await UserRoleAssignmentNew.findOne({
    userId,
    isActive: true,
  })
    .sort({ isPrimary: -1, updatedAt: -1, createdAt: -1 })
    .populate('roleId')
    .lean();

  const hierarchyRoleCode = (assignment?.roleId as { code?: string } | null)?.code || null;
  const hierarchyRole = mapHierarchyRoleCodeToAppRole(hierarchyRoleCode);

  if (assignment && hierarchyRole) {
    const rolePermissions = await RolePermissionNew.find({ roleId: assignment.roleId })
      .populate('permissionId')
      .lean();

    return {
      role: hierarchyRole,
      permissions: rolePermissions
        .map((rp: any) => String(rp.permissionId?.code || '').trim())
        .filter(Boolean),
      hierarchyRoleCode,
    };
  }

  return {
    role: null,
    permissions: [],
    hierarchyRoleCode: null,
  };
}
