CREATE OR REPLACE FUNCTION public.handle_new_test_drive()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.customers
  SET total_test_drives = (
    SELECT COUNT(*)::int
    FROM public.test_drives
    WHERE customer_id = NEW.customer_id
  )
  WHERE id = NEW.customer_id;

  UPDATE public.vehicles
  SET available_units = GREATEST(available_units - 1, 0)
  WHERE id = NEW.vehicle_id;

  UPDATE public.vehicles
  SET is_available = (available_units > 0)
  WHERE id = NEW.vehicle_id;

  RETURN NEW;
END;
$function$;