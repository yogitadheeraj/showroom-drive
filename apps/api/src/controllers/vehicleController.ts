import { Request, Response } from 'express';
import * as vehicleService from '../services/vehicleService.js';

export async function listVehiclesController(req: Request, res: Response) {
  const data = await vehicleService.listVehicles(req.query as Record<string, unknown>);
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
