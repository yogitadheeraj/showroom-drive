import { apiPatch, apiPost } from '@/lib/apiClient';

export async function createLocation(payload: Record<string, unknown>) {
  return apiPost<any>('/api/locations', payload);
}

export async function updateLocation(id: string, payload: Record<string, unknown>) {
  return apiPatch<any>(`/api/locations/${encodeURIComponent(id)}`, payload);
}

export async function createBrand(payload: Record<string, unknown>) {
  return apiPost<any>('/api/brands', payload);
}

export async function updateBrand(id: string, payload: Record<string, unknown>) {
  return apiPatch<any>(`/api/brands/${encodeURIComponent(id)}`, payload);
}
