import { apiGet, apiPatch, apiPost } from '@/lib/apiClient';

type CustomerPayload = {
  full_name: string;
  phone: string;
  email: string | null;
  preferred_contact: string;
  driving_license_url?: string | null;
};

function queryString(params: Record<string, string | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (typeof value === 'string' && value.length > 0) {
      query.set(key, value);
    }
  });
  const encoded = query.toString();
  return encoded ? `?${encoded}` : '';
}

export async function findCustomerByPhone(phone: string) {
  const qs = queryString({ phone, limit: '1' });
  const rows = await apiGet<any[]>(`/api/customers${qs}`);
  return rows?.[0] || null;
}

export async function createCustomer(payload: CustomerPayload) {
  return apiPost<any>('/api/customers', payload as Record<string, unknown>);
}

export async function updateCustomer(id: string, payload: Partial<CustomerPayload>) {
  return apiPatch<any>(`/api/customers/${encodeURIComponent(id)}`, payload as Record<string, unknown>);
}
