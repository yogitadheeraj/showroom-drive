
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS engine_type text DEFAULT 'petrol',
  ADD COLUMN IF NOT EXISTS horsepower integer,
  ADD COLUMN IF NOT EXISTS torque text,
  ADD COLUMN IF NOT EXISTS transmission text DEFAULT 'Automatic',
  ADD COLUMN IF NOT EXISTS fuel_type text,
  ADD COLUMN IF NOT EXISTS mileage text,
  ADD COLUMN IF NOT EXISTS acceleration text,
  ADD COLUMN IF NOT EXISTS top_speed text,
  ADD COLUMN IF NOT EXISTS range_km integer,
  ADD COLUMN IF NOT EXISTS battery_capacity text,
  ADD COLUMN IF NOT EXISTS seating_capacity integer DEFAULT 5,
  ADD COLUMN IF NOT EXISTS drive_type text;
