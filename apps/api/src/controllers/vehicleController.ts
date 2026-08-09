import { Request, Response } from 'express';
import * as vehicleService from '../services/vehicleService.js';
import { applyLocationScope } from '../middleware/locationFilter.js';

export async function listVehiclesController(req: Request, res: Response) {
  const filters = { ...req.query } as Record<string, unknown>;
  applyLocationScope(req, filters);

  const data = await vehicleService.listVehicles(filters);
  res.json({ data });
}

export async function getVehicleController(req: Request, res: Response) {
  const data = await vehicleService.getVehicleById(req.params.id);
  if (!data) return res.status(404).json({ error: 'Vehicle not found' });
  res.json({ data });
}

export async function createVehicleController(req: Request, res: Response) {
  const data = await vehicleService.createVehicle(req.body);
  res.status(201).json({ data });
}

export async function updateVehicleController(req: Request, res: Response) {
  const data = await vehicleService.updateVehicle(req.params.id, req.body);
  if (!data) return res.status(404).json({ error: 'Vehicle not found' });
  res.json({ data });
}

export async function deleteVehicleController(req: Request, res: Response) {
  await vehicleService.deleteVehicle(req.params.id);
  res.status(204).end();
}

/**
 * GET /api/vehicles/available?location_id=&date=&time=
 * Returns local demo vehicles + shared vehicles available at that location/date.
 * Each shared vehicle includes transit_minutes, distance_km, available_from.
 */
export async function availableVehiclesController(req: Request, res: Response) {
  const scopedFilters: Record<string, unknown> = { ...req.query };
  applyLocationScope(req, scopedFilters);

  const location_id = typeof scopedFilters.location_id === 'string'
    ? scopedFilters.location_id
    : Array.isArray(scopedFilters.location_ids) && scopedFilters.location_ids.length > 0
      ? String(scopedFilters.location_ids[0])
      : undefined;
  const { date, time } = req.query as Record<string, string>;
  console.log(req.query, '[availableVehicles] location_id:', location_id, 'date:', date, 'time:', time);
  if (!location_id) {
    return res.status(400).json({ error: 'location_id is required' });
  }
  try {
    const data = await vehicleService.getAvailableVehiclesForBooking(location_id, date || undefined, time || undefined);
    res.json({ data });
  } catch (err: any) {
    console.error('[availableVehicles] error:', err?.message || err);
    res.status(500).json({ error: 'Failed to load available vehicles' });
  }
}
