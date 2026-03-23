
-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('superadmin', 'gro', 'sales', 'security');

-- Create test_drive_status enum
CREATE TYPE public.test_drive_status AS ENUM ('scheduled', 'confirmed', 'show', 'no_show', 'in_progress', 'completed', 'cancelled', 'rescheduled');

-- Create communication_type enum
CREATE TYPE public.communication_type AS ENUM ('email', 'whatsapp', 'sms');

-- Create communication_purpose enum
CREATE TYPE public.communication_purpose AS ENUM ('booking_created', 'booking_confirmed', 'booking_rescheduled', 'booking_cancelled', 'reminder', 'follow_up', 'custom');

-- Locations/Showrooms
CREATE TABLE public.locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT,
  country TEXT NOT NULL DEFAULT 'India',
  phone TEXT,
  email TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Profiles
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  location_id UUID REFERENCES public.locations(id),
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User roles
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);

-- Vehicles
CREATE TABLE public.vehicles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  variant TEXT,
  year INT NOT NULL,
  color TEXT,
  registration_number TEXT,
  image_url TEXT,
  is_available BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Customers (walk-in and online)
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT NOT NULL,
  preferred_contact TEXT NOT NULL DEFAULT 'phone' CHECK (preferred_contact IN ('phone', 'email', 'whatsapp')),
  driving_license_url TEXT,
  driving_license_verified BOOLEAN NOT NULL DEFAULT false,
  total_test_drives INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Test Drives
CREATE TABLE public.test_drives (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id),
  location_id UUID NOT NULL REFERENCES public.locations(id),
  assigned_sales_person_id UUID REFERENCES public.profiles(id),
  assigned_gro_id UUID REFERENCES public.profiles(id),
  scheduled_date DATE NOT NULL,
  scheduled_time TIME NOT NULL,
  status test_drive_status NOT NULL DEFAULT 'scheduled',
  source TEXT NOT NULL DEFAULT 'online' CHECK (source IN ('online', 'walkin')),
  notes TEXT,
  cancelled_reason TEXT,
  rescheduled_from UUID REFERENCES public.test_drives(id),
  security_checked_in_at TIMESTAMPTZ,
  security_checked_out_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Communications log
CREATE TABLE public.communications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  test_drive_id UUID REFERENCES public.test_drives(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  type communication_type NOT NULL,
  purpose communication_purpose NOT NULL,
  subject TEXT,
  body TEXT,
  sent_to TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed')),
  external_id TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_drives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communications ENABLE ROW LEVEL SECURITY;

-- has_role security definer function
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- get_user_role function
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- Locations: read by authenticated and anon
CREATE POLICY "Authenticated can view active locations"
  ON public.locations FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY "Superadmin can manage locations"
  ON public.locations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "Anyone can view active locations"
  ON public.locations FOR SELECT TO anon
  USING (is_active = true);

-- Profiles
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Superadmin can view all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "GRO can view location profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'gro'));

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Superadmin can manage all profiles"
  ON public.profiles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

-- User roles
CREATE POLICY "Superadmin can manage roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "Users can view own role"
  ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Vehicles
CREATE POLICY "Anyone can view available vehicles"
  ON public.vehicles FOR SELECT TO anon
  USING (is_active = true);

CREATE POLICY "Authenticated can view vehicles"
  ON public.vehicles FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Superadmin can manage vehicles"
  ON public.vehicles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "GRO can manage vehicles"
  ON public.vehicles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'gro'))
  WITH CHECK (public.has_role(auth.uid(), 'gro'));

-- Customers
CREATE POLICY "Staff can view customers"
  ON public.customers FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Anyone can create customer"
  ON public.customers FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "Authenticated can create customer"
  ON public.customers FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Staff can update customers"
  ON public.customers FOR UPDATE TO authenticated
  USING (true);

-- Test drives
CREATE POLICY "Staff can view test drives"
  ON public.test_drives FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Anyone can create test drive"
  ON public.test_drives FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "Authenticated can create test drive"
  ON public.test_drives FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Staff can update test drives"
  ON public.test_drives FOR UPDATE TO authenticated
  USING (true);

-- Communications
CREATE POLICY "Staff can view communications"
  ON public.communications FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Staff can create communications"
  ON public.communications FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "System can create communications"
  ON public.communications FOR INSERT TO anon
  WITH CHECK (true);

-- Updated at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers
CREATE TRIGGER update_locations_updated_at BEFORE UPDATE ON public.locations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_test_drives_updated_at BEFORE UPDATE ON public.test_drives FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-release vehicle when test drive cancelled/completed
CREATE OR REPLACE FUNCTION public.handle_test_drive_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    UPDATE public.vehicles SET is_available = true WHERE id = NEW.vehicle_id;
  END IF;
  IF NEW.status = 'in_progress' AND OLD.status != 'in_progress' THEN
    UPDATE public.vehicles SET is_available = false WHERE id = NEW.vehicle_id;
    NEW.started_at = now();
  END IF;
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    UPDATE public.vehicles SET is_available = true WHERE id = NEW.vehicle_id;
    NEW.completed_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_test_drive_status_change
  BEFORE UPDATE ON public.test_drives
  FOR EACH ROW EXECUTE FUNCTION public.handle_test_drive_status_change();

-- Storage bucket for driving licenses
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false);

CREATE POLICY "Staff can view documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documents');

CREATE POLICY "Staff can upload documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents');

CREATE POLICY "Anon can upload documents"
  ON storage.objects FOR INSERT TO anon
  WITH CHECK (bucket_id = 'documents');

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
