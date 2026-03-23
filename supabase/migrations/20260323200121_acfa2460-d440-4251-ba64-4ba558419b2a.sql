
-- Recreate triggers that may not have been created
DROP TRIGGER IF EXISTS on_test_drive_status_change ON public.test_drives;
DROP TRIGGER IF EXISTS on_new_test_drive ON public.test_drives;
DROP TRIGGER IF EXISTS update_locations_updated_at ON public.locations;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS update_vehicles_updated_at ON public.vehicles;
DROP TRIGGER IF EXISTS update_customers_updated_at ON public.customers;
DROP TRIGGER IF EXISTS update_test_drives_updated_at ON public.test_drives;

CREATE TRIGGER update_locations_updated_at BEFORE UPDATE ON public.locations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_test_drives_updated_at BEFORE UPDATE ON public.test_drives FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER on_test_drive_status_change
  BEFORE UPDATE ON public.test_drives
  FOR EACH ROW EXECUTE FUNCTION public.handle_test_drive_status_change();

CREATE OR REPLACE FUNCTION public.handle_new_test_drive()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.customers SET total_test_drives = total_test_drives + 1 WHERE id = NEW.customer_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_new_test_drive
  AFTER INSERT ON public.test_drives
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_test_drive();
