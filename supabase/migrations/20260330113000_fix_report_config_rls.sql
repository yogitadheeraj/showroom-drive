-- Fix RLS policies for report config tables.
-- Root causes fixed:
-- 1) profiles.id was compared with auth.uid() (should be profiles.user_id)
-- 2) location_id was unqualified inside subqueries

-- report_email_config
DROP POLICY IF EXISTS "Dealers can manage their location's email config" ON public.report_email_config;
DROP POLICY IF EXISTS "Users can view their location's email config" ON public.report_email_config;

CREATE POLICY "Dealers can manage their location's email config"
ON public.report_email_config
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.location_id = report_email_config.location_id
  )
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
      AND p.location_id = report_email_config.location_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'superadmin'
  )
);

CREATE POLICY "Users can view their location's email config"
ON public.report_email_config
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.location_id = report_email_config.location_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'superadmin'
  )
);

-- report_schedule_config
DROP POLICY IF EXISTS "Dealers can manage their location's schedule config" ON public.report_schedule_config;
DROP POLICY IF EXISTS "Users can view their location's schedule config" ON public.report_schedule_config;

CREATE POLICY "Dealers can manage their location's schedule config"
ON public.report_schedule_config
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.location_id = report_schedule_config.location_id
  )
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
  OR EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'superadmin'
  )
);
