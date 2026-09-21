import { apiGet, apiPut } from '@/lib/apiClient';

export type CollectionMode = 'deposit' | 'full';
export type DepositType = 'fixed' | 'percentage';

export interface CarBookingPaymentConfig {
  id: string;
  location_id: string;
  dealer_id: string | null;
  payment_module_enabled: boolean;
  allow_deposit: boolean;
  allow_full_payment: boolean;
  default_collection_mode: CollectionMode;
  deposit_type: DepositType;
  deposit_value: number;
  provider_name: string;
  payment_link_base_url: string | null;
  enable_upi: boolean;
  enable_card: boolean;
  enable_net_banking: boolean;
  enable_wallet: boolean;
  updated_by_profile_id: string | null;
  created_at: string;
  updated_at: string;
}

export type CarBookingPaymentConfigPayload = Pick<
  CarBookingPaymentConfig,
  | 'location_id'
  | 'payment_module_enabled'
  | 'allow_deposit'
  | 'allow_full_payment'
  | 'default_collection_mode'
  | 'deposit_type'
  | 'deposit_value'
  | 'provider_name'
  | 'payment_link_base_url'
  | 'enable_upi'
  | 'enable_card'
  | 'enable_net_banking'
  | 'enable_wallet'
>;

export async function getCarBookingPaymentConfig(locationId: string) {
  return apiGet<CarBookingPaymentConfig>(`/api/car-bookings/payment-config/${encodeURIComponent(locationId)}`);
}

export async function upsertCarBookingPaymentConfig(payload: CarBookingPaymentConfigPayload) {
  return apiPut<CarBookingPaymentConfig>('/api/car-bookings/payment-config', payload as Record<string, unknown>);
}
