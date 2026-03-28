-- Special periods (Ramadan, holidays, etc.) that override regular operating hours
CREATE TABLE public.location_special_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  name text NOT NULL,                    -- e.g. "Ramadan 2026", "Eid Holiday", "Christmas Break"
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_full_closure boolean NOT NULL DEFAULT false,  -- true = closed all day; false = modified hours
  modified_open_time time,               -- used when is_full_closure = false
  modified_close_time time,              -- used when is_full_closure = false
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);

ALTER TABLE public.location_special_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view special periods"
  ON public.location_special_periods FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "Superadmin can manage special periods"
  ON public.location_special_periods FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'superadmin'))
  WITH CHECK (has_role(auth.uid(), 'superadmin'));

CREATE POLICY "Dealer admin can manage special periods for their locations"
  ON public.location_special_periods FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'dealer_admin') AND
    location_id IN (
      SELECT l.id FROM public.locations l
      WHERE l.dealer_id IN (
        SELECT dealer_id FROM public.profiles WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    has_role(auth.uid(), 'dealer_admin') AND
    location_id IN (
      SELECT l.id FROM public.locations l
      WHERE l.dealer_id IN (
        SELECT dealer_id FROM public.profiles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "GRO can manage special periods for their location"
  ON public.location_special_periods FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'gro') AND location_id = get_user_location_id(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'gro') AND location_id = get_user_location_id(auth.uid()));
