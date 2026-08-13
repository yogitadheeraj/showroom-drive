import { Request, Response } from 'express';
import { generateDailyAIInsights, listAIInsights } from '../services/aiInsightsService.js';

export async function listAIInsightsController(req: Request, res: Response) {
  try {
    const location_id = typeof req.query.location_id === 'string' ? req.query.location_id : undefined;
    const dealer_id = typeof req.query.dealer_id === 'string' ? req.query.dealer_id : undefined;
    const report_date = typeof req.query.report_date === 'string' ? req.query.report_date : undefined;
    const report_month = typeof req.query.report_month === 'string' ? req.query.report_month : undefined;
    const scope = req.query.scope === 'daily' || req.query.scope === 'month' || req.query.scope === 'all'
      ? req.query.scope
      : undefined;
    const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;

    const data = await listAIInsights({ location_id, dealer_id, report_date, report_month, scope, limit });
    res.status(200).json({ data, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { message: (error as Error).message } });
  }
}

export async function generateAIInsightsController(req: Request, res: Response) {
  try {
    if (!req.authUser?.uid) {
      res.status(401).json({ data: null, error: { message: 'Unauthorized' } });
      return;
    }

    const role = req.authUser.role || '';
    const allowed = ['superadmin', 'super_admin', 'dealer_admin', 'sales_admin'];
    if (!allowed.includes(role)) {
      res.status(403).json({ data: null, error: { message: 'Forbidden: insufficient role' } });
      return;
    }

    const locationIds = Array.isArray(req.body?.locationIds)
      ? (req.body.locationIds as unknown[]).map((x) => String(x)).filter(Boolean)
      : undefined;

    const data = await generateDailyAIInsights({
      reportDate: typeof req.body?.reportDate === 'string' ? req.body.reportDate : undefined,
      locationIds,
      forceRegenerate: Boolean(req.body?.forceRegenerate),
    });

    res.status(200).json({ data, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { message: (error as Error).message } });
  }
}
