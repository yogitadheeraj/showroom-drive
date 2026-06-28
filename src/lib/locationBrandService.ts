import { apiDelete, apiPatch, apiPost } from '@/lib/apiClient';

export async function createLocation(payload: Record<string, unknown>) {
  return apiPost<any>('/api/locations', payload);
}

export async function updateLocation(id: string, payload: Record<string, unknown>) {
  return apiPatch<any>(`/api/locations/${encodeURIComponent(id)}`, payload);
}

export function buildBrandPayload(input: {
  name: string;
  dealerId?: string | null;
  orgId?: string | null;
  businessUnitId?: string | null;
  salesOfficeId?: string | null;
  plantId?: string | null;
  code?: string | null;
  description?: string | null;
  logo_url?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
}) {
  const payload: Record<string, unknown> = {
    name: input.name.trim(),
  };

  if (input.dealerId) payload.dealer_id = input.dealerId;
  if (input.orgId) payload.orgId = input.orgId;
  if (input.businessUnitId) payload.businessUnitId = input.businessUnitId;
  if (input.salesOfficeId) payload.salesOfficeId = input.salesOfficeId;
  if (input.plantId) payload.plantId = input.plantId;
  if (input.code) payload.code = input.code.trim().toUpperCase();
  if (input.description !== undefined) payload.description = input.description?.trim() || null;
  if (input.logo_url !== undefined) payload.logo_url = input.logo_url?.trim() || null;
  if (input.meta_title !== undefined) payload.meta_title = input.meta_title?.trim() || null;
  if (input.meta_description !== undefined) payload.meta_description = input.meta_description?.trim() || null;

  return payload;
}

export async function createBrand(payload: Record<string, unknown>) {
  return apiPost<any>('/api/brands', payload);
}

export async function updateBrand(id: string, payload: Record<string, unknown>) {
  return apiPatch<any>(`/api/brands/${encodeURIComponent(id)}`, payload);
}

export async function deleteBrand(id: string) {
  return apiDelete<any>(`/api/brands/${encodeURIComponent(id)}`);
}
