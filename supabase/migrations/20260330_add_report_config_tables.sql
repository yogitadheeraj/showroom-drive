-- Report Email Configuration - stores which email addresses get which reports
CREATE TABLE IF NOT EXISTS public.report_email_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  dealer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  email_address text NOT NULL,
  report_type text NOT NULL CHECK (report_type IN ('test_drive_daily', 'activity_daily', 'both')),
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(location_id, email_address, report_type)
);

-- Report Schedule Configuration - stores when reports should be sent
CREATE TABLE IF NOT EXISTS public.report_schedule_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  report_type text NOT NULL CHECK (report_type IN ('test_drive_daily', 'activity_daily')),
  schedule_time TIME NOT NULL,
  days_of_week text[] NOT NULL DEFAULT ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
  is_enabled boolean NOT NULL DEFAULT true,
  timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  last_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(location_id, report_type)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_report_email_config_location 
ON public.report_email_config(location_id, is_enabled);

CREATE INDEX IF NOT EXISTS idx_report_schedule_config_location 
ON public.report_schedule_config(location_id, is_enabled);

-- Enable RLS
ALTER TABLE public.report_email_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_schedule_config ENABLE ROW LEVEL SECURITY;

-- Policies for report_email_config
CREATE POLICY "Dealers can manage their location's email config"
ON public.report_email_config
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.location_id = location_id
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
    WHERE p.id = auth.uid()
      AND p.location_id = location_id
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
    WHERE p.id = auth.uid()
      AND p.location_id = location_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'superadmin'
  )
);

-- Policies for report_schedule_config
CREATE POLICY "Dealers can manage their location's schedule config"
ON public.report_schedule_config
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.location_id = location_id
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
    WHERE p.id = auth.uid()
      AND p.location_id = location_id
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
    WHERE p.id = auth.uid()
      AND p.location_id = location_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'superadmin'
  )
);
