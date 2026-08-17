import type { AppRole } from '@/constants/roles';
import { apiPost, apiPatch } from '@/lib/apiClient';

const ACTIVITY_SESSION_KEY = 'staff_activity_session_id_v1';

export type StaffActivityEventType =
  | 'login'
  | 'logout'
  | 'page_view'
  | 'idle_start'
  | 'active_resume'
  | 'test_drive_started'
  | 'test_drive_completed'
  | 'test_drive_check_in'
  | 'test_drive_check_out'
  | 'test_drive_rescheduled'
  | 'test_drive_reassigned'
  | 'test_drive_swapped'
  | 'vehicle_inspection_pre'
  | 'vehicle_inspection_post'
  | 'license_uploaded'
  | 'license_verified'
  | 'license_rejected'
  | 'location_hours_updated'
  | 'location_device_added'
  | 'location_device_deleted'
  | 'communication_logged'
  | 'customer_created'
  | 'customer_updated'
  | 'customer_deleted'
  | 'booking_created'
  | 'car_booking_created'
  | 'booking_updated'
  | 'booking_cancelled'
  | 'booking_refunded'
  | 'user_created'
  | 'user_updated'
  | 'user_deleted'
  | 'report_generated'
  | 'report_viewed'
  | 'car_booking_cancelled'
  | 'car_booking_refunded'
  | 'opportunity_created'
  | 'opportunity_updated'
  | 'opportunity_won'
  | 'opportunity_lost'
  | 'note_added'
  | 'note_deleted'
  | 'transit_scheduled'
  | 'transit_dispatched'
  | 'transit_cancelled'
  | 'transit_receiver_assigned'
  | 'transit_received'
  | 'transit_arrived'
  | 'transit_request_created'
  | 'transit_request_approved'
  | 'transit_request_rejected'
  | 'transit_request_cancelled'
  | 'test_drive_cancelled'
  | 'test_drive_no_show'
  | 'test_drive_key_assigned'
  | 'test_drive_status_changed'
  | 'test_drive_opportunity_created'
  | 'vehicle_created'
  | 'vehicle_updated'
  | 'vehicle_deactivated'
  | 'vehicle_reactivated'
  | 'walkin_registered'
  | 'enquiry_replied'
  | 'enquiry_message_edited'
  | 'user_role_updated'
  | 'user_blocked'
  | 'user_unblocked'
  | 'user_leave_set'
  | 'user_leave_cleared'
  | 'profile_password_changed'
  | 'profile_leave_set'
  | 'profile_available_set'
  | 'other'
  ;

type ActivityIdentity = {
  userId: string;
  profileId?: string | null;
  locationId?: string | null;
  role?: AppRole | null;
};

type ActivityPayload = ActivityIdentity & {
  eventType: StaffActivityEventType;
  label: string;
  route?: string | null;
  metadata?: Record<string, unknown> | null;
  sessionId?: string | null;
};

const hasWindow = () => typeof window !== 'undefined';

export const getStoredActivitySessionId = () => {
  if (!hasWindow()) return null;
  return window.localStorage.getItem(ACTIVITY_SESSION_KEY);
};

const setStoredActivitySessionId = (sessionId: string | null) => {
  if (!hasWindow()) return;
  if (sessionId) {
    window.localStorage.setItem(ACTIVITY_SESSION_KEY, sessionId);
  } else {
    window.localStorage.removeItem(ACTIVITY_SESSION_KEY);
  }
};

export const ensureActivitySession = async ({ userId, profileId, locationId, role }: ActivityIdentity) => {
  const existingSessionId = getStoredActivitySessionId();
  if (existingSessionId) return existingSessionId;

  try {
    const data = await apiPost<{ id: string }>('/api/activity/sessions', {
      user_id: userId,
      profile_id: profileId ?? null,
      location_id: locationId ?? null,
      role: role ?? null,
      login_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
      is_online: true,
      session_source: 'web',
    });

    if (!data?.id) return null;
    setStoredActivitySessionId(data.id);

    await apiPost('/api/activity/events', {
      session_id: data.id,
      user_id: userId,
      profile_id: profileId ?? null,
      location_id: locationId ?? null,
      role: role ?? null,
      event_type: 'login',
      event_label: 'Logged in',
      happened_at: new Date().toISOString(),
    }).catch(() => null);

    return data.id;
  } catch (err) {
    console.error('Failed to create activity session', err);
    return null;
  }
};

export const logStaffActivity = async ({
  userId,
  profileId,
  locationId,
  role,
  eventType,
  label,
  route,
  metadata,
  sessionId,
}: ActivityPayload) => {
  const resolvedSessionId = sessionId ?? (await ensureActivitySession({ userId, profileId, locationId, role }));
  if (!resolvedSessionId) return;

  const now = new Date().toISOString();

  const eventPayload = {
    session_id: resolvedSessionId,
    user_id: userId,
    profile_id: profileId ?? null,
    location_id: locationId ?? null,
    role: role ?? null,
    event_type: eventType,
    event_label: label,
    route: route ?? null,
    metadata: metadata ?? null,
    happened_at: now,
  };

  const [eventResult, sessionResult] = await Promise.allSettled([
    apiPost('/api/activity/events', eventPayload),
    apiPatch(`/api/activity/sessions/${resolvedSessionId}/touch`, {
      active_seconds: 0,
      idle_seconds: 0,
      last_seen_at: now,
      is_online: true,
    }),
  ]);

  if (eventResult.status === 'rejected') console.error('Failed to log staff activity', eventResult.reason);
  if (sessionResult.status === 'rejected') console.error('Failed to update activity session', sessionResult.reason);

  // Mirror to MongoDB (backend API) so apiDbQuery-based readers (e.g. ActivityInsightsMini) see the event.
  apiPost('/api/activity/events', eventPayload).catch((err) =>
    console.error('Failed to mirror activity event to API', err)
  );
};

export const updateActivitySession = async (
  updates: {
    activeSeconds?: number;
    idleSeconds?: number;
    lastSeenAt?: string;
    isOnline?: boolean;
  },
) => {
  const sessionId = getStoredActivitySessionId();
  if (!sessionId) return;

  await apiPatch(`/api/activity/sessions/${sessionId}/touch`, {
    active_seconds: updates.activeSeconds ?? 0,
    idle_seconds: updates.idleSeconds ?? 0,
    last_seen_at: updates.lastSeenAt ?? new Date().toISOString(),
    is_online: updates.isOnline ?? true,
  }).catch((err) => console.error('Failed to update activity session', err));
};

export const endActivitySession = async ({
  userId,
  profileId,
  locationId,
  role,
  label = 'Logged out',
}: ActivityIdentity & { label?: string }) => {
  const sessionId = getStoredActivitySessionId();
  if (!sessionId) return;

  const now = new Date().toISOString();

  await Promise.allSettled([
    apiPost('/api/activity/events', {
      session_id: sessionId,
      user_id: userId,
      profile_id: profileId ?? null,
      location_id: locationId ?? null,
      role: role ?? null,
      event_type: 'logout',
      event_label: label,
      happened_at: now,
    }),
    apiPatch(`/api/activity/sessions/${sessionId}/end`, {}),
  ]);

  setStoredActivitySessionId(null);
};