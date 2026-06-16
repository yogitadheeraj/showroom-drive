import { apiDelete, apiGet, apiPost } from '@/lib/apiClient';

export interface LocationBlockedSlot {
  id: string;
  location_id: string;
  blocked_date: string;
  start_time: string;
  end_time: string;
  reason: string | null;
  block_source: 'manual' | 'special_period' | 'system';
  created_by_profile_id: string | null;
  created_at: string;
}

export interface BlockedSlotWithConflicts extends LocationBlockedSlot {
  affected_bookings: Array<{
    id: string;
    scheduled_time: string;
    slot_duration_minutes: number;
    status: string;
    customer_id: string;
  }>;
}

export type CreateBlockedSlotPayload = {
  location_id: string;
  blocked_date: string;
  start_time: string;
  end_time: string;
  reason?: string | null;
  block_source?: 'manual' | 'special_period' | 'system';
};

function qs(params: Record<string, string | undefined>) {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) q.set(key, value);
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

export async function listLocationBlockedSlots(params: {
  location_id?: string;
  blocked_date?: string;
  from_date?: string;
  to_date?: string;
}) {
  return apiGet<LocationBlockedSlot[]>(
    `/api/location-blocked-slots${qs({
      location_id: params.location_id,
      blocked_date: params.blocked_date,
      from_date: params.from_date,
      to_date: params.to_date,
    })}`,
  );
}

export async function createLocationBlockedSlot(payload: CreateBlockedSlotPayload) {
  return apiPost<BlockedSlotWithConflicts>(
    '/api/location-blocked-slots',
    payload as Record<string, unknown>,
  );
}

export async function cancelConflictsForBlockedSlot(slotId: string, reason?: string) {
  return apiPost<{ cancelled: string[] }>(
    `/api/location-blocked-slots/${encodeURIComponent(slotId)}/cancel-conflicts`,
    { reason: reason ?? '' },
  );
}

export async function deleteLocationBlockedSlot(id: string) {
  return apiDelete<LocationBlockedSlot>(`/api/location-blocked-slots/${encodeURIComponent(id)}`);
}
