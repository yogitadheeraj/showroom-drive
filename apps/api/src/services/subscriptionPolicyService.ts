import { Dealer } from '../models/Dealer.js';
import { DealerSubscription } from '../models/DealerSubscription.js';
import { Location } from '../models/Location.js';
import { Profile } from '../models/Profile.js';
import { ServiceAppointment } from '../models/ServiceAppointment.js';
import { TestDrive } from '../models/TestDrive.js';
import { Vehicle } from '../models/Vehicle.js';
import { sendMail } from './mailService.js';

const FREE_PACKAGE_NAME = 'Free Package';
const FREE_PLAN_LIMITS = {
  profiles: 5,
  test_drives: 5,
  service_bookings: 5,
  locations: 1,
  vehicles: 2,
} as const;

export type BillingPeriod = 'monthly' | 'yearly';
export type LimitedResource = keyof typeof FREE_PLAN_LIMITS;

type EffectiveSubscription = {
  dealer_id: string;
  package_name: string;
  billing_period: BillingPeriod;
  expires_at: string | null;
  is_active: boolean;
  notes: string | null;
  expiry_notified_at?: string | null;
  expiry_soon_notified_at?: string | null;
};

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

export function computeSubscriptionExpiry(billingPeriod: BillingPeriod, fromDate = new Date()) {
  const expires = billingPeriod === 'yearly' ? addMonths(fromDate, 12) : addMonths(fromDate, 1);
  return expires.toISOString();
}

export function isSubscriptionExpired(expiresAt: string | null | undefined, now = new Date()) {
  if (!expiresAt) return false;
  const expiry = new Date(expiresAt);
  if (Number.isNaN(expiry.getTime())) return false;
  return expiry.getTime() <= now.getTime();
}

export async function getEffectiveDealerSubscription(dealerId: string): Promise<EffectiveSubscription> {
  const doc = await DealerSubscription.findOne({ dealer_id: dealerId }).lean() as any;
  if (!doc) {
    return {
      dealer_id: dealerId,
      package_name: FREE_PACKAGE_NAME,
      billing_period: 'monthly',
      expires_at: null,
      is_active: true,
      notes: null,
      expiry_notified_at: null,
      expiry_soon_notified_at: null,
    };
  }

  return {
    dealer_id: doc.dealer_id,
    package_name: doc.package_name || FREE_PACKAGE_NAME,
    billing_period: doc.billing_period === 'yearly' ? 'yearly' : 'monthly',
    expires_at: doc.expires_at || null,
    is_active: doc.is_active !== false,
    notes: doc.notes || null,
    expiry_notified_at: doc.expiry_notified_at || null,
    expiry_soon_notified_at: doc.expiry_soon_notified_at || null,
  };
}

export async function assertDealerSubscriptionActive(dealerId: string) {
  const subscription = await getEffectiveDealerSubscription(dealerId);
  if (!subscription.is_active || isSubscriptionExpired(subscription.expires_at)) {
    throw new Error('Subscription expired. Please contact your Super Admin to renew access.');
  }
  return subscription;
}

async function getDealerLocationIds(dealerId: string) {
  const locations = await Location.find({ dealer_id: dealerId }, { id: 1 }).lean();
  return locations.map((location: any) => location.id).filter(Boolean);
}

async function countDealerProfiles(dealerId: string) {
  const locationIds = await getDealerLocationIds(dealerId);
  if (locationIds.length === 0) return 0;
  return Profile.countDocuments({
    $or: [
      { location_id: { $in: locationIds } },
      { location_ids: { $in: locationIds } },
    ],
  });
}

async function countDealerTestDrives(dealerId: string) {
  const locationIds = await getDealerLocationIds(dealerId);
  if (locationIds.length === 0) return 0;
  return TestDrive.countDocuments({ location_id: { $in: locationIds } });
}

async function countDealerServiceBookings(dealerId: string) {
  const locationIds = await getDealerLocationIds(dealerId);
  if (locationIds.length === 0) return 0;
  return ServiceAppointment.countDocuments({ location_id: { $in: locationIds } });
}

async function countDealerLocations(dealerId: string) {
  return Location.countDocuments({ dealer_id: dealerId });
}

async function countDealerVehicles(dealerId: string) {
  const locationIds = await getDealerLocationIds(dealerId);
  if (locationIds.length === 0) return 0;
  return Vehicle.countDocuments({ location_id: { $in: locationIds } });
}

async function countDealerResource(dealerId: string, resource: LimitedResource) {
  switch (resource) {
    case 'profiles':
      return countDealerProfiles(dealerId);
    case 'test_drives':
      return countDealerTestDrives(dealerId);
    case 'service_bookings':
      return countDealerServiceBookings(dealerId);
    case 'locations':
      return countDealerLocations(dealerId);
    case 'vehicles':
      return countDealerVehicles(dealerId);
    default:
      return 0;
  }
}

export async function enforceDealerResourceLimit(dealerId: string, resource: LimitedResource) {
  const subscription = await assertDealerSubscriptionActive(dealerId);
  if (subscription.package_name !== FREE_PACKAGE_NAME) {
    return subscription;
  }

  const limit = FREE_PLAN_LIMITS[resource];
  const currentCount = await countDealerResource(dealerId, resource);
  if (currentCount >= limit) {
    const label = resource.replace(/_/g, ' ');
    throw new Error(`Free Package limit reached: only ${limit} ${label} allowed.`);
  }

  return subscription;
}

export async function resolveDealerIdFromLocation(locationId: string) {
  const location = await Location.findOne({ id: locationId }, { dealer_id: 1 }).lean() as any;
  return location?.dealer_id || null;
}

export async function resolveDealerIdFromProfilePayload(data: Record<string, unknown>) {
  const locationId = typeof data.location_id === 'string' && data.location_id.trim()
    ? data.location_id.trim()
    : Array.isArray(data.location_ids) && data.location_ids.length > 0
      ? String(data.location_ids[0] || '').trim()
      : '';
  if (!locationId) return null;
  return resolveDealerIdFromLocation(locationId);
}

function subscriptionExpiredTemplate(args: { dealerName: string; packageName: string; expiresAt: string | null }) {
  const when = args.expiresAt ? new Date(args.expiresAt).toLocaleString('en-IN') : 'immediately';
  const subject = `Subscription expired for ${args.dealerName}`;
  const text = [
    `Hello ${args.dealerName},`,
    '',
    `Your ${args.packageName} subscription expired on ${when}.`,
    'Your staff login access is now blocked until the subscription is renewed by Super Admin.',
  ].join('\n');
  const html = `
    <div style="font-family:Arial,sans-serif;color:#111;line-height:1.5;">
      <h2 style="margin:0 0 12px;">Subscription Expired</h2>
      <p>Hello ${args.dealerName},</p>
      <p>Your <strong>${args.packageName}</strong> subscription expired on <strong>${when}</strong>.</p>
      <p>Your staff login access is now blocked until the subscription is renewed by Super Admin.</p>
    </div>
  `;
  return { subject, text, html };
}

function subscriptionExpiringSoonTemplate(args: {
  dealerName: string;
  packageName: string;
  expiresAt: string;
  daysLeft: number;
}) {
  const when = new Date(args.expiresAt).toLocaleString('en-IN');
  const dayLabel = args.daysLeft === 1 ? 'day' : 'days';
  const subject = `Subscription expiring in ${args.daysLeft} ${dayLabel} for ${args.dealerName}`;
  const text = [
    `Hello ${args.dealerName},`,
    '',
    `Your ${args.packageName} subscription will expire on ${when}.`,
    `Time left: ${args.daysLeft} ${dayLabel}.`,
    'Please ask your Super Admin to renew or update your plan to avoid login/access interruption.',
  ].join('\n');
  const html = `
    <div style="font-family:Arial,sans-serif;color:#111;line-height:1.5;">
      <h2 style="margin:0 0 12px;">Subscription Expiring Soon</h2>
      <p>Hello ${args.dealerName},</p>
      <p>Your <strong>${args.packageName}</strong> subscription will expire on <strong>${when}</strong>.</p>
      <p>Time left: <strong>${args.daysLeft} ${dayLabel}</strong>.</p>
      <p>Please ask your Super Admin to renew or update your plan to avoid login/access interruption.</p>
    </div>
  `;
  return { subject, text, html };
}

export async function processExpiringSoonDealerSubscriptions(reminderDays = 7) {
  const now = new Date();
  const nowIso = now.toISOString();
  const threshold = new Date(now);
  threshold.setDate(threshold.getDate() + reminderDays);

  const expiringSoon = await DealerSubscription.find({
    is_active: true,
    expires_at: {
      $ne: null,
      $gt: nowIso,
      $lte: threshold.toISOString(),
    },
  }).lean() as any[];

  let processed = 0;

  for (const subscription of expiringSoon) {
    if (subscription.expiry_soon_notified_at) continue;

    const expiresAt = String(subscription.expires_at || '').trim();
    if (!expiresAt) continue;

    const expiryTime = new Date(expiresAt).getTime();
    if (Number.isNaN(expiryTime)) continue;

    const diffMs = expiryTime - now.getTime();
    const daysLeft = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    const dealer = await Dealer.findOne({ id: subscription.dealer_id }, { name: 1, contact_email: 1 }).lean() as any;

    if (dealer?.contact_email) {
      const template = subscriptionExpiringSoonTemplate({
        dealerName: dealer.name || 'Dealer',
        packageName: subscription.package_name || FREE_PACKAGE_NAME,
        expiresAt,
        daysLeft,
      });
      try {
        await sendMail({
          to: dealer.contact_email,
          subject: template.subject,
          html: template.html,
          text: template.text,
          _dealerName: dealer.name || 'Auto Advant',
        });
      } catch {
        // non-blocking; persist notification marker below to prevent mail storms
      }
    }

    await DealerSubscription.updateOne(
      { dealer_id: subscription.dealer_id },
      {
        $set: {
          expiry_soon_notified_at: nowIso,
          updated_at: nowIso,
        },
      },
    );
    processed += 1;
  }

  return { processed };
}

export async function processExpiredDealerSubscriptions() {
  const now = new Date();
  const expiring = await DealerSubscription.find({ is_active: true, expires_at: { $ne: null, $lte: now.toISOString() } }).lean() as any[];
  let processed = 0;

  for (const subscription of expiring) {
    if (subscription.expiry_notified_at) continue;

    const dealer = await Dealer.findOne({ id: subscription.dealer_id }, { name: 1, contact_email: 1 }).lean() as any;
    if (dealer?.contact_email) {
      const template = subscriptionExpiredTemplate({
        dealerName: dealer.name || 'Dealer',
        packageName: subscription.package_name || FREE_PACKAGE_NAME,
        expiresAt: subscription.expires_at || null,
      });
      try {
        await sendMail({
          to: dealer.contact_email,
          subject: template.subject,
          html: template.html,
          text: template.text,
          _dealerName: dealer.name || 'Auto Advant',
        });
      } catch {
        // keep going; still mark as processed to avoid repeated mail storms only when save succeeds below
      }
    }

    await DealerSubscription.updateOne(
      { dealer_id: subscription.dealer_id },
      {
        $set: {
          is_active: false,
          expiry_notified_at: now.toISOString(),
          updated_at: now.toISOString(),
        },
      },
    );
    processed += 1;
  }

  return { processed };
}
