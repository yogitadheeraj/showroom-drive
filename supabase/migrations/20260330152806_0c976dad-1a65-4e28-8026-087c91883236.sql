
-- Create report_send_attempts table
CREATE TABLE public.report_send_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  report_date DATE NOT NULL,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  error_code TEXT,
  sent_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  superadmin_notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.report_send_attempts ENABLE ROW LEVEL SECURITY;

-- RLS: Location staff can view their location's attempts
CREATE POLICY "Location staff can view report attempts"
ON public.report_send_attempts FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid() AND p.location_id = report_send_attempts.location_id
  )
);

-- RLS: Dealer admin can view all their dealer's location attempts
CREATE POLICY "Dealer admin can view report attempts"
ON public.report_send_attempts FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'dealer_admin'::app_role)
  AND location_id IN (
    SELECT l.id FROM locations l WHERE l.dealer_id = get_user_dealer_id(auth.uid())
  )
);

-- RLS: Superadmin can view all
CREATE POLICY "Superadmin can manage report attempts"
ON public.report_send_attempts FOR ALL TO authenticated
USING (has_role(auth.uid(), 'superadmin'::app_role))
WITH CHECK (has_role(auth.uid(), 'superadmin'::app_role));

-- RLS: Service role can insert/update (for edge functions)
CREATE POLICY "Service role can manage report attempts"
ON public.report_send_attempts FOR ALL TO public
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Create log_report_send_attempt RPC function
CREATE OR REPLACE FUNCTION public.log_report_send_attempt(
  p_location_id UUID,
  p_report_type TEXT,
  p_recipient_email TEXT,
  p_report_date DATE,
  p_status TEXT,
  p_error_message TEXT DEFAULT NULL,
  p_error_code TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_attempt_number INTEGER;
  v_next_retry TIMESTAMPTZ;
  v_notify_superadmin BOOLEAN := FALSE;
  v_attempt_id UUID;
BEGIN
  -- Calculate attempt number
  SELECT COALESCE(MAX(attempt_number), 0) + 1
  INTO v_attempt_number
  FROM report_send_attempts
  WHERE location_id = p_location_id
    AND report_type = p_report_type
    AND recipient_email = p_recipient_email
    AND report_date = p_report_date;

  -- Calculate next retry based on exponential backoff
  IF p_status = 'failed' AND v_attempt_number < 3 THEN
    CASE v_attempt_number
      WHEN 1 THEN v_next_retry := now() + INTERVAL '5 minutes';
      WHEN 2 THEN v_next_retry := now() + INTERVAL '15 minutes';
      ELSE v_next_retry := now() + INTERVAL '1 hour';
    END CASE;
  END IF;

  -- Flag superadmin notification on 3rd failure
  IF p_status = 'failed' AND v_attempt_number >= 3 THEN
    v_notify_superadmin := TRUE;
  END IF;

  INSERT INTO report_send_attempts (
    location_id, report_type, recipient_email, report_date,
    attempt_number, status, error_message, error_code,
    sent_at, next_retry_at, superadmin_notified_at
  ) VALUES (
    p_location_id, p_report_type, p_recipient_email, p_report_date,
    v_attempt_number, p_status, p_error_message, p_error_code,
    CASE WHEN p_status = 'success' THEN now() ELSE NULL END,
    v_next_retry,
    CASE WHEN v_notify_superadmin THEN now() ELSE NULL END
  )
  RETURNING id INTO v_attempt_id;

  RETURN v_attempt_id;
END;
$$;

-- Create get_failed_reports_for_retry RPC function
CREATE OR REPLACE FUNCTION public.get_failed_reports_for_retry()
RETURNS TABLE (
  id UUID,
  location_id UUID,
  report_type TEXT,
  recipient_email TEXT,
  report_date DATE,
  attempt_number INTEGER,
  status TEXT,
  next_retry_at TIMESTAMPTZ,
  error_message TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    rsa.id, rsa.location_id, rsa.report_type, rsa.recipient_email,
    rsa.report_date, rsa.attempt_number, rsa.status,
    rsa.next_retry_at, rsa.error_message
  FROM report_send_attempts rsa
  WHERE rsa.status = 'failed'
    AND rsa.attempt_number < 3
    AND rsa.next_retry_at <= now()
  ORDER BY rsa.next_retry_at ASC
  LIMIT 50;
$$;
