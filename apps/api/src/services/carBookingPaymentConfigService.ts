import { randomUUID } from 'node:crypto';
import {
  CarBookingPaymentConfig,
  type CollectionMode,
  type DepositType,
} from '../models/CarBookingPaymentConfig.js';
import { Location } from '../models/Location.js';
import { Profile } from '../models/Profile.js';
import { UserRole } from '../models/UserRole.js';

export type AppUserRole =
  | 'superadmin'
  | 'super_admin'
  | 'dealer_admin'
  | 'sales_admin'
  | 'gro'
  | 'sales'
  | 'security'
  | string;

const ALLOWED_ROLES: AppUserRole[] = ['superadmin', 'super_admin', 'dealer_admin', 'sales_admin'];

function toPlain(doc: any) {
  const row = doc?.toObject ? doc.toObject() : { ...(doc || {}) };
  delete row._id;
  return row;
}

async function getActorContext(userId: string) {
  const [roleDoc, profileDoc] = await Promise.all([
    UserRole.findOne({ user_id: userId }, { role: 1 }).lean(),
    Profile.findOne({ user_id: userId }).lean(),
  ]);

  const role = (roleDoc?.role || '') as AppUserRole;
  const profile = (profileDoc || {}) as Record<string, unknown>;

  return {
    role,
    profileId: typeof profile.id === 'string' ? profile.id : null,
    locationId: typeof profile.location_id === 'string' ? profile.location_id : null,
    dealerId: typeof profile.dealer_id === 'string' ? profile.dealer_id : null,
  };
}

async function resolveActorDealerId(actor: Awaited<ReturnType<typeof getActorContext>>) {
  if (actor.dealerId) return actor.dealerId;
  if (actor.locationId) {
    const loc = await Location.findOne({ id: actor.locationId }, { dealer_id: 1 }).lean();
    return loc?.dealer_id || null;
  }
  return null;
}

async function ensureManagePermission(userId: string, locationId: string) {
  const actor = await getActorContext(userId);

  if (!ALLOWED_ROLES.includes(actor.role)) {
    throw new Error('Forbidden: only Organization Admin and Branch Admin can manage payment settings');
  }

  if (actor.role === 'superadmin' || actor.role === 'super_admin') {
    return actor;
  }

  if (actor.role === 'sales_admin') {
    if (!actor.locationId || actor.locationId !== locationId) {
      throw new Error('Forbidden: Branch Admin can only manage payment settings for own location');
    }
    return actor;
  }

  if (actor.role === 'dealer_admin') {
    const targetLocation = await Location.findOne({ id: locationId }, { dealer_id: 1 }).lean();
    if (!targetLocation?.dealer_id) throw new Error('Location not found');

    const actorDealerId = await resolveActorDealerId(actor);
    if (!actorDealerId || targetLocation.dealer_id !== actorDealerId) {
      throw new Error('Forbidden: Organization Admin can only manage own dealer locations');
    }
    return actor;
  }

  throw new Error('Forbidden');
}

export function buildDefaultPaymentConfig(locationId: string, dealerId: string | null = null) {
  return {
    id: '',
    location_id: locationId,
    dealer_id: dealerId,
    payment_module_enabled: false,
    allow_deposit: true,
    allow_full_payment: true,
    default_collection_mode: 'deposit' as CollectionMode,
    deposit_type: 'percentage' as DepositType,
    deposit_value: 10,
    provider_name: 'manual',
    payment_link_base_url: null,
    enable_upi: true,
    enable_card: true,
    enable_net_banking: true,
    enable_wallet: false,
    updated_by_profile_id: null,
    created_at: '',
    updated_at: '',
  };
}

export async function getCarBookingPaymentConfigByLocationId(locationId: string) {
  const doc = await CarBookingPaymentConfig.findOne({ location_id: locationId }).lean();
  if (!doc) return null;
  return toPlain(doc);
}

export async function upsertCarBookingPaymentConfig(userId: string, data: Record<string, unknown>) {
  const locationId = String(data.location_id || '').trim();
  if (!locationId) throw new Error('location_id is required');

  const actor = await ensureManagePermission(userId, locationId);

  const location = await Location.findOne({ id: locationId }, { dealer_id: 1 }).lean();
  if (!location) throw new Error('Location not found');

  const now = new Date().toISOString();

  const paymentModuleEnabled = Boolean(data.payment_module_enabled);
  const allowDeposit = data.allow_deposit !== false;
  const allowFullPayment = data.allow_full_payment !== false;

  const defaultMode = String(data.default_collection_mode || 'deposit') === 'full' ? 'full' : 'deposit';
  const depositType = String(data.deposit_type || 'percentage') === 'fixed' ? 'fixed' : 'percentage';
  const rawDepositValue = Number(data.deposit_value);
  const depositValue = Number.isFinite(rawDepositValue)
    ? (depositType === 'percentage' ? Math.max(1, Math.min(100, rawDepositValue)) : Math.max(0, rawDepositValue))
    : 10;

  const providerName = String(data.provider_name || 'manual').trim() || 'manual';
  const paymentLinkBaseUrl = String(data.payment_link_base_url || '').trim() || null;

  const payload = {
    dealer_id: location.dealer_id || null,
    payment_module_enabled: paymentModuleEnabled,
    allow_deposit: allowDeposit,
    allow_full_payment: allowFullPayment,
    default_collection_mode: defaultMode,
    deposit_type: depositType,
    deposit_value: depositValue,
    provider_name: providerName,
    payment_link_base_url: paymentLinkBaseUrl,
    enable_upi: data.enable_upi !== false,
    enable_card: data.enable_card !== false,
    enable_net_banking: data.enable_net_banking !== false,
    enable_wallet: data.enable_wallet === true,
    updated_by_profile_id: actor.profileId,
    updated_at: now,
  };

  const existing = await CarBookingPaymentConfig.findOne({ location_id: locationId });
  if (existing) {
    const updated = await CarBookingPaymentConfig.findOneAndUpdate(
      { location_id: locationId },
      { $set: payload },
      { new: true },
    );
    return updated ? toPlain(updated) : null;
  }

  const created = new CarBookingPaymentConfig({
    id: randomUUID(),
    location_id: locationId,
    created_at: now,
    ...payload,
  });
  await created.save();
  return toPlain(created);
}
