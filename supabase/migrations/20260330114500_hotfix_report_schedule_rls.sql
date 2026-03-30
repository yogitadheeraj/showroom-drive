-- Urgent hotfix: allow dealer admins to insert/update report schedules for their dealer locations.
-- This resolves: new row violates row-level security policy for table report_schedule_config

DROP POLICY IF EXISTS "Dealers can manage their location's schedule config" ON public.report_schedule_config;
DROP POLICY IF EXISTS "Users can view their location's schedule config" ON public.report_schedule_config;

CREATE POLICY "Dealers can manage their location's schedule config"
ON public.report_schedule_config
FOR ALL
TO authenticated
USING (
  -- Staff users mapped by profile -> location
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.location_id = report_schedule_config.location_id
  )
  -- Dealer admins mapped by dealer ownership of location
  OR (
    has_role(auth.uid(), 'dealer_admin'::public.app_role)
    AND report_schedule_config.location_id IN (
      SELECT l.id
      FROM public.locations l
      WHERE l.dealer_id = get_user_dealer_id(auth.uid())
    )
  )
  -- Superadmin fallback
  OR EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'superadmin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.location_id = report_schedule_config.location_id
  )
  OR (
    has_role(auth.uid(), 'dealer_admin'::public.app_role)
    AND report_schedule_config.location_id IN (
      SELECT l.id
      FROM public.locations l
      WHERE l.dealer_id = get_user_dealer_id(auth.uid())
    )
  )
  OR EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'superadmin'
  )
);

CREATE POLICY "Users can view their location's schedule config"
ON public.report_schedule_config
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.location_id = report_schedule_config.location_id
  )
  OR (
    has_role(auth.uid(), 'dealer_admin'::public.app_role)
    AND report_schedule_config.location_id IN (
      SELECT l.id
      FROM public.locations l
      WHERE l.dealer_id = get_user_dealer_id(auth.uid())
    )
  )
  OR EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'superadmin'
  )
);
