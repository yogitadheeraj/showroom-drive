
CREATE TABLE public.location_operating_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL,
  open_time time NOT NULL DEFAULT '09:00',
  close_time time NOT NULL DEFAULT '19:00',
  is_closed boolean NOT NULL DEFAULT false,
  UNIQUE (location_id, day_of_week)
);

ALTER TABLE public.location_operating_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view operating hours" ON public.location_operating_hours
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Superadmin can manage operating hours" ON public.location_operating_hours
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'superadmin'))
  WITH CHECK (has_role(auth.uid(), 'superadmin'));

CREATE TABLE public.location_blocked_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  blocked_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  reason text,
  block_source text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.location_blocked_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view blocked slots" ON public.location_blocked_slots
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Superadmin can manage blocked slots" ON public.location_blocked_slots
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'superadmin'))
  WITH CHECK (has_role(auth.uid(), 'superadmin'));

CREATE POLICY "GRO can manage blocked slots for their location" ON public.location_blocked_slots
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'gro') AND location_id = get_user_location_id(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'gro') AND location_id = get_user_location_id(auth.uid()));

CREATE OR REPLACE FUNCTION public.auto_release_noshow_vehicles()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.test_drives
  SET status = 'no_show', updated_at = now()
  WHERE status = 'scheduled'
    AND (scheduled_date < CURRENT_DATE
      OR (scheduled_date = CURRENT_DATE 
          AND scheduled_time < (CURRENT_TIME - interval '15 minutes')));
END;
$$
