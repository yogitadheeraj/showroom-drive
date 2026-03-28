
-- Create location_special_periods table
CREATE TABLE public.location_special_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_full_closure boolean NOT NULL DEFAULT true,
  modified_open_time time without time zone,
  modified_close_time time without time zone,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.location_special_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view special periods" ON public.location_special_periods FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Superadmin can manage special periods" ON public.location_special_periods FOR ALL TO authenticated USING (has_role(auth.uid(), 'superadmin'::app_role)) WITH CHECK (has_role(auth.uid(), 'superadmin'::app_role));
CREATE POLICY "Dealer admin can manage special periods" ON public.location_special_periods FOR ALL TO authenticated USING (has_role(auth.uid(), 'dealer_admin'::app_role) AND location_id IN (SELECT id FROM locations WHERE dealer_id = get_user_dealer_id(auth.uid()))) WITH CHECK (has_role(auth.uid(), 'dealer_admin'::app_role) AND location_id IN (SELECT id FROM locations WHERE dealer_id = get_user_dealer_id(auth.uid())));
CREATE POLICY "GRO can manage special periods for their location" ON public.location_special_periods FOR ALL TO authenticated USING (has_role(auth.uid(), 'gro'::app_role) AND location_id = get_user_location_id(auth.uid())) WITH CHECK (has_role(auth.uid(), 'gro'::app_role) AND location_id = get_user_location_id(auth.uid()));

-- Create location_devices table
CREATE TABLE public.location_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  name text NOT NULL,
  device_type text NOT NULL DEFAULT 'tablet',
  serial_number text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.location_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view devices" ON public.location_devices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Superadmin can manage devices" ON public.location_devices FOR ALL TO authenticated USING (has_role(auth.uid(), 'superadmin'::app_role)) WITH CHECK (has_role(auth.uid(), 'superadmin'::app_role));
CREATE POLICY "Dealer admin can manage devices" ON public.location_devices FOR ALL TO authenticated USING (has_role(auth.uid(), 'dealer_admin'::app_role) AND location_id IN (SELECT id FROM locations WHERE dealer_id = get_user_dealer_id(auth.uid()))) WITH CHECK (has_role(auth.uid(), 'dealer_admin'::app_role) AND location_id IN (SELECT id FROM locations WHERE dealer_id = get_user_dealer_id(auth.uid())));
