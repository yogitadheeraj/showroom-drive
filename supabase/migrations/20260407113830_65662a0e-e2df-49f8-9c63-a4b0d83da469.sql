
CREATE OR REPLACE FUNCTION public.auto_assign_sales_person_round_robin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_sales_profile_id uuid;
BEGIN
  -- Only auto-assign if no sales person is already assigned
  IF NEW.assigned_sales_person_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Round-robin: pick the active sales person at this location
  -- with the fewest test drives scheduled for this date
  SELECT p.id INTO v_sales_profile_id
  FROM profiles p
  INNER JOIN user_roles ur ON ur.user_id = p.user_id AND ur.role = 'sales'
  WHERE p.location_id = NEW.location_id
    AND p.is_active = true
  ORDER BY (
    SELECT COUNT(*)
    FROM test_drives td
    WHERE td.assigned_sales_person_id = p.id
      AND td.scheduled_date = NEW.scheduled_date
      AND td.status NOT IN ('cancelled', 'no_show')
  ) ASC,
  random()
  LIMIT 1;

  IF v_sales_profile_id IS NOT NULL THEN
    NEW.assigned_sales_person_id := v_sales_profile_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger on test_drives insert
DROP TRIGGER IF EXISTS trg_auto_assign_sales_person ON public.test_drives;
CREATE TRIGGER trg_auto_assign_sales_person
  BEFORE INSERT ON public.test_drives
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_sales_person_round_robin();
