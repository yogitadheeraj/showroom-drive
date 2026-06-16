import { apiDelete, apiGet, apiPut } from '@/lib/apiClient';

export interface FollowUpReminderConfig {
  id: string;
  location_id: string;
  dealer_id: string | null;
  reminder_enabled: boolean;
  reminder_before_minutes: number;
  reminder_message: string;
  tone_type: 'classic' | 'soft' | 'alert';
  notify_due_list: boolean;
  updated_by_profile_id: string | null;
  created_at: string;
  updated_at: string;
}

export type FollowUpReminderConfigPayload = Pick<
  FollowUpReminderConfig,
  | 'location_id'
  | 'dealer_id'
  | 'reminder_enabled'
  | 'reminder_before_minutes'
  | 'reminder_message'
  | 'tone_type'
  | 'notify_due_list'
  | 'updated_by_profile_id'
>;

export async function getFollowUpReminderConfig(locationId: string) {
  return apiGet<FollowUpReminderConfig>(`/api/follow-up-reminder-config/${encodeURIComponent(locationId)}`);
}

export async function upsertFollowUpReminderConfig(payload: Partial<FollowUpReminderConfigPayload> & { location_id: string }) {
  return apiPut<FollowUpReminderConfig>('/api/follow-up-reminder-config', payload as Record<string, unknown>);
}

export async function deleteFollowUpReminderConfig(locationId: string) {
  return apiDelete<FollowUpReminderConfig>(`/api/follow-up-reminder-config/${encodeURIComponent(locationId)}`);
}
