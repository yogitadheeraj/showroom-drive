-- Create daily test drive reports table
CREATE TABLE IF NOT EXISTS public.daily_test_drive_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id) ON DELETE CASCADE,
  report_date date NOT NULL,
  total_test_drives int NOT NULL DEFAULT 0,
  status_breakdown jsonb,
  sales_person_stats jsonb,
  security_stats jsonb,
  gro_stats jsonb,
  activity_summary jsonb,
  email_sent_to text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_daily_test_drive_reports_location_date 
ON public.daily_test_drive_reports(location_id, report_date DESC);

CREATE INDEX IF NOT EXISTS idx_daily_test_drive_reports_sent_at 
ON public.daily_test_drive_reports(sent_at DESC);

-- Create activity report logs table
CREATE TABLE IF NOT EXISTS public.activity_report_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid REFERENCES public.locations(id) ON DELETE CASCADE,
  report_date date NOT NULL,
  staff_activity_summary jsonb,
  event_breakdown jsonb,
  role_wise_activity jsonb,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create index for activity reports
CREATE INDEX IF NOT EXISTS idx_activity_report_logs_location_date 
ON public.activity_report_logs(location_id, report_date DESC);

-- Enable RLS
ALTER TABLE public.daily_test_drive_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_report_logs ENABLE ROW LEVEL SECURITY;

-- Policies for daily_test_drive_reports
CREATE POLICY "Dealers can view their own reports"
ON public.daily_test_drive_reports
FOR SELECT
TO authenticated
USING (
  dealer_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('superadmin')
  )
);

CREATE POLICY "Superadmin can view all reports"
ON public.daily_test_drive_reports
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'superadmin'
  )
);

-- Policies for activity_report_logs
CREATE POLICY "Location staff can view their activity reports"
ON public.activity_report_logs
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
