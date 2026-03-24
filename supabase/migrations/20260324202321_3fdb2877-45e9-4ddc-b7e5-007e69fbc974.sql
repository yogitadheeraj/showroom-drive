
DROP POLICY IF EXISTS "Sales can view location profiles" ON public.profiles;
DROP POLICY IF EXISTS "GRO can view location profiles" ON public.profiles;

CREATE OR REPLACE FUNCTION public.get_user_location_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT location_id FROM public.profiles WHERE user_id = _user_id LIMIT 1
$$;

CREATE POLICY "GRO can view location profiles" ON public.profiles
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'gro'::app_role)
  AND location_id = get_user_location_id(auth.uid())
);

CREATE POLICY "Sales can view location profiles" ON public.profiles
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'sales'::app_role)
  AND location_id = get_user_location_id(auth.uid())
);
