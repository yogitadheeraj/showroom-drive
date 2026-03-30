
-- Drop the overly broad and redundant insert policies
DROP POLICY IF EXISTS "Allow all inserts" ON public.report_email_config;
DROP POLICY IF EXISTS "Users can insert their own config" ON public.report_email_config;
DROP POLICY IF EXISTS "Dealers can manage their location's email config" ON public.report_email_config;
DROP POLICY IF EXISTS "Users can view their location's email config" ON public.report_email_config;

-- Recreate proper ALL policy for dealer_admin (covers INSERT, UPDATE, DELETE, SELECT)
CREATE POLICY "Dealer admin can manage report email config"
ON public.report_email_config
FOR ALL
TO authenticated
USING (
  (has_role(auth.uid(), 'dealer_admin'::app_role) AND location_id IN (
    SELECT l.id FROM locations l WHERE l.dealer_id = get_user_dealer_id(auth.uid())
  ))
)
WITH CHECK (
  (has_role(auth.uid(), 'dealer_admin'::app_role) AND location_id IN (
    SELECT l.id FROM locations l WHERE l.dealer_id = get_user_dealer_id(auth.uid())
  ))
);

-- Staff at the location can manage their config
CREATE POLICY "Location staff can manage report email config"
ON public.report_email_config
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid() AND p.location_id = report_email_config.location_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid() AND p.location_id = report_email_config.location_id
  )
);

-- Superadmin can manage all
CREATE POLICY "Superadmin can manage report email config"
ON public.report_email_config
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'superadmin'::app_role))
WITH CHECK (has_role(auth.uid(), 'superadmin'::app_role));
