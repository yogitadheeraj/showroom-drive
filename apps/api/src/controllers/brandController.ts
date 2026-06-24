import { Request, Response } from 'express';
import { createBrand, deleteBrand, getBrandById, listBrands, updateBrand } from '../services/brandService.js';

export async function getBrandsController(req: Request, res: Response) {
  try {
    const filters: Record<string, unknown> = {};
    if (req.query.dealer_id) filters.dealer_id = req.query.dealer_id;
    if (req.query.is_active !== undefined) filters.is_active = req.query.is_active === 'true';
    const data = await listBrands(filters);
    res.status(200).json({ data, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { message: (error as Error).message } });
  }
}

export async function getBrandController(req: Request, res: Response) {
  try {
    const data = await getBrandById(req.params.id);
    if (!data) { res.status(404).json({ data: null, error: { message: 'Brand not found' } }); return; }
    res.status(200).json({ data, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { message: (error as Error).message } });
  }
}

export async function createBrandController(req: Request, res: Response) {
  try {
    const userDealerId = (req as any).authUser?.dealer_id;
    const isSuperAdmin = (req as any).authUser?.role === 'superadmin' || (req as any).authUser?.role === 'super_admin';

    // Dealer admins can only create brands for their assigned dealer
    if (!isSuperAdmin && userDealerId && req.body.dealer_id && req.body.dealer_id !== userDealerId) {
      res.status(403).json({ data: null, error: { message: 'Unauthorized: Can only create brands for your assigned dealer' } });
      return;
    }

    // If dealer_id not provided, use user's dealer_id
    if (!isSuperAdmin && userDealerId && !req.body.dealer_id) {
      req.body.dealer_id = userDealerId;
    }

    const data = await createBrand(req.body);
    res.status(201).json({ data, error: null });
  } catch (error) {
    res.status(400).json({ data: null, error: { message: (error as Error).message } });
  }
}

export async function updateBrandController(req: Request, res: Response) {
  try {
    const userDealerId = (req as any).authUser?.dealer_id;
    const isSuperAdmin = (req as any).authUser?.role === 'superadmin' || (req as any).authUser?.role === 'super_admin';

    // Fetch existing brand to check ownership
    const existingBrand = await getBrandById(req.params.id);
    if (!existingBrand) {
      res.status(404).json({ data: null, error: { message: 'Brand not found' } });
      return;
    }

    // Dealer admins can only update brands for their assigned dealer
    if (!isSuperAdmin && userDealerId && existingBrand.dealer_id && existingBrand.dealer_id !== userDealerId) {
      res.status(403).json({ data: null, error: { message: 'Unauthorized: Can only update brands for your assigned dealer' } });
      return;
    }

    const data = await updateBrand(req.params.id, req.body);
    res.status(200).json({ data, error: null });
  } catch (error) {
    res.status(400).json({ data: null, error: { message: (error as Error).message } });
  }
}

export async function deleteBrandController(req: Request, res: Response) {
  try {
    const userDealerId = (req as any).authUser?.dealer_id;
    const isSuperAdmin = (req as any).authUser?.role === 'superadmin' || (req as any).authUser?.role === 'super_admin';

    // Fetch existing brand to check ownership
    const existingBrand = await getBrandById(req.params.id);
    if (!existingBrand) {
      res.status(404).json({ data: null, error: { message: 'Brand not found' } });
      return;
    }

    // Dealer admins can only delete brands for their assigned dealer
    if (!isSuperAdmin && userDealerId && existingBrand.dealer_id && existingBrand.dealer_id !== userDealerId) {
      res.status(403).json({ data: null, error: { message: 'Unauthorized: Can only delete brands for your assigned dealer' } });
      return;
    }

    await deleteBrand(req.params.id);
    res.status(200).json({ data: { id: req.params.id }, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { message: (error as Error).message } });
  }
}
