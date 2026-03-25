
ALTER TABLE public.test_drives
  ADD COLUMN IF NOT EXISTS pre_drive_km numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS post_drive_km numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS pre_drive_scratches text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS post_drive_scratches text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS pre_drive_notes text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS post_drive_notes text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS pre_drive_fuel_level text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS post_drive_fuel_level text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS inspection_submitted_at timestamp with time zone DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS key_handed_at timestamp with time zone DEFAULT NULL;
