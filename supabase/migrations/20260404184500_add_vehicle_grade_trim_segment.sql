ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS grade text,
  ADD COLUMN IF NOT EXISTS trim text,
  ADD COLUMN IF NOT EXISTS vehicle_segment text NOT NULL DEFAULT 'four_wheeler';

ALTER TABLE public.vehicles
  DROP CONSTRAINT IF EXISTS vehicles_segment_valid;

ALTER TABLE public.vehicles
  ADD CONSTRAINT vehicles_segment_valid
  CHECK (vehicle_segment IN ('four_wheeler', 'two_wheeler'));
