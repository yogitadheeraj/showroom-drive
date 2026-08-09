import { Request, Response } from 'express';
import * as brandLocationService from '../services/brandLocationService.js';

export async function listBrandsWithLocationsController(req: Request, res: Response) {
  try {
    const filters: Record<string, unknown> = {};
    if (req.query.orgId) filters.orgId = req.query.orgId;
    if (req.query.dealer_id) filters.dealer_id = req.query.dealer_id;
    if (req.query.businessUnitId) filters.businessUnitId = req.query.businessUnitId;
console.log('filters', filters, 'authUser', req.authUser);
    const role = req.authUser?.role;
    const isSuperAdmin = role === 'superadmin' || role === 'super_admin';
    const isOrgOrEntityAdmin = role === 'dealer_admin' || role === 'sales_admin';
    if (!isSuperAdmin && isOrgOrEntityAdmin && !filters.dealer_id && req.authUser?.dealer_id) {
      filters.dealer_id = req.authUser.dealer_id;
    }

    if (req.authUser?.uid && !isSuperAdmin) {
      if (!isOrgOrEntityAdmin) {
        if (Array.isArray(req.authUser.brand_ids) && req.authUser.brand_ids.length > 0) {
          filters.brandIds = req.authUser.brand_ids;
        }
        if (Array.isArray(req.authUser.location_ids) && req.authUser.location_ids.length > 0) {
          filters.locationIds = req.authUser.location_ids;
        }
      }
    }

    const data = await brandLocationService.listBrandsWithLocations(filters);
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: { message: (err as Error).message } });
  }
}

export async function updateBrandBusinessUnitController(req: Request, res: Response) {
  try {
    const data = await brandLocationService.updateBrandBusinessUnit(
      req.params.id,
      req.body.businessUnitId ?? null,
    );
    if (!data) return res.status(404).json({ error: { message: 'Brand not found' } });
    res.json({ data });
  } catch (err) {
    res.status(400).json({ error: { message: (err as Error).message } });
  }
}

export async function listBrandLocationsController(req: Request, res: Response) {
  try {
    const filters: Record<string, unknown> = {};
    if (req.query.orgId) filters.orgId = req.query.orgId;
    if (req.query.brandId) filters.brandId = req.query.brandId;
    if (req.query.locationId) filters.locationId = req.query.locationId;

    const role = req.authUser?.role;
    const isSuperAdmin = role === 'superadmin' || role === 'super_admin';
    const isOrgOrEntityAdmin = role === 'dealer_admin' || role === 'sales_admin';
    if (req.authUser?.uid && !isSuperAdmin) {
      if (!isOrgOrEntityAdmin) {
        if (Array.isArray(req.authUser.brand_ids) && req.authUser.brand_ids.length > 0) {
          filters.brandIds = req.authUser.brand_ids;
        }
        if (Array.isArray(req.authUser.location_ids) && req.authUser.location_ids.length > 0) {
          filters.locationIds = req.authUser.location_ids;
        }
      } else if (req.authUser?.dealer_id) {
        filters.dealer_id = req.authUser.dealer_id;
      }
    }

    const data = await brandLocationService.listBrandLocations(filters);
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: { message: (err as Error).message } });
  }
}

export async function linkBrandLocationController(req: Request, res: Response) {
  try {
    const data = await brandLocationService.linkBrandLocation(req.body);
    res.status(201).json({ data });
  } catch (err) {
    res.status(400).json({ error: { message: (err as Error).message } });
  }
}

export async function unlinkBrandLocationController(req: Request, res: Response) {
  try {
    const { brandId, locationId } = req.params;
    const orgId = req.query.orgId as string;
    if (!orgId) return res.status(400).json({ error: { message: 'orgId is required' } });
    await brandLocationService.unlinkBrandLocation(orgId, brandId, locationId);
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: { message: (err as Error).message } });
  }
}
