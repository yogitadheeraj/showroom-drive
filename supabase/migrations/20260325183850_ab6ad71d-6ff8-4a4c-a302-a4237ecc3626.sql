
-- Add stock count fields to vehicles
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS total_units integer NOT NULL DEFAULT 1;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS available_units integer NOT NULL DEFAULT 1;

-- Update the status change trigger to manage available_units
CREATE OR REPLACE FUNCTION public.handle_test_drive_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    UPDATE public.vehicles SET is_available = true, available_units = LEAST(available_units + 1, total_units) WHERE id = NEW.vehicle_id;
  END IF;
  IF NEW.status = 'in_progress' AND OLD.status != 'in_progress' THEN
    UPDATE public.vehicles SET available_units = GREATEST(available_units - 1, 0) WHERE id = NEW.vehicle_id;
    UPDATE public.vehicles SET is_available = (available_units > 0) WHERE id = NEW.vehicle_id;
    NEW.started_at = now();
  END IF;
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    UPDATE public.vehicles SET available_units = LEAST(available_units + 1, total_units) WHERE id = NEW.vehicle_id;
    UPDATE public.vehicles SET is_available = (available_units > 0) WHERE id = NEW.vehicle_id;
    NEW.completed_at = now();
  END IF;
  IF NEW.status = 'no_show' AND OLD.status != 'no_show' THEN
    UPDATE public.vehicles SET available_units = LEAST(available_units + 1, total_units) WHERE id = NEW.vehicle_id;
    UPDATE public.vehicles SET is_available = (available_units > 0) WHERE id = NEW.vehicle_id;
  END IF;
  RETURN NEW;
END;
$function$;

-- Update the new test drive handler to decrement available_units on booking
CREATE OR REPLACE FUNCTION public.handle_new_test_drive()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.customers SET total_test_drives = total_test_drives + 1 WHERE id = NEW.customer_id;
  UPDATE public.vehicles SET available_units = GREATEST(available_units - 1, 0) WHERE id = NEW.vehicle_id;
  UPDATE public.vehicles SET is_available = (available_units > 0) WHERE id = NEW.vehicle_id;
  RETURN NEW;
END;
$function$;

-- Update auto-release function to restore available_units
CREATE OR REPLACE FUNCTION public.auto_release_noshow_vehicles()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.test_drives
  SET status = 'no_show', updated_at = now()
  WHERE status = 'scheduled'
    AND (scheduled_date < CURRENT_DATE
      OR (scheduled_date = CURRENT_DATE 
          AND scheduled_time < (CURRENT_TIME - interval '15 minutes')));
END;
$function$;

-- Create dealers table for dealer onboarding
CREATE TABLE IF NOT EXISTS public.dealers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  logo_url text,
  contact_email text NOT NULL,
  contact_phone text,
  admin_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.dealers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active dealers" ON public.dealers
FOR SELECT TO anon USING (is_active = true);

CREATE POLICY "Authenticated can view dealers" ON public.dealers
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Superadmin can manage dealers" ON public.dealers
FOR ALL TO authenticated USING (has_role(auth.uid(), 'superadmin'::app_role))
WITH CHECK (has_role(auth.uid(), 'superadmin'::app_role));

-- Add dealer_id to locations for multi-dealer support
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS dealer_id uuid REFERENCES public.dealers(id) ON DELETE SET NULL;

-- Add brands table
CREATE TABLE IF NOT EXISTS public.brands (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  logo_url text,
  dealer_id uuid REFERENCES public.dealers(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active brands" ON public.brands
FOR SELECT TO anon USING (is_active = true);

CREATE POLICY "Authenticated can view brands" ON public.brands
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Superadmin can manage brands" ON public.brands
FOR ALL TO authenticated USING (has_role(auth.uid(), 'superadmin'::app_role))
WITH CHECK (has_role(auth.uid(), 'superadmin'::app_role));
