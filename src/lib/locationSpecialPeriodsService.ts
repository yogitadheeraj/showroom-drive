import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/apiClient';

type SpecialPeriodPayload = {
  location_id?: string;
  name: string;
  start_date: string;
  end_date: string;
  is_full_closure: boolean;
  modified_open_time: string | null;
  modified_close_time: string | null;
  notes: string | null;
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

export async function listLocationSpecialPeriods(params: {
  location_id?: string;
  start_date?: string;
  end_date?: string;
}) {
  const qs = queryString({
    location_id: params.location_id,
    start_date: params.start_date,
    end_date: params.end_date,
  });

  return apiGet<any[]>(`/api/location-special-periods${qs}`);
}

export async function createLocationSpecialPeriod(payload: SpecialPeriodPayload) {
  return apiPost<any>('/api/location-special-periods', payload as Record<string, unknown>);
}

export async function updateLocationSpecialPeriod(id: string, payload: SpecialPeriodPayload) {
  return apiPatch<any>(`/api/location-special-periods/${encodeURIComponent(id)}`, payload as Record<string, unknown>);
}

export async function deleteLocationSpecialPeriod(id: string) {
  return apiDelete<any>(`/api/location-special-periods/${encodeURIComponent(id)}`);
}
