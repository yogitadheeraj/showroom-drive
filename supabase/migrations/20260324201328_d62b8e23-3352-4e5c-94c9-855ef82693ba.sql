
-- Sales users can view all roles (needed for swap dropdown to find other sales users)
CREATE POLICY "Sales can view all roles" ON public.user_roles
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'sales'::app_role));

-- Sales users can view profiles at their own location (needed for swap dropdown)
CREATE POLICY "Sales can view location profiles" ON public.profiles
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'sales'::app_role)
  AND location_id = (SELECT p.location_id FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1)
);
