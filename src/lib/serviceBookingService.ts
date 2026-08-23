import { apiGet, apiPatch, apiPost } from '@/lib/apiClient';

export const VALID_PREFERRED_CONTACT_OPTIONS = ['phone', 'email', 'whatsapp'] as const;

export function normalizePreferredContactSelection(value: string | string[] | undefined): string {
  const entries = Array.isArray(value)
    ? value
    : String(value ?? '')
        .split(',')
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean);

  const values = [...new Set(entries.map((entry) => entry === 'all' ? 'all' : entry))];

  if (values.includes('all')) return 'all';

  const validValues = values.filter((option): option is string =>
    VALID_PREFERRED_CONTACT_OPTIONS.includes(option as typeof VALID_PREFERRED_CONTACT_OPTIONS[number]),
  );

  if (!validValues.length) return 'phone';
  if (validValues.length === VALID_PREFERRED_CONTACT_OPTIONS.length) return 'all';
  return validValues.join(',');
}

export function getPreferredContactValues(value: string | string[] | undefined): string[] {
  const normalized = normalizePreferredContactSelection(value);
  if (normalized === 'all') return [...VALID_PREFERRED_CONTACT_OPTIONS];
  return normalized ? normalized.split(',').filter(Boolean) : ['phone'];
}

export type ServicePackage = {
  code: string;
  name: string;
  description: string;
  duration_minutes: number;
  price: number;
  is_active: boolean;
};

export type ServiceVehicleDetails = {
  registration_number: string;
  brand: string;
  model: string;
  variant?: string | null;
  year?: number | null;
  color?: string | null;
};

export type ServiceBookingPayload = {
  customer_name: string;
  customer_phone: string;
  customer_email?: string | null;
  preferred_contact?: string;
  location_id: string;
  package_code: string;
  appointment_date: string;
  appointment_time: string;
  vehicle: ServiceVehicleDetails;
};

export async function listServicePackages() {
  return apiGet<ServicePackage[]>('/api/public/service-packages');
}

export async function getServiceAvailability(locationId: string, date: string, packageCode: string) {
  const qs = new URLSearchParams({
    location_id: locationId,
    date,
    package_code: packageCode,
  }).toString();

  return apiGet<{
    slots: Array<{ time: string; available_units: number; is_available: boolean }>;
    max_per_slot: number;
    slot_minutes: number;
  }>(`/api/public/service-bookings/availability?${qs}`);
}

export async function lookupServiceBookings(phone: string, verificationToken: string) {
  const qs = new URLSearchParams({ phone, verification_token: verificationToken }).toString();
  return apiGet<{
    customer: any;
    vehicles: ServiceVehicleDetails[];
    recent_bookings: any[];
    bookings: any[];
  }>(`/api/public/service-bookings/lookup?${qs}`);
}

export async function requestServiceBookingOtp(phone: string) {
  return apiPost<{
    success: boolean;
    delivery: string;
    masked_destination: string;
    expires_in_minutes: number;
  }>('/api/public/service-bookings/otp/request', { phone });
}

export async function verifyServiceBookingOtp(phone: string, otp: string) {
  return apiPost<{
    verified: boolean;
    verification_token: string;
    expires_in_minutes: number;
  }>('/api/public/service-bookings/otp/verify', { phone, otp });
}

export async function createServiceBooking(payload: ServiceBookingPayload) {
  return apiPost<any>('/api/public/service-bookings', payload as Record<string, unknown>);
}

export async function duplicateServiceBookingCheck(payload: {
  customer_phone: string;
  location_id: string;
  appointment_date: string;
  appointment_time: string;
  registration_number: string;
}) {
  return apiPost<{ duplicate: any | null }>(
    '/api/public/service-bookings/duplicate-check',
    payload as Record<string, unknown>,
  );
}

export async function cancelServiceBooking(id: string, phone: string, reason?: string) {
  return apiPost<any>(`/api/public/service-bookings/${encodeURIComponent(id)}/cancel`, {
    customer_phone: phone,
    reason: reason || null,
  });
}

export async function rescheduleServiceBooking(
  id: string,
  phone: string,
  appointmentDate: string,
  appointmentTime: string,
  reason?: string,
) {
  return apiPost<any>(`/api/public/service-bookings/${encodeURIComponent(id)}/reschedule`, {
    customer_phone: phone,
    appointment_date: appointmentDate,
    appointment_time: appointmentTime,
    reason: reason || null,
  });
}

export async function listStaffServiceBookings(filters: Record<string, string> = {}) {
  const qs = new URLSearchParams(filters).toString();
  return apiGet<any[]>(`/api/service-bookings${qs ? `?${qs}` : ''}`);
}

export async function updateServiceProgress(id: string, payload: Record<string, unknown>) {
  return apiPatch<any>(`/api/service-bookings/${encodeURIComponent(id)}/progress`, payload);
}
