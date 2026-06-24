import { apiDelete, apiPatch, apiPost } from '@/lib/apiClient';

export async function createLocation(payload: Record<string, unknown>) {
  return apiPost<any>('/api/v1/locations', payload);
}

export async function updateLocation(id: string, payload: Record<string, unknown>) {
  return apiPatch<any>(`/api/v1/locations/${encodeURIComponent(id)}`, payload);
}

export async function createBrand(payload: Record<string, unknown>) {
  return apiPost<any>('/api/brands', payload);
}

export async function updateBrand(id: string, payload: Record<string, unknown>) {
  return apiPatch<any>(`/api/brands/${encodeURIComponent(id)}`, payload);
}

export async function deleteBrand(id: string) {
  return apiDelete<{ id: string }>(`/api/brands/${encodeURIComponent(id)}`);
}
