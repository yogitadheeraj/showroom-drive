import { randomUUID } from 'node:crypto';
import { DealerSubscriptionRequest } from '../models/DealerSubscriptionRequest.js';
import { getDealerSubscriptionByDealerId, upsertDealerSubscription } from './dealerSubscriptionService.js';

function lean(doc: any) {
  const o = doc?.toObject ? doc.toObject() : { ...doc };
  delete o._id;
  return o;
}

function normalizeBillingPeriod(value: unknown): 'monthly' | 'yearly' {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (raw === 'yearly') return 'yearly';
  return 'monthly';
}

export async function createDealerSubscriptionRequest(data: {
  dealer_id: string;
  requested_by_uid: string;
  requested_by_email?: string | null;
  requested_by_role: string;
  requested_package_name: string;
  requested_billing_period: 'monthly' | 'yearly' | string;
  note?: string | null;
}) {
  const current = await getDealerSubscriptionByDealerId(data.dealer_id);
  const now = new Date().toISOString();

  const doc = await DealerSubscriptionRequest.create({
    id: randomUUID(),
    dealer_id: data.dealer_id,
    requested_by_uid: data.requested_by_uid,
    requested_by_email: data.requested_by_email?.trim() ? data.requested_by_email.trim().toLowerCase() : null,
    requested_by_role: data.requested_by_role,
    current_package_name: current?.package_name || 'Free Package',
    current_billing_period: normalizeBillingPeriod(current?.billing_period),
    requested_package_name: data.requested_package_name,
    requested_billing_period: normalizeBillingPeriod(data.requested_billing_period),
    note: data.note?.trim() ? data.note.trim() : null,
    status: 'pending',
    reviewed_by_uid: null,
    reviewed_by_email: null,
    review_note: null,
    resolved_at: null,
    created_at: now,
    updated_at: now,
  });

  return lean(doc);
}

export async function listDealerSubscriptionRequests(params: {
  dealer_id?: string;
  status?: 'pending' | 'approved' | 'rejected';
}) {
  const query: Record<string, unknown> = {};
  if (params.dealer_id) query.dealer_id = params.dealer_id;
  if (params.status) query.status = params.status;
  const docs = await DealerSubscriptionRequest.find(query).sort({ created_at: -1 }).lean();
  return docs.map((d) => {
    const o = { ...d } as any;
    delete o._id;
    return o;
  });
}

export async function approveDealerSubscriptionRequest(requestId: string, data: { reviewed_by_uid: string; reviewed_by_email?: string | null; review_note?: string | null }) {
  const reqDoc = await DealerSubscriptionRequest.findOne({ id: requestId });
  if (!reqDoc) throw new Error('Subscription request not found');
  if (reqDoc.status !== 'pending') throw new Error('Subscription request already processed');

  const now = new Date().toISOString();
  reqDoc.status = 'approved';
  reqDoc.reviewed_by_uid = data.reviewed_by_uid;
  reqDoc.reviewed_by_email = data.reviewed_by_email?.trim() ? data.reviewed_by_email.trim().toLowerCase() : null;
  reqDoc.review_note = data.review_note?.trim() ? data.review_note.trim() : null;
  reqDoc.resolved_at = now;
  reqDoc.updated_at = now;
  await reqDoc.save();

  await upsertDealerSubscription({
    dealer_id: reqDoc.dealer_id,
    package_name: reqDoc.requested_package_name,
    billing_period: reqDoc.requested_billing_period,
    is_active: true,
  });

  return lean(reqDoc);
}

export async function rejectDealerSubscriptionRequest(requestId: string, data: { reviewed_by_uid: string; reviewed_by_email?: string | null; review_note?: string | null }) {
  const reqDoc = await DealerSubscriptionRequest.findOne({ id: requestId });
  if (!reqDoc) throw new Error('Subscription request not found');
  if (reqDoc.status !== 'pending') throw new Error('Subscription request already processed');

  const now = new Date().toISOString();
  reqDoc.status = 'rejected';
  reqDoc.reviewed_by_uid = data.reviewed_by_uid;
  reqDoc.reviewed_by_email = data.reviewed_by_email?.trim() ? data.reviewed_by_email.trim().toLowerCase() : null;
  reqDoc.review_note = data.review_note?.trim() ? data.review_note.trim() : null;
  reqDoc.resolved_at = now;
  reqDoc.updated_at = now;
  await reqDoc.save();

  return lean(reqDoc);
}
