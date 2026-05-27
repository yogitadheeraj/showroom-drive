import { Request, Response } from 'express';
import * as activityService from '../services/activityService.js';

// ── Events ────────────────────────────────────────────────────────────────────

export async function listEventsController(req: Request, res: Response) {
  const limit = Number(req.query.limit) || 200;
  const data = await activityService.listEvents(req.query as Record<string, unknown>, limit);
  res.json({ data });
}

export async function logEventController(req: Request, res: Response) {
  const data = await activityService.logEvent(req.body);
  res.status(201).json({ data });
}

// ── Sessions ──────────────────────────────────────────────────────────────────

export async function startSessionController(req: Request, res: Response) {
  const data = await activityService.startSession(req.body);
  res.status(201).json({ data });
}

export async function endSessionController(req: Request, res: Response) {
  await activityService.endSession(req.params.id);
  res.json({ success: true });
}

export async function touchSessionController(req: Request, res: Response) {
  const { active_seconds = 0, idle_seconds = 0 } = req.body;
  await activityService.touchSession(req.params.id, Number(active_seconds), Number(idle_seconds));
  res.json({ success: true });
}

export async function listOnlineSessionsController(req: Request, res: Response) {
  const locationId = req.query.location_id as string | undefined;
  const data = await activityService.listOnlineSessions(locationId);
  res.json({ data });
}
