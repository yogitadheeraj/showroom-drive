import { randomUUID } from 'node:crypto';
import { DealerSubscription } from '../models/DealerSubscription.js';
import { computeSubscriptionExpiry } from './subscriptionPolicyService.js';

export const DEALER_SUBSCRIPTION_PACKAGES = ['Free Package', 'Starter 5', 'Smart 100', 'Full Functionality'] as const;
export const DEALER_BILLING_PERIODS = ['monthly', 'yearly'] as const;

function lean(doc: any) {
  const o = doc.toObject ? doc.toObject() : { ...doc };
  delete o._id;
  return o;
}

function normalizePackageName(value: unknown) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return 'Free Package';
  return DEALER_SUBSCRIPTION_PACKAGES.includes(raw as any) ? raw : raw;
}

function normalizeBillingPeriod(value: unknown): 'monthly' | 'yearly' {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (raw === 'yearly') return 'yearly';
  return 'monthly';
}

export async function getDealerSubscriptionByDealerId(dealerId: string) {
  const doc = await DealerSubscription.findOne({ dealer_id: dealerId }).lean();
  if (!doc) return null;
  const o = { ...doc } as any;
  delete o._id;
  return o;
}

export async function upsertDealerSubscription(data: Record<string, unknown>) {
  const now = new Date().toISOString();
  const dealerId = String(data.dealer_id || '').trim();
  if (!dealerId) {
    throw new Error('dealer_id is required');
  }
  const billingPeriod = normalizeBillingPeriod(data.billing_period);
  const packageName = normalizePackageName(data.package_name);
  const providedExpiresAt = typeof data.expires_at === 'string' && data.expires_at.trim()
    ? data.expires_at.trim()
    : null;
  const expiresAt = providedExpiresAt || computeSubscriptionExpiry(billingPeriod, new Date());

  const doc = await DealerSubscription.findOneAndUpdate(
    { dealer_id: dealerId },
    {
      $set: {
        id: String(data.id || randomUUID()),
        dealer_id: dealerId,
        package_name: packageName,
        billing_period: billingPeriod,
        expires_at: expiresAt,
        is_active: true,
        notes: typeof data.notes === 'string' && data.notes.trim() ? data.notes.trim() : null,
        expiry_notified_at: null,
        expiry_soon_notified_at: null,
        updated_at: now,
      },
      $setOnInsert: { created_at: now },
    },
    { upsert: true, new: true },
  );

  return lean(doc);
}

export async function createDealerSubscription(data: Record<string, unknown>) {
  return upsertDealerSubscription(data);
}

export async function deleteDealerSubscriptionByDealerId(dealerId: string) {
  await DealerSubscription.deleteOne({ dealer_id: dealerId });
}

export async function listDealerSubscriptions() {
  const docs = await DealerSubscription.find({}).sort({ updated_at: -1 }).lean();
  return docs.map((d) => {
    const o = { ...d } as any;
    delete o._id;
    return o;
  });
}