import { Request } from 'express';
import {applyBrandScope} from './brandFilter.js';

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
export function applyLocationScope(
  req: Request,
  filters: Record<string, unknown>,
): void {
  const role = req.authUser?.role;
  const locationId = req.authUser?.location_id;
  const assignedLocationIds = Array.isArray(req.authUser?.location_ids)
    ? req.authUser.location_ids.filter(Boolean)
    : (locationId ? [locationId] : []);
  const requestedLocId = req.headers['x-selected-location-id'] as string | undefined;

  if (!role) return;

  if (LOCATION_SCOPED_ROLES.has(role)) {
    const effectiveLocationIds =
      requestedLocId && assignedLocationIds.includes(requestedLocId)
        ? [requestedLocId]
        : assignedLocationIds;

    if (effectiveLocationIds.length === 1) {
      filters.location_id = effectiveLocationIds[0];
      delete filters.location_ids;
    } else if (effectiveLocationIds.length > 1) {
      filters.location_ids = effectiveLocationIds;
      delete filters.location_id;
    } else {
      // No assigned branch => return empty dataset for scoped roles.
      filters.location_id = '__NO_ASSIGNED_LOCATION__';
      delete filters.location_ids;
    }
    applyBrandScope(req, filters);
    return;
  }
  const { location_id} = req.query as Record<string, string>;
  if (role === 'dealer_admin' && req.authUser?.dealer_id && !location_id) {
    const dealerLocationIds = req.authUser?.dealer_location_ids;
    const dealerId = req.authUser?.dealer_id;

    // Honour a specific location selection sent by the client (validated against dealer's locations)
    const effectiveLocationIds =
      requestedLocId && dealerLocationIds?.includes(requestedLocId)
        ? [requestedLocId]
        : dealerLocationIds;

    if (effectiveLocationIds && effectiveLocationIds.length > 0) {
      filters.location_ids = effectiveLocationIds;
      delete filters.location_id;
      if (dealerId) filters.dealer_id = dealerId;
    } else if (dealerId) {
      filters.dealer_id = dealerId;
    }
  }
}
