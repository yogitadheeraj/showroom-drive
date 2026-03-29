-- Add intermediate status for security -> sales handover workflow.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'test_drive_status'
      AND e.enumlabel = 'key_handover_to_sales'
  ) THEN
    ALTER TYPE public.test_drive_status ADD VALUE 'key_handover_to_sales';
  END IF;
END
$$;
