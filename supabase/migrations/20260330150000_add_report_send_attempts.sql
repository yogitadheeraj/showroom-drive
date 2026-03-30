-- Report Send Attempt Tracking
-- Logs every attempt to send reports with status, errors, and retry info

CREATE TABLE IF NOT EXISTS public.report_send_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  report_type text NOT NULL CHECK (report_type IN ('test_drive_daily', 'activity_daily')),
  recipient_email text NOT NULL,
  report_date date NOT NULL,
  attempt_number integer NOT NULL DEFAULT 1,
  status text NOT NULL CHECK (status IN ('success', 'failed', 'pending')) DEFAULT 'pending',
  error_message text,
  error_code text,
  sent_at timestamptz,
  next_retry_at timestamptz,
  superadmin_notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_report_send_attempts_location_date 
ON public.report_send_attempts(location_id, report_date DESC);

CREATE INDEX IF NOT EXISTS idx_report_send_attempts_status 
ON public.report_send_attempts(status, next_retry_at);

CREATE INDEX IF NOT EXISTS idx_report_send_attempts_email 
ON public.report_send_attempts(recipient_email);

CREATE INDEX IF NOT EXISTS idx_report_send_attempts_created 
ON public.report_send_attempts(created_at DESC);

-- Enable RLS
ALTER TABLE public.report_send_attempts ENABLE ROW LEVEL SECURITY;

-- Policies for report_send_attempts
CREATE POLICY "Location staff can view send attempts for their location"
ON public.report_send_attempts
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.location_id = report_send_attempts.location_id
  )
  OR (
    has_role(auth.uid(), 'dealer_admin'::public.app_role)
    AND report_send_attempts.location_id IN (
      SELECT l.id
      FROM public.locations l
      WHERE l.dealer_id = get_user_dealer_id(auth.uid())
    )
  )
  OR EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'superadmin'
  )
);

CREATE POLICY "Superadmin can manage all send attempts"
ON public.report_send_attempts
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'superadmin'
  )
);
