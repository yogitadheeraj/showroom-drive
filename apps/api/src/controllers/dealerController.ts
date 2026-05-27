import { Request, Response } from 'express';
import * as dealerService from '../services/dealerService.js';

export async function listDealersController(req: Request, res: Response) {
  const data = await dealerService.listDealers(req.query as Record<string, unknown>);
  res.json({ data });
}

export async function getDealerController(req: Request, res: Response) {
  const data = await dealerService.getDealerById(req.params.id);
  if (!data) return res.status(404).json({ error: 'Dealer not found' });
  res.json({ data });
}

export async function createDealerController(req: Request, res: Response) {
  const data = await dealerService.createDealer(req.body);
  res.status(201).json({ data });
}

export async function updateDealerController(req: Request, res: Response) {
  const data = await dealerService.updateDealer(req.params.id, req.body);
  if (!data) return res.status(404).json({ error: 'Dealer not found' });
  res.json({ data });
}

export async function deleteDealerController(req: Request, res: Response) {
  await dealerService.deleteDealer(req.params.id);
  res.status(204).end();
}
