import { Request, Response, NextFunction } from 'express';
import { verifyIdToken } from '../config/firebaseAdmin.js';
import { UserRoleAssignmentNew } from '../models/UserRoleAssignmentNew.js';
import { RoleNew } from '../models/RoleNew.js';
import { RolePermissionNew } from '../models/RolePermissionNew.js';
import { resolveAuthRoleContext } from '../services/authRoleResolverService.js';

export interface AuthContext {
  user: {
    id: string;
    name?: string;
    email?: string;
  };
  role: {
    code: string;
    name: string;
    roleLevel: string;
    permissions: string[];
  };
  scope: {
    orgId: string | null;
    businessUnitId?: string | null;
    brandId?: string | null;
    salesOfficeId?: string | null;
    plantId?: string | null;
    locationId?: string | null;
  };
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

/**
 * Middleware to fetch and attach auth context to request
 * Expects userId in headers or decoded JWT
 */
export async function attachAuthContext(req: Request, res: Response, next: NextFunction) {
  try {
    const headerUserId = req.headers['x-user-id'];
    let userId = typeof (req as any).user?.id === 'string' ? (req as any).user.id : undefined;

    if (!userId && typeof headerUserId === 'string' && headerUserId.trim()) {
      userId = headerUserId.trim();
    }

    if (!userId) {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice('Bearer '.length).trim();
        if (token) {
          try {
            const decoded = await verifyIdToken(token);
            userId = decoded.uid;
          } catch {
            req.auth = undefined;
            return next();
          }
        }
      }
    }
    
    if (!userId) {
      req.auth = undefined;
      return next();
    }

    const resolvedRole = await resolveAuthRoleContext(String(userId));

    if (!resolvedRole.role) {
      req.auth = undefined;
      return next();
    }

    const effectiveRoleCode = resolvedRole.hierarchyRoleCode || mapAppRoleToHierarchyRoleCode(resolvedRole.role);

    if (!effectiveRoleCode) {
      req.auth = undefined;
      return next();
    }

    const role = await RoleNew.findOne({ code: effectiveRoleCode }).lean();
    if (!role) {
      req.auth = undefined;
      return next();
    }

    // Fetch primary hierarchy assignment for scope, if present.
    const assignment = await UserRoleAssignmentNew.findOne({
      userId: String(userId),
      isActive: true,
    })
      .sort({ isPrimary: -1, updatedAt: -1, createdAt: -1 })
      .populate('roleId')
      .lean();

    req.auth = {
      user: {
        id: String(userId),
      },
      role: {
        code: role.code,
        name: role.name,
        roleLevel: role.roleLevel,
        permissions: resolvedRole.permissions,
      },
      scope: {
        orgId: assignment?.orgId?.toString() || null,
        businessUnitId: assignment?.businessUnitId?.toString(),
        brandId: assignment?.brandId?.toString(),
        salesOfficeId: assignment?.salesOfficeId?.toString(),
        plantId: assignment?.plantId?.toString(),
        locationId: assignment?.locationId?.toString(),
      },
    };

    next();
  } catch (error) {
    console.error('Auth context attachment error:', error);
    req.auth = undefined;
    next();
  }
}

function mapAppRoleToHierarchyRoleCode(role: unknown): string {
  const normalized = String(role || '').trim().toLowerCase();
  if (normalized === 'superadmin' || normalized === 'super_admin') return 'SUPER_ADMIN';
  if (normalized === 'entity_admin') return 'DEALER_ADMIN';
  if (normalized === 'dealer_admin') return 'DEALER_ADMIN';
  if (normalized === 'sales_admin') return 'SALES_ADMIN';
  if (normalized === 'sales_person' || normalized === 'sales') return 'SALES_PERSON';
  if (normalized === 'gro') return 'GRO';
  if (normalized === 'security') return 'SECURITY';
  return '';
}

/**
 * Builds a scope filter based on user's auth context
 * Used to restrict queries to user's accessible scope
 */
export function buildScopeFilter(auth: AuthContext | undefined): Record<string, any> {
  if (!auth) return {};

  const filter: Record<string, any> = {};
  const isSuperAdmin = auth.role.code === 'SUPER_ADMIN';

  // Non-SUPER_ADMIN roles are always scoped to their org.
  // Explicitly set orgId even when null so queries return nothing instead
  // of falling through to "show everything".
  if (!isSuperAdmin) {
    filter.orgId = auth.scope.orgId ?? null;
  }

  if (auth.scope.businessUnitId) {
    filter.businessUnitId = auth.scope.businessUnitId;
  }

  if (auth.scope.brandId) {
    filter.brandId = auth.scope.brandId;
  }

  if (auth.scope.salesOfficeId) {
    filter.salesOfficeId = auth.scope.salesOfficeId;
  }

  if (auth.scope.plantId) {
    filter.plantId = auth.scope.plantId;
  }

  if (auth.scope.locationId) {
    filter.locationId = auth.scope.locationId;
  }

  // Add role-specific filters
  if (auth.role.code === 'SALES_PERSON' && auth.user.id) {
    filter.assignedSalesPersonId = auth.user.id;
  }

  if (auth.role.code === 'GRO' && auth.user.id) {
    filter.groId = auth.user.id;
  }

  if (auth.role.code === 'SECURITY' && auth.user.id) {
    filter.securityId = auth.user.id;
  }

  return filter;
}

/**
 * Middleware to check if user has required permission
 */
export function requirePermission(requiredPermission: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (!req.auth.role.permissions.includes(requiredPermission)) {
      return res.status(403).json({ error: `Permission denied: ${requiredPermission}` });
    }

    next();
  };
}

/**
 * Middleware to check if user has required role
 */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (!roles.includes(req.auth.role.code)) {
      return res.status(403).json({ error: 'Role not allowed' });
    }

    next();
  };
}

/**
 * Middleware to require authentication
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.auth) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
}
