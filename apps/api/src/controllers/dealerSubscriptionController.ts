import { Request, Response } from 'express';
import * as dealerSubscriptionService from '../services/dealerSubscriptionService.js';
import * as dealerSubscriptionRequestService from '../services/dealerSubscriptionRequestService.js';
import * as activityService from '../services/activityService.js';
import { processExpiredDealerSubscriptions, processExpiringSoonDealerSubscriptions } from '../services/subscriptionPolicyService.js';

function canViewDealerSubscription(req: Request, dealerId: string) {
  const role = req.authUser?.role;
  if (role === 'superadmin' || role === 'super_admin') return true;
  if (role === 'dealer_admin' && req.authUser?.dealer_id === dealerId) return true;
  if (role === 'brand_admin' && req.authUser?.dealer_id === dealerId) return true;
  if ((role === 'sales_admin' || role === 'branch_admin') && req.authUser?.dealer_id === dealerId) return true;
  return false;
}

function canRequestDealerSubscriptionChange(req: Request, dealerId: string) {
  const role = req.authUser?.role;
  if (!role) return false;
  if ((role === 'brand_admin' || role === 'sales_admin' || role === 'branch_admin' || role === 'dealer_admin') && req.authUser?.dealer_id === dealerId) {
    return true;
  }
  return false;
}

function canManageDealerSubscription(req: Request) {
  const role = req.authUser?.role;
  return role === 'superadmin' || role === 'super_admin';
}

export async function getDealerSubscriptionController(req: Request, res: Response) {
  if (!canViewDealerSubscription(req, req.params.id)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const data = await dealerSubscriptionService.getDealerSubscriptionByDealerId(req.params.id);
  if (!data) return res.status(404).json({ error: 'Subscription not found' });
  res.json({ data });
}

export async function upsertDealerSubscriptionController(req: Request, res: Response) {
  if (!canManageDealerSubscription(req)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const data = await dealerSubscriptionService.upsertDealerSubscription({
    ...req.body,
    dealer_id: req.params.id,
  });
  res.json({ data });
}

export async function createDealerSubscriptionRequestController(req: Request, res: Response) {
  if (!canRequestDealerSubscriptionChange(req, req.params.id)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const requested_package_name = typeof req.body?.package_name === 'string' ? req.body.package_name.trim() : '';
  if (!requested_package_name) {
    return res.status(400).json({ error: 'package_name is required' });
  }

  const data = await dealerSubscriptionRequestService.createDealerSubscriptionRequest({
    dealer_id: req.params.id,
    requested_by_uid: req.authUser?.uid || '',
    requested_by_email: req.authUser?.email || null,
    requested_by_role: req.authUser?.role || 'unknown',
    requested_package_name,
    requested_billing_period: req.body?.billing_period,
    note: typeof req.body?.note === 'string' ? req.body.note : null,
  });

  res.status(201).json({ data });
}

export async function listDealerSubscriptionRequestsController(req: Request, res: Response) {
  if (!canManageDealerSubscription(req)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const dealer_id = typeof req.query?.dealer_id === 'string' ? req.query.dealer_id : undefined;
  const status = typeof req.query?.status === 'string' ? req.query.status : undefined;
  const data = await dealerSubscriptionRequestService.listDealerSubscriptionRequests({
    dealer_id,
    status: status === 'pending' || status === 'approved' || status === 'rejected' ? status : undefined,
  });
  res.json({ data });
}

export async function approveDealerSubscriptionRequestController(req: Request, res: Response) {
  if (!canManageDealerSubscription(req)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const data = await dealerSubscriptionRequestService.approveDealerSubscriptionRequest(req.params.requestId, {
    reviewed_by_uid: req.authUser?.uid || '',
    reviewed_by_email: req.authUser?.email || null,
    review_note: typeof req.body?.review_note === 'string' ? req.body.review_note : null,
  });

  try {
    await activityService.logEvent({
      user_id: req.authUser?.uid || 'unknown',
      profile_id: req.authUser?.profile_id || null,
      location_id: req.authUser?.location_id || null,
      role: req.authUser?.role || null,
      event_type: 'subscription_request_approved',
      event_label: `Subscription request approved by ${req.authUser?.email || 'superadmin'}`,
      route: '/settings',
      metadata: {
        request_id: req.params.requestId,
        dealer_id: (data as any)?.dealer_id || null,
        approver_email: req.authUser?.email || null,
        requested_package_name: (data as any)?.requested_package_name || null,
        requested_billing_period: (data as any)?.requested_billing_period || null,
      },
    });
  } catch {
    // non-blocking
  }
  res.json({ data });
}

export async function rejectDealerSubscriptionRequestController(req: Request, res: Response) {
  if (!canManageDealerSubscription(req)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const data = await dealerSubscriptionRequestService.rejectDealerSubscriptionRequest(req.params.requestId, {
    reviewed_by_uid: req.authUser?.uid || '',
    reviewed_by_email: req.authUser?.email || null,
    review_note: typeof req.body?.review_note === 'string' ? req.body.review_note : null,
  });

  try {
    await activityService.logEvent({
      user_id: req.authUser?.uid || 'unknown',
      profile_id: req.authUser?.profile_id || null,
      location_id: req.authUser?.location_id || null,
      role: req.authUser?.role || null,
      event_type: 'subscription_request_rejected',
      event_label: `Subscription request rejected by ${req.authUser?.email || 'superadmin'}`,
      route: '/settings',
      metadata: {
        request_id: req.params.requestId,
        dealer_id: (data as any)?.dealer_id || null,
        approver_email: req.authUser?.email || null,
      },
    });
  } catch {
    // non-blocking
  }
  res.json({ data });
}

export async function runSubscriptionReminderJobsController(req: Request, res: Response) {
  if (!canManageDealerSubscription(req)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const [soonResult, expiredResult] = await Promise.all([
    processExpiringSoonDealerSubscriptions(),
    processExpiredDealerSubscriptions(),
  ]);

  try {
    await activityService.logEvent({
      user_id: req.authUser?.uid || 'unknown',
      profile_id: req.authUser?.profile_id || null,
      location_id: req.authUser?.location_id || null,
      role: req.authUser?.role || null,
      event_type: 'subscription_reminder_jobs_ran',
      event_label: `Subscription reminder jobs triggered by ${req.authUser?.email || 'superadmin'}`,
      route: '/settings',
      metadata: {
        triggered_by_email: req.authUser?.email || null,
        expiring_soon_processed: soonResult.processed,
        expired_processed: expiredResult.processed,
      },
    });
  } catch {
    // non-blocking
  }

  res.json({
    data: {
      expiringSoonProcessed: soonResult.processed,
      expiredProcessed: expiredResult.processed,
    },
  });
}