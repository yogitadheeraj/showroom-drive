
-- Vehicle Reservations table
CREATE TABLE public.vehicle_reservations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  reserved_by_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  reservation_type TEXT NOT NULL DEFAULT 'internal' CHECK (reservation_type IN ('internal', 'customer')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled', 'converted')),
  reserved_from TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reserved_until TIMESTAMP WITH TIME ZONE NOT NULL,
  deposit_amount NUMERIC(12,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Pricing Rules table
CREATE TABLE public.pricing_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dealer_id UUID REFERENCES public.dealers(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE,
  brand TEXT,
  model TEXT,
  variant TEXT,
  rule_type TEXT NOT NULL DEFAULT 'base' CHECK (rule_type IN ('base', 'variant', 'dynamic', 'seasonal')),
  base_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  adjusted_price NUMERIC(14,2),
  adjustment_percent NUMERIC(5,2),
  season_name TEXT,
  valid_from DATE,
  valid_until DATE,
  conditions JSONB DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Pricing Discounts / Promos table
CREATE TABLE public.pricing_discounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dealer_id UUID REFERENCES public.dealers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  discount_type TEXT NOT NULL DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'flat', 'cashback')),
  discount_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  max_discount_amount NUMERIC(12,2),
  applicable_brands TEXT[],
  applicable_models TEXT[],
  min_base_price NUMERIC(14,2) DEFAULT 0,
  usage_limit INTEGER,
  used_count INTEGER NOT NULL DEFAULT 0,
  valid_from DATE,
  valid_until DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS for vehicle_reservations
ALTER TABLE public.vehicle_reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view reservations" ON public.vehicle_reservations
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Staff can create reservations" ON public.vehicle_reservations
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Staff can update reservations" ON public.vehicle_reservations
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Superadmin can delete reservations" ON public.vehicle_reservations
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'superadmin'::app_role));

CREATE POLICY "Anon can view reservations" ON public.vehicle_reservations
  FOR SELECT TO anon USING (reservation_type = 'customer');

CREATE POLICY "Anon can create customer reservations" ON public.vehicle_reservations
  FOR INSERT TO anon WITH CHECK (reservation_type = 'customer');

-- RLS for pricing_rules
ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active pricing rules" ON public.pricing_rules
  FOR SELECT TO anon USING (is_active = true);

CREATE POLICY "Authenticated can view pricing rules" ON public.pricing_rules
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Dealer admin can manage pricing rules" ON public.pricing_rules
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'dealer_admin'::app_role) AND dealer_id = get_user_dealer_id(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'dealer_admin'::app_role) AND dealer_id = get_user_dealer_id(auth.uid()));

CREATE POLICY "Superadmin can manage pricing rules" ON public.pricing_rules
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'superadmin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'superadmin'::app_role));

-- RLS for pricing_discounts
ALTER TABLE public.pricing_discounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active discounts" ON public.pricing_discounts
  FOR SELECT TO anon USING (is_active = true);

CREATE POLICY "Authenticated can view discounts" ON public.pricing_discounts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Dealer admin can manage discounts" ON public.pricing_discounts
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'dealer_admin'::app_role) AND dealer_id = get_user_dealer_id(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'dealer_admin'::app_role) AND dealer_id = get_user_dealer_id(auth.uid()));

CREATE POLICY "Superadmin can manage discounts" ON public.pricing_discounts
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'superadmin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'superadmin'::app_role));

-- Updated_at triggers
CREATE TRIGGER update_vehicle_reservations_updated_at BEFORE UPDATE ON public.vehicle_reservations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pricing_rules_updated_at BEFORE UPDATE ON public.pricing_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pricing_discounts_updated_at BEFORE UPDATE ON public.pricing_discounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
