-- Helper functions for report send attempt tracking and retry logic

CREATE OR REPLACE FUNCTION public.log_report_send_attempt(
  p_location_id uuid,
  p_report_type text,
  p_recipient_email text,
  p_report_date date,
  p_status text,
  p_error_message text DEFAULT NULL,
  p_error_code text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_attempt_id uuid;
  v_attempt_number integer;
  v_next_retry_at timestamptz;
BEGIN
  -- Get current attempt count
  SELECT COALESCE(MAX(attempt_number), 0) + 1 INTO v_attempt_number
  FROM public.report_send_attempts
  WHERE location_id = p_location_id
    AND report_type = p_report_type
    AND recipient_email = p_recipient_email
    AND report_date = p_report_date;

  -- Calculate next retry time (exponential backoff: 5min, 15min, 60min)
  v_next_retry_at := CASE
    WHEN v_attempt_number = 1 AND p_status = 'failed' THEN now() + INTERVAL '5 minutes'
    WHEN v_attempt_number = 2 AND p_status = 'failed' THEN now() + INTERVAL '15 minutes'
    WHEN v_attempt_number = 3 AND p_status = 'failed' THEN now() + INTERVAL '1 hour'
    ELSE NULL
  END;

  -- Insert send attempt record
  INSERT INTO public.report_send_attempts (
    location_id,
    report_type,
    recipient_email,
    report_date,
    attempt_number,
    status,
    error_message,
    error_code,
    sent_at,
    next_retry_at,
    created_at,
    updated_at
  ) VALUES (
    p_location_id,
    p_report_type,
    p_recipient_email,
    p_report_date,
    v_attempt_number,
    p_status,
    p_error_message,
    p_error_code,
    CASE WHEN p_status = 'success' THEN now() ELSE NULL END,
    v_next_retry_at,
    now(),
    now()
  ) RETURNING id INTO v_attempt_id;

  -- If this is the 3rd failed attempt, mark for superadmin notification
  IF p_status = 'failed' AND v_attempt_number >= 3 THEN
    UPDATE public.report_send_attempts
    SET superadmin_notified_at = now()
    WHERE id = v_attempt_id;
  END IF;

  RETURN v_attempt_id;
END;
$$ LANGUAGE plpgsql;

-- Get failed reports ready for retry
CREATE OR REPLACE FUNCTION public.get_failed_reports_for_retry()
RETURNS TABLE (
  attempt_id uuid,
  location_id uuid,
  report_type text,
  recipient_email text,
  report_date date,
  attempt_number integer,
  error_message text
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    rsa.id,
    rsa.location_id,
    rsa.report_type,
    rsa.recipient_email,
    rsa.report_date,
    rsa.attempt_number,
    rsa.error_message
  FROM public.report_send_attempts rsa
  WHERE rsa.status = 'failed'
    AND rsa.attempt_number < 3
    AND (rsa.next_retry_at IS NULL OR rsa.next_retry_at <= now())
  ORDER BY rsa.next_retry_at ASC NULLS LAST
  LIMIT 50;
END;
$$ LANGUAGE plpgsql;
