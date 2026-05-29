import { apiGet, apiPost } from '@/lib/apiClient';

type OperatingHourRow = {
  id?: string | null;
  location_id?: string;
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_closed: boolean;
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

export async function listLocationOperatingHours(params: {
  locationId?: string;
  locationIds?: string[];
  dayOfWeek?: number;
}) {
  const qs = queryString({
    location_id: params.locationId,
    location_ids: params.locationIds && params.locationIds.length > 0 ? params.locationIds.join(',') : undefined,
    day_of_week: typeof params.dayOfWeek === 'number' ? String(params.dayOfWeek) : undefined,
  });

  return apiGet<any[]>(`/api/location-operating-hours${qs}`);
}

export async function bulkUpsertLocationOperatingHours(locationId: string, hours: OperatingHourRow[]) {
  return apiPost<any[]>('/api/location-operating-hours/bulk-upsert', {
    location_id: locationId,
    hours: hours.map((hour) => ({
      id: hour.id || undefined,
      day_of_week: hour.day_of_week,
      open_time: hour.open_time,
      close_time: hour.close_time,
      is_closed: hour.is_closed,
    })),
  });
}
