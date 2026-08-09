import { apiGet, apiPost, apiPatch, apiDelete } from './apiClient';

export interface BrandWithLocations {
  id: string;
  orgId: string | null;
  dealer_id: string | null;
  businessUnitId: string | null;
  code: string | null;
  name: string;
  description?: string | null;
  logo_url?: string | null;
  is_active: boolean;
  locationIds: string[];
}

export async function listBrandsWithLocations(filters: Record<string, string> = {}): Promise<BrandWithLocations[]> {
  const params = new URLSearchParams(filters).toString();
  const res = await apiGet<BrandWithLocations[]>(`/api/brands${params ? `?${params}` : ''}`);
  return res ?? [];
}

export async function updateBrandBusinessUnit(brandId: string, businessUnitId: string | null) {
  return apiPatch(`/api/brands/${brandId}/business-unit`, { businessUnitId });
}

export async function linkBrandLocation(payload: {
  orgId: string;
  brandId: string;
  locationId: string;
  businessUnitId?: string | null;
}) {
  return apiPost('/api/brand-locations', payload);
}

export async function unlinkBrandLocation(brandId: string, locationId: string, orgId: string) {
  return apiDelete(`/api/brand-locations/${brandId}/${locationId}?orgId=${orgId}`);
}
