import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/apiClient';

export interface BusinessUnit {
  id: string;
  orgId: string;
  code: string;
  name: string;
  isActive: boolean;
  created_at: string;
  updated_at: string;
}

export interface SalesOffice {
  id: string;
  orgId: string;
  businessUnitId: string;
  salesOfficeCode: string;
  externalSalesOfficeId: string | null;
  name: string;
  isActive: boolean;
  created_at: string;
  updated_at: string;
}

export interface Plant {
  id: string;
  orgId: string;
  businessUnitId: string;
  salesOfficeId: string;
  plantCode: string;
  externalPlantId: string | null;
  name: string;
  isActive: boolean;
  created_at: string;
  updated_at: string;
}

// ── Business Units ────────────────────────────────────────────────────────────

export async function listBusinessUnits(orgId?: string) {
  const qs = orgId ? `?orgId=${encodeURIComponent(orgId)}` : '';
  return apiGet<BusinessUnit[]>(`/api/business-units${qs}`);
}

export async function createBusinessUnit(payload: { orgId: string; name: string; code: string }) {
  return apiPost<BusinessUnit>('/api/business-units', payload as Record<string, unknown>);
}

export async function updateBusinessUnit(id: string, payload: Partial<BusinessUnit>) {
  return apiPatch<BusinessUnit>(`/api/business-units/${encodeURIComponent(id)}`, payload as Record<string, unknown>);
}

export async function deleteBusinessUnit(id: string) {
  return apiDelete(`/api/business-units/${encodeURIComponent(id)}`);
}

// ── Sales Offices ─────────────────────────────────────────────────────────────

export async function listSalesOffices(filters: { orgId?: string; businessUnitId?: string } = {}) {
  const params = new URLSearchParams();
  if (filters.orgId) params.set('orgId', filters.orgId);
  if (filters.businessUnitId) params.set('businessUnitId', filters.businessUnitId);
  const qs = params.toString() ? `?${params.toString()}` : '';
  return apiGet<SalesOffice[]>(`/api/sales-offices${qs}`);
}

export async function createSalesOffice(payload: {
  orgId: string;
  businessUnitId: string;
  name: string;
  salesOfficeCode: string;
  externalSalesOfficeId?: string | null;
}) {
  return apiPost<SalesOffice>('/api/sales-offices', payload as Record<string, unknown>);
}

export async function updateSalesOffice(id: string, payload: Partial<SalesOffice>) {
  return apiPatch<SalesOffice>(`/api/sales-offices/${encodeURIComponent(id)}`, payload as Record<string, unknown>);
}

export async function deleteSalesOffice(id: string) {
  return apiDelete(`/api/sales-offices/${encodeURIComponent(id)}`);
}

// ── Plants ────────────────────────────────────────────────────────────────────

export async function listPlants(filters: { orgId?: string; businessUnitId?: string; salesOfficeId?: string } = {}) {
  const params = new URLSearchParams();
  if (filters.orgId) params.set('orgId', filters.orgId);
  if (filters.businessUnitId) params.set('businessUnitId', filters.businessUnitId);
  if (filters.salesOfficeId) params.set('salesOfficeId', filters.salesOfficeId);
  const qs = params.toString() ? `?${params.toString()}` : '';
  return apiGet<Plant[]>(`/api/plants${qs}`);
}

export async function createPlant(payload: {
  orgId: string;
  businessUnitId: string;
  salesOfficeId: string;
  name: string;
  plantCode: string;
  externalPlantId?: string | null;
}) {
  return apiPost<Plant>('/api/plants', payload as Record<string, unknown>);
}

export async function updatePlant(id: string, payload: Partial<Plant>) {
  return apiPatch<Plant>(`/api/plants/${encodeURIComponent(id)}`, payload as Record<string, unknown>);
}

export async function deletePlant(id: string) {
  return apiDelete(`/api/plants/${encodeURIComponent(id)}`);
}
