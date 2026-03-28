-- Auth resilience fixes:
-- 1) Keep auth->profile trigger idempotent and upsert-safe.
-- 2) Align email_send_log status constraint with queue worker statuses.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name),
    email = COALESCE(public.profiles.email, EXCLUDED.email);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DO $$
BEGIN
  ALTER TABLE public.email_send_log DROP CONSTRAINT IF EXISTS email_send_log_status_check;
  ALTER TABLE public.email_send_log
    ADD CONSTRAINT email_send_log_status_check
    CHECK (status IN (
      'pending',
      'sent',
      'suppressed',
      'failed',
      'bounced',
      'complained',
      'dlq',
      'rate_limited'
    ));
END;
$$;
