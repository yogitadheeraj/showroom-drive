
-- Update the trigger function to assign dealer_admin instead of superadmin
CREATE OR REPLACE FUNCTION public.handle_dealer_admin_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.admin_user_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.admin_user_id, 'dealer_admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- Dealers: dealer_admin can update own dealer
CREATE POLICY "Dealer admin can update own dealer"
ON public.dealers FOR UPDATE TO authenticated
USING (admin_user_id = auth.uid())
WITH CHECK (admin_user_id = auth.uid());

-- Locations: dealer_admin can manage their dealer's locations
CREATE POLICY "Dealer admin can update locations"
ON public.locations FOR UPDATE TO authenticated
USING (dealer_id = get_user_dealer_id(auth.uid()))
WITH CHECK (dealer_id = get_user_dealer_id(auth.uid()));

CREATE POLICY "Dealer admin can delete locations"
ON public.locations FOR DELETE TO authenticated
USING (dealer_id = get_user_dealer_id(auth.uid()));

-- Vehicles: dealer_admin can manage
CREATE POLICY "Dealer admin can manage vehicles"
ON public.vehicles FOR ALL TO authenticated
USING (has_role(auth.uid(), 'dealer_admin') AND location_id IN (SELECT id FROM locations WHERE dealer_id = get_user_dealer_id(auth.uid())))
WITH CHECK (has_role(auth.uid(), 'dealer_admin') AND location_id IN (SELECT id FROM locations WHERE dealer_id = get_user_dealer_id(auth.uid())));

-- Brands: dealer_admin can manage
CREATE POLICY "Dealer admin can update brands"
ON public.brands FOR UPDATE TO authenticated
USING (dealer_id = get_user_dealer_id(auth.uid()))
WITH CHECK (dealer_id = get_user_dealer_id(auth.uid()));

CREATE POLICY "Dealer admin can delete brands"
ON public.brands FOR DELETE TO authenticated
USING (dealer_id = get_user_dealer_id(auth.uid()));

-- Profiles: dealer_admin can view/manage at their locations
CREATE POLICY "Dealer admin can view profiles"
ON public.profiles FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'dealer_admin') AND location_id IN (SELECT id FROM locations WHERE dealer_id = get_user_dealer_id(auth.uid())));

CREATE POLICY "Dealer admin can manage profiles"
ON public.profiles FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'dealer_admin') AND location_id IN (SELECT id FROM locations WHERE dealer_id = get_user_dealer_id(auth.uid())))
WITH CHECK (has_role(auth.uid(), 'dealer_admin') AND location_id IN (SELECT id FROM locations WHERE dealer_id = get_user_dealer_id(auth.uid())));

-- User roles: dealer_admin can manage roles for their staff
CREATE POLICY "Dealer admin can view roles"
ON public.user_roles FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'dealer_admin') AND user_id IN (
  SELECT p.user_id FROM profiles p WHERE p.location_id IN (SELECT id FROM locations WHERE dealer_id = get_user_dealer_id(auth.uid()))
));

CREATE POLICY "Dealer admin can manage roles"
ON public.user_roles FOR ALL TO authenticated
USING (has_role(auth.uid(), 'dealer_admin') AND user_id IN (
  SELECT p.user_id FROM profiles p WHERE p.location_id IN (SELECT id FROM locations WHERE dealer_id = get_user_dealer_id(auth.uid()))
))
WITH CHECK (has_role(auth.uid(), 'dealer_admin') AND user_id IN (
  SELECT p.user_id FROM profiles p WHERE p.location_id IN (SELECT id FROM locations WHERE dealer_id = get_user_dealer_id(auth.uid()))
));

-- Blocked slots: dealer_admin can manage
CREATE POLICY "Dealer admin can manage blocked slots"
ON public.location_blocked_slots FOR ALL TO authenticated
USING (has_role(auth.uid(), 'dealer_admin') AND location_id IN (SELECT id FROM locations WHERE dealer_id = get_user_dealer_id(auth.uid())))
WITH CHECK (has_role(auth.uid(), 'dealer_admin') AND location_id IN (SELECT id FROM locations WHERE dealer_id = get_user_dealer_id(auth.uid())));

-- Operating hours: dealer_admin can manage
CREATE POLICY "Dealer admin can manage operating hours"
ON public.location_operating_hours FOR ALL TO authenticated
USING (has_role(auth.uid(), 'dealer_admin') AND location_id IN (SELECT id FROM locations WHERE dealer_id = get_user_dealer_id(auth.uid())))
WITH CHECK (has_role(auth.uid(), 'dealer_admin') AND location_id IN (SELECT id FROM locations WHERE dealer_id = get_user_dealer_id(auth.uid())));
