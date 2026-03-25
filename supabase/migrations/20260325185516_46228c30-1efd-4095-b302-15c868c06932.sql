
-- Trigger: auto-assign superadmin role when a dealer is created with admin_user_id
CREATE OR REPLACE FUNCTION public.handle_dealer_admin_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.admin_user_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.admin_user_id, 'superadmin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_dealer_created_assign_admin
  AFTER INSERT ON public.dealers
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_dealer_admin_role();

-- Allow authenticated users to create their own dealer (onboarding)
CREATE POLICY "Users can create own dealer"
  ON public.dealers FOR INSERT
  TO authenticated
  WITH CHECK (admin_user_id = auth.uid());

-- Allow dealer admin to insert brands for their dealer
CREATE POLICY "Dealer admin can insert brands"
  ON public.brands FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.dealers
      WHERE id = dealer_id AND admin_user_id = auth.uid()
    )
  );

-- Allow dealer admin to insert locations for their dealer
CREATE POLICY "Dealer admin can insert locations"
  ON public.locations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.dealers
      WHERE id = dealer_id AND admin_user_id = auth.uid()
    )
  );
