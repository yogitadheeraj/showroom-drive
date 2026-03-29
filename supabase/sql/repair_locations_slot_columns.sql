-- Manual repair script for projects missing locations columns used by slot-duration features.
-- Run this in Supabase Dashboard -> SQL Editor.

ALTER TABLE public.locations
ADD COLUMN IF NOT EXISTS slot_duration_minutes INTEGER NOT NULL DEFAULT 30;

ALTER TABLE public.locations
ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Backfill slot duration from metadata only when metadata exists and contains a valid integer.
UPDATE public.locations
SET slot_duration_minutes = COALESCE(
  NULLIF((metadata->>'slot_duration_minutes')::int, 0),
  slot_duration_minutes,
  30
)
WHERE metadata IS NOT NULL
  AND (metadata->>'slot_duration_minutes') ~ '^[0-9]+$';

COMMENT ON COLUMN public.locations.slot_duration_minutes IS
'Default slot duration for this location in minutes';
