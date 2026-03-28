
-- Create staff_activity_sessions table
CREATE TABLE public.staff_activity_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  role text,
  login_at timestamp with time zone NOT NULL DEFAULT now(),
  logout_at timestamp with time zone,
  last_seen_at timestamp with time zone NOT NULL DEFAULT now(),
  is_online boolean NOT NULL DEFAULT true,
  session_source text DEFAULT 'web',
  active_seconds integer NOT NULL DEFAULT 0,
  idle_seconds integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.staff_activity_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view sessions" ON public.staff_activity_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert sessions" ON public.staff_activity_sessions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update own sessions" ON public.staff_activity_sessions FOR UPDATE TO authenticated USING (true);

-- Create staff_activity_events table
CREATE TABLE public.staff_activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES public.staff_activity_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  role text,
  event_type text NOT NULL,
  event_label text,
  route text,
  metadata jsonb,
  happened_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.staff_activity_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view events" ON public.staff_activity_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert events" ON public.staff_activity_events FOR INSERT TO authenticated WITH CHECK (true);
