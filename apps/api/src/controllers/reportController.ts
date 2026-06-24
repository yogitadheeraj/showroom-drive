import { Request, Response } from 'express';
import {
  generateDownloadableReport,
  getReportRecipientsPreview,
  logReportAudit,
  processConfiguredReportDispatchJobs,
  sendReportToConfiguredRecipients,
} from '../services/reportDeliveryService.js';
import {
  deleteReportDispatchConfig,
  getReportDispatchConfig,
  listReportDispatchConfigs,
  upsertReportDispatchConfig,
} from '../services/reportDispatchConfigService.js';
import { UserRole } from '../models/UserRole.js';
import { Profile } from '../models/Profile.js';
import { Location } from '../models/Location.js';

function parseReportType(value: unknown): 'test_drive_daily' | 'activity_daily' {
  return String(value || 'test_drive_daily') === 'activity_daily' ? 'activity_daily' : 'test_drive_daily';
}

function parseFormat(value: unknown): 'excel' | 'pdf' {
  return String(value || 'excel').toLowerCase() === 'pdf' ? 'pdf' : 'excel';
}

function parseFormats(value: unknown): Array<'excel' | 'pdf'> {
  const src = Array.isArray(value) ? value : [];
  const out = src
    .map((v) => String(v || '').toLowerCase().trim())
    .filter((v): v is 'excel' | 'pdf' => v === 'excel' || v === 'pdf');
  return out.length ? Array.from(new Set(out)) : ['excel'];
}

function parseRecipientRoles(value: unknown): Array<'dealer_admin' | 'sales'> {
  const src = Array.isArray(value) ? value : [];
  const out = src
    .map((v) => {
      const s = String(v || '').toLowerCase().trim();
      if (s === 'sales_person') return 'sales';
      return s;
    })
    .filter((v): v is 'dealer_admin' | 'sales' => v === 'dealer_admin' || v === 'sales');
  return out.length ? Array.from(new Set(out)) : ['dealer_admin'];
}

function parseDate(value: unknown): string {
  const v = String(value || '').trim();
  return v || new Date().toISOString().slice(0, 10);
}

async function ensureLocationAccess(userId: string, locationId: string): Promise<void> {
  const [roleDoc, profileDoc] = await Promise.all([
    UserRole.findOne({ user_id: userId }, { role: 1 }).lean(),
    Profile.findOne({ user_id: userId }, { location_id: 1 }).lean(),
  ]);

  const role = String((roleDoc as any)?.role || '');
  const userLocationId = String((profileDoc as any)?.location_id || '');

  if (role === 'superadmin' || role === 'super_admin') {
    return;
  }

  if (['sales_admin', 'branch_admin', 'sales', 'gro', 'security', 'brand_branch_admin', 'sales_person'].includes(role)) {
    if (!userLocationId || userLocationId !== locationId) {
      throw new Error('Forbidden: location access denied');
    }
    return;
  }

  if (role === 'dealer_admin' || role === 'brand_admin') {
    const [userLoc, targetLoc] = await Promise.all([
      userLocationId ? Location.findOne({ id: userLocationId }, { dealer_id: 1 }).lean() : null,
      Location.findOne({ id: locationId }, { dealer_id: 1 }).lean(),
    ]);

    const userDealerId = String((userLoc as any)?.dealer_id || '');
    const targetDealerId = String((targetLoc as any)?.dealer_id || '');
    if (!userDealerId || !targetDealerId || userDealerId !== targetDealerId) {
      throw new Error('Forbidden: dealer scope mismatch');
    }
    return;
  }

  throw new Error('Forbidden: insufficient permissions');
}

export async function downloadReportController(req: Request, res: Response) {
  try {
    if (!req.authUser?.uid) {
      res.status(401).json({ data: null, error: { message: 'Unauthorized' } });
      return;
    }

    const locationId = String(req.query.location_id || '').trim();
    if (!locationId) {
      res.status(400).json({ data: null, error: { message: 'location_id is required' } });
      return;
    }

    await ensureLocationAccess(req.authUser.uid, locationId);

    const reportDate = parseDate(req.query.report_date);
    const format = parseFormat(req.query.format);
    const reportType = parseReportType(req.query.report_type);

    const file = await generateDownloadableReport({
      locationId,
      reportDate,
      format,
      reportType,
    });

    await logReportAudit({
      action: 'download',
      status: 'success',
      location_id: locationId,
      report_type: reportType,
      report_date: reportDate,
      format,
      actor_user_id: req.authUser.uid,
      message: 'Report downloaded from frontend',
    });

    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.status(200).send(file.buffer);
  } catch (error) {
    const message = (error as Error).message;
    const status = message.startsWith('Forbidden') ? 403 : 400;
    res.status(status).json({ data: null, error: { message } });
  }
}

export async function sendReportNowController(req: Request, res: Response) {
  try {
    if (!req.authUser?.uid) {
      res.status(401).json({ data: null, error: { message: 'Unauthorized' } });
      return;
    }

    const locationId = String(req.body?.location_id || '').trim();
    if (!locationId) {
      res.status(400).json({ data: null, error: { message: 'location_id is required' } });
      return;
    }

    await ensureLocationAccess(req.authUser.uid, locationId);

    const reportDate = parseDate(req.body?.report_date);
    const reportType = parseReportType(req.body?.report_type);

    const formats = parseFormats(req.body?.formats);
    const recipientRoles = parseRecipientRoles(req.body?.recipient_roles);

    const data = await sendReportToConfiguredRecipients({
      locationId,
      reportDate,
      reportType,
      formats,
      recipientRoles,
      actorUserId: req.authUser.uid,
    });

    res.status(200).json({ data, error: null });
  } catch (error) {
    const message = (error as Error).message;
    const status = message.startsWith('Forbidden') ? 403 : 400;
    res.status(status).json({ data: null, error: { message } });
  }
}

export async function listReportDispatchConfigsController(req: Request, res: Response) {
  try {
    const locationId = typeof req.query.location_id === 'string' ? req.query.location_id : undefined;
    const data = await listReportDispatchConfigs({ location_id: locationId });
    res.status(200).json({ data, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { message: (error as Error).message } });
  }
}

export async function getReportDispatchConfigController(req: Request, res: Response) {
  try {
    const locationId = String(req.params.locationId || '').trim();
    if (!locationId) {
      res.status(400).json({ data: null, error: { message: 'locationId is required' } });
      return;
    }

    const reportType = parseReportType(req.query.report_type);
    const data = await getReportDispatchConfig(locationId, reportType);

    if (!data) {
      res.status(404).json({ data: null, error: { message: 'Report dispatch config not found' } });
      return;
    }

    res.status(200).json({ data, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { message: (error as Error).message } });
  }
}

export async function upsertReportDispatchConfigController(req: Request, res: Response) {
  try {
    if (!req.authUser?.uid) {
      res.status(401).json({ data: null, error: { message: 'Unauthorized' } });
      return;
    }

    const data = await upsertReportDispatchConfig(req.authUser.uid, req.body || {});
    res.status(200).json({ data, error: null });
  } catch (error) {
    const message = (error as Error).message;
    const status = message.startsWith('Forbidden') ? 403 : 400;
    res.status(status).json({ data: null, error: { message } });
  }
}

export async function deleteReportDispatchConfigController(req: Request, res: Response) {
  try {
    if (!req.authUser?.uid) {
      res.status(401).json({ data: null, error: { message: 'Unauthorized' } });
      return;
    }

    const locationId = String(req.params.locationId || '').trim();
    if (!locationId) {
      res.status(400).json({ data: null, error: { message: 'locationId is required' } });
      return;
    }

    const reportType = parseReportType(req.query.report_type);
    const data = await deleteReportDispatchConfig(req.authUser.uid, locationId, reportType);

    if (!data) {
      res.status(404).json({ data: null, error: { message: 'Report dispatch config not found' } });
      return;
    }

    res.status(200).json({ data, error: null });
  } catch (error) {
    const message = (error as Error).message;
    const status = message.startsWith('Forbidden') ? 403 : 400;
    res.status(status).json({ data: null, error: { message } });
  }
}

export async function runReportDispatchJobNowController(_req: Request, res: Response) {
  try {
    const data = await processConfiguredReportDispatchJobs();
    res.status(200).json({ data, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { message: (error as Error).message } });
  }
}

export async function reportRecipientsPreviewController(req: Request, res: Response) {
  try {
    if (!req.authUser?.uid) {
      res.status(401).json({ data: null, error: { message: 'Unauthorized' } });
      return;
    }

    const locationId = String(req.query.location_id || '').trim();
    if (!locationId) {
      res.status(400).json({ data: null, error: { message: 'location_id is required' } });
      return;
    }

    await ensureLocationAccess(req.authUser.uid, locationId);

    const recipientRoles = parseRecipientRoles(
      typeof req.query.recipient_roles === 'string'
        ? String(req.query.recipient_roles).split(',').map((v) => v.trim())
        : [],
    );

    const recipients = await getReportRecipientsPreview({
      locationId,
      recipientRoles,
    });

    res.status(200).json({
      data: {
        location_id: locationId,
        recipient_roles: recipientRoles,
        recipients,
        count: recipients.length,
      },
      error: null,
    });
  } catch (error) {
    const message = (error as Error).message;
    const status = message.startsWith('Forbidden') ? 403 : 400;
    res.status(status).json({ data: null, error: { message } });
  }
}
