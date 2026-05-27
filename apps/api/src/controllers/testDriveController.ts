import { Request, Response } from 'express';
import {
  countTestDrives,
  createTestDrive,
  deleteTestDrive,
  getTestDriveById,
  listTestDrives,
  updateTestDrive,
} from '../services/testDriveService.js';

export async function getTestDrivesController(req: Request, res: Response) {
  try {
    const filters: Record<string, unknown> = {};
    if (req.query.location_id) filters.location_id = req.query.location_id;
    if (req.query.customer_id) filters.customer_id = req.query.customer_id;
    if (req.query.vehicle_id) filters.vehicle_id = req.query.vehicle_id;
    if (req.query.sales_person_id) filters.sales_person_id = req.query.sales_person_id;
    if (req.query.status) filters.status = req.query.status;
    if (req.query.scheduled_date) filters.scheduled_date = req.query.scheduled_date;
    if (req.query.statuses) {
      filters.statuses = String(req.query.statuses).split(',').map((s) => s.trim());
    }
    const [data, count] = await Promise.all([listTestDrives(filters), countTestDrives(filters)]);
    res.status(200).json({ data, count, error: null });
  } catch (error) {
    res.status(500).json({ data: null, count: null, error: { message: (error as Error).message } });
  }
}

export async function getTestDriveController(req: Request, res: Response) {
  try {
    const data = await getTestDriveById(req.params.id);
    if (!data) { res.status(404).json({ data: null, error: { message: 'Test drive not found' } }); return; }
    res.status(200).json({ data, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { message: (error as Error).message } });
  }
}

export async function createTestDriveController(req: Request, res: Response) {
  try {
    const data = await createTestDrive(req.body);
    res.status(201).json({ data, error: null });
  } catch (error) {
    res.status(400).json({ data: null, error: { message: (error as Error).message } });
  }
}

export async function updateTestDriveController(req: Request, res: Response) {
  try {
    const data = await updateTestDrive(req.params.id, req.body);
    if (!data) { res.status(404).json({ data: null, error: { message: 'Test drive not found' } }); return; }
    res.status(200).json({ data, error: null });
  } catch (error) {
    res.status(400).json({ data: null, error: { message: (error as Error).message } });
  }
}

export async function deleteTestDriveController(req: Request, res: Response) {
  try {
    await deleteTestDrive(req.params.id);
    res.status(200).json({ data: { id: req.params.id }, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { message: (error as Error).message } });
  }
}
