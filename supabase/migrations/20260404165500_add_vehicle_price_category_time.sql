ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS set_price numeric(12,2),
  ADD COLUMN IF NOT EXISTS vehicle_time_days integer,
  ADD COLUMN IF NOT EXISTS is_new boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_used boolean NOT NULL DEFAULT false;

UPDATE public.vehicles
SET
  is_new = COALESCE(is_new, true),
  is_used = COALESCE(is_used, false)
WHERE is_new IS NULL OR is_used IS NULL;

ALTER TABLE public.vehicles
  DROP CONSTRAINT IF EXISTS vehicles_new_used_exclusive;

ALTER TABLE public.vehicles
  ADD CONSTRAINT vehicles_new_used_exclusive CHECK (is_new <> is_used);
