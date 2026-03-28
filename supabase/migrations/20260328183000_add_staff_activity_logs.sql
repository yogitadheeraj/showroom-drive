CREATE TABLE IF NOT EXISTS public.staff_activity_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  role public.app_role,
  login_at timestamptz NOT NULL DEFAULT now(),
  logout_at timestamptz,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  active_seconds integer NOT NULL DEFAULT 0,
  idle_seconds integer NOT NULL DEFAULT 0,
  is_online boolean NOT NULL DEFAULT true,
  session_source text NOT NULL DEFAULT 'web',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.staff_activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES public.staff_activity_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  role public.app_role,
  event_type text NOT NULL,
  event_label text NOT NULL,
  route text,
  metadata jsonb,
  happened_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_activity_sessions_user_id ON public.staff_activity_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_activity_sessions_location_id ON public.staff_activity_sessions(location_id);
CREATE INDEX IF NOT EXISTS idx_staff_activity_sessions_login_at ON public.staff_activity_sessions(login_at DESC);
CREATE INDEX IF NOT EXISTS idx_staff_activity_events_user_id ON public.staff_activity_events(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_activity_events_session_id ON public.staff_activity_events(session_id);
CREATE INDEX IF NOT EXISTS idx_staff_activity_events_location_id ON public.staff_activity_events(location_id);
CREATE INDEX IF NOT EXISTS idx_staff_activity_events_happened_at ON public.staff_activity_events(happened_at DESC);

ALTER TABLE public.staff_activity_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_activity_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own activity sessions"
ON public.staff_activity_sessions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own activity sessions"
ON public.staff_activity_sessions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authorized users can view activity sessions"
ON public.staff_activity_sessions
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('superadmin', 'dealer_admin')
  )
);

CREATE POLICY "Users can insert their own activity events"
ON public.staff_activity_events
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authorized users can view activity events"
ON public.staff_activity_events
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('superadmin', 'dealer_admin')
  )
);

CREATE OR REPLACE FUNCTION public.set_staff_activity_session_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_staff_activity_sessions_updated_at ON public.staff_activity_sessions;
CREATE TRIGGER trg_staff_activity_sessions_updated_at
BEFORE UPDATE ON public.staff_activity_sessions
FOR EACH ROW
EXECUTE FUNCTION public.set_staff_activity_session_updated_at();