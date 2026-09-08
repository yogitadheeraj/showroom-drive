import { Request, Response } from 'express';
import * as tradeInService from '../services/tradeInService.js';

export async function listTradeInRequestsController(req: Request, res: Response) {
  const limit = Number(req.query.limit) || 20;
  const filters = {
    ...(req.query as Record<string, unknown>),
    dealer_id: req.query.dealer_id ?? req.authUser?.dealer_id ?? null,
    location_id: req.query.location_id ?? req.authUser?.location_id ?? null,
  };

  const data = await tradeInService.listTradeInRequests(filters, limit);
  res.json({ data });
}

export async function createTradeInRequestController(req: Request, res: Response) {
  try {
    const data = await tradeInService.createTradeInRequest({
      ...req.body,
      dealer_id: req.body.dealer_id ?? req.authUser?.dealer_id ?? null,
      location_id: req.body.location_id ?? req.authUser?.location_id ?? null,
    });

    res.status(201).json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to save trade-in request';
    res.status(400).json({ error: { message } });
  }
}
