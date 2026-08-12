import { apiGet, apiPatch, apiPost, apiPut } from '@/lib/apiClient';

export interface TimesheetReminderConfig {
  id: string;
  location_id: string;
  dealer_id: string | null;
  reminder_enabled: boolean;
  reminder_offsets_minutes: number[];
  reminder_message: string;
  timezone: string;
  grace_after_due_minutes: number;
  escalate_to_manager: boolean;
  updated_by_profile_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TimesheetTask {
  id: string;
  user_id: string;
  profile_id: string | null;
  location_id: string;
  dealer_id: string | null;
  task_title: string;
  due_at: string;
  status: 'pending' | 'submitted' | 'missed' | 'cancelled';
  submitted_at: string | null;
  sent_offsets: number[];
  last_reminder_at: string | null;
  escalated_at: string | null;
  metadata: Record<string, unknown> | null;
  created_by_profile_id: string | null;
  created_at: string;
  updated_at: string;
}

export async function getTimesheetReminderConfig(locationId: string) {
  return apiGet<TimesheetReminderConfig>(`/api/timesheet-reminder-config/${encodeURIComponent(locationId)}`);
}

export async function upsertTimesheetReminderConfig(payload: Partial<TimesheetReminderConfig> & { location_id: string }) {
  return apiPut<TimesheetReminderConfig>('/api/timesheet-reminder-config', payload as Record<string, unknown>);
}

export async function listTimesheetTasks(params: {
  location_id?: string;
  status?: string;
  assignee_user_id?: string;
  from_due_at?: string;
  to_due_at?: string;
  limit?: number;
} = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') search.set(k, String(v));
  });
  return apiGet<TimesheetTask[]>(`/api/timesheet-tasks?${search.toString()}`);
}

export async function createTimesheetTask(payload: Record<string, unknown>) {
  return apiPost<TimesheetTask>('/api/timesheet-tasks', payload);
}

export async function updateTimesheetTask(id: string, payload: Record<string, unknown>) {
  return apiPatch<TimesheetTask>(`/api/timesheet-tasks/${encodeURIComponent(id)}`, payload);
}

export async function submitTimesheetTask(id: string) {
  return apiPost<TimesheetTask>(`/api/timesheet-tasks/${encodeURIComponent(id)}/submit`, {});
}
