-- Add soft-delete columns to location_special_periods and keep reads scoped to active rows.
ALTER TABLE public.location_special_periods
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Backfill for existing rows.
UPDATE public.location_special_periods
SET is_active = COALESCE(is_active, true),
    is_deleted = COALESCE(is_deleted, false),
    updated_at = COALESCE(updated_at, created_at, now())
WHERE is_active IS DISTINCT FROM true
   OR is_deleted IS DISTINCT FROM false
   OR updated_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_location_special_periods_active
  ON public.location_special_periods (location_id, start_date, end_date)
  WHERE is_active = true AND is_deleted = false;

DROP POLICY IF EXISTS "Anyone can view special periods" ON public.location_special_periods;
CREATE POLICY "Anyone can view active special periods"
  ON public.location_special_periods FOR SELECT
  TO anon, authenticated
  USING (is_active = true AND is_deleted = false);

-- Optional utility trigger for updated_at consistency.
CREATE OR REPLACE FUNCTION public.set_location_special_periods_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_location_special_periods_updated_at ON public.location_special_periods;
CREATE TRIGGER trg_location_special_periods_updated_at
BEFORE UPDATE ON public.location_special_periods
FOR EACH ROW
EXECUTE FUNCTION public.set_location_special_periods_updated_at();
