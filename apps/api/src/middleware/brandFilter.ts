import { Request } from 'express';

function normalizeIdList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((id) => String(id || '').trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
  }

  return [];
}

/**
 * Roles that are scoped to a single assigned location.
 * API list/count queries will be automatically restricted to their location_id.
 */
const LOCATION_SCOPED_ROLES = new Set([
  'gro',
  'sales',
  'sales_admin',
  'branch_admin',
  'service_expert',
  'security',
  'brand_admin',
]);

/**
 * Mutates `filters` to enforce location/dealer scope for the requesting user.
 *
 * - Staff roles (gro, sales, sales_admin, branch_admin, security):
 *     Forces `location_id` to the user's assigned location. Any `location_ids`
 *     param from the query string is also removed to prevent scope bypass.
 * - dealer_admin:
 *     Forces `location_ids` to all location IDs under their dealer, OR falls
 *     back to `dealer_id` filter for services that support it directly
 *     (e.g. locationService). Removes any conflicting query-supplied filters.
 * - superadmin / unauthenticated: no automatic filter added.
 *
 * Call this in list/count controller handlers after building initial filters
 * from req.query, before passing filters to the service layer.
 */
export function applyBrandScope(
  req: Request,
  filters: Record<string, unknown>,
): void {
  const role = req.authUser?.role;
  const assignedBrandIds = normalizeIdList(req.authUser?.brand_ids);
  if (!role) return;
  if (LOCATION_SCOPED_ROLES.has(role)) {
      if (assignedBrandIds.length === 0) {
        filters.brand_id = '__NO_ASSIGNED_BRAND__';
        delete filters.brand_ids;
      } else {
        filters.brand_ids = assignedBrandIds;
        delete filters.brand_id;
      }
    }
}
