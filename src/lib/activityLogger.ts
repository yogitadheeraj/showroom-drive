import { supabase } from '@/integrations/supabase/client';
import type { AppRole } from '@/constants/roles';

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

  const { data, error } = await supabase
    .from('staff_activity_sessions')
    .insert({
      user_id: userId,
      profile_id: profileId ?? null,
      location_id: locationId ?? null,
      role: role ?? null,
      login_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
      is_online: true,
      session_source: 'web',
    } as never)
    .select('id')
    .single();

  if (error || !data?.id) {
    console.error('Failed to create activity session', error);
    return null;
  }

  setStoredActivitySessionId(data.id);

  await supabase.from('staff_activity_events').insert({
    session_id: data.id,
    user_id: userId,
    profile_id: profileId ?? null,
    location_id: locationId ?? null,
    role: role ?? null,
    event_type: 'login',
    event_label: 'Logged in',
    happened_at: new Date().toISOString(),
  } as never);

  return data.id;
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

  const [{ error: eventError }, { error: sessionError }] = await Promise.all([
    supabase.from('staff_activity_events').insert({
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
    } as never),
    supabase.from('staff_activity_sessions').update({
      last_seen_at: now,
      is_online: true,
    } as never).eq('id', resolvedSessionId),
  ]);

  if (eventError) console.error('Failed to log staff activity', eventError);
  if (sessionError) console.error('Failed to update activity session', sessionError);
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

  const { data: existing, error: fetchError } = await supabase
    .from('staff_activity_sessions')
    .select('active_seconds, idle_seconds')
    .eq('id', sessionId)
    .maybeSingle();

  if (fetchError || !existing) return;

  const { error } = await supabase.from('staff_activity_sessions').update({
    active_seconds: (existing.active_seconds || 0) + (updates.activeSeconds || 0),
    idle_seconds: (existing.idle_seconds || 0) + (updates.idleSeconds || 0),
    last_seen_at: updates.lastSeenAt ?? new Date().toISOString(),
    is_online: updates.isOnline ?? true,
  } as never).eq('id', sessionId);

  if (error) console.error('Failed to update activity session durations', error);
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

  const [{ error: eventError }, { error: sessionError }] = await Promise.all([
    supabase.from('staff_activity_events').insert({
      session_id: sessionId,
      user_id: userId,
      profile_id: profileId ?? null,
      location_id: locationId ?? null,
      role: role ?? null,
      event_type: 'logout',
      event_label: label,
      happened_at: now,
    } as never),
    supabase.from('staff_activity_sessions').update({
      logout_at: now,
      last_seen_at: now,
      is_online: false,
    } as never).eq('id', sessionId),
  ]);

  if (eventError) console.error('Failed to log logout', eventError);
  if (sessionError) console.error('Failed to close activity session', sessionError);

  setStoredActivitySessionId(null);
};