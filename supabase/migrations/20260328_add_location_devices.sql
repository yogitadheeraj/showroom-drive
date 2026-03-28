-- Create location_devices table for tracking devices at each location
CREATE TABLE IF NOT EXISTS public.location_devices (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  name text NOT NULL,
  device_type text NOT NULL DEFAULT 'tablet',
  serial_number text,
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.location_devices ENABLE ROW LEVEL SECURITY;

-- Allow staff to view devices in their location
CREATE POLICY "Staff can view location devices"
  ON public.location_devices
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.location_id = location_devices.location_id
    ) OR
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.app_role IN ('admin', 'superadmin', 'dealer_admin')
    )
  );

-- Allow admins to manage devices
CREATE POLICY "Admins can manage location devices"
  ON public.location_devices
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.app_role IN ('admin', 'superadmin', 'dealer_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.app_role IN ('admin', 'superadmin', 'dealer_admin')
    )
  );

-- Create index for location lookups
CREATE INDEX IF NOT EXISTS idx_location_devices_location_id ON public.location_devices(location_id);
