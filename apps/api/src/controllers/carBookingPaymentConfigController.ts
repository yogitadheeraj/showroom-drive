import { Request, Response } from 'express';
import {
  buildDefaultPaymentConfig,
  getCarBookingPaymentConfigByLocationId,
  upsertCarBookingPaymentConfig,
} from '../services/carBookingPaymentConfigService.js';
import { Location } from '../models/Location.js';

export async function getCarBookingPaymentConfigController(req: Request, res: Response) {
  try {
    const locationId = typeof req.params.locationId === 'string' ? req.params.locationId : '';
    if (!locationId) {
      res.status(400).json({ data: null, error: { message: 'locationId is required' } });
      return;
    }

    const data = await getCarBookingPaymentConfigByLocationId(locationId);
    if (data) {
      res.status(200).json({ data, error: null });
      return;
    }

    const location = await Location.findOne({ id: locationId }, { dealer_id: 1 }).lean();
    res.status(200).json({ data: buildDefaultPaymentConfig(locationId, location?.dealer_id || null), error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { message: (error as Error).message } });
  }
}

export async function upsertCarBookingPaymentConfigController(req: Request, res: Response) {
  try {
    if (!req.authUser?.uid) {
      res.status(401).json({ data: null, error: { message: 'Unauthorized' } });
      return;
    }

    const data = await upsertCarBookingPaymentConfig(req.authUser.uid, req.body || {});
    res.status(200).json({ data, error: null });
  } catch (error) {
    const message = (error as Error).message;
    const status = message.startsWith('Forbidden') ? 403 : 400;
    res.status(status).json({ data: null, error: { message } });
  }
}
