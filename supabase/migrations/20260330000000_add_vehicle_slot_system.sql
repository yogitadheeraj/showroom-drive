-- Add slot duration and no-show tracking to test_drives table
ALTER TABLE public.test_drives 
ADD COLUMN IF NOT EXISTS slot_duration_minutes INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS no_show_checked_at TIMESTAMPTZ;

-- Store per-location slot duration in a dedicated column
ALTER TABLE public.locations
ADD COLUMN IF NOT EXISTS slot_duration_minutes INTEGER NOT NULL DEFAULT 30;

-- Backfill from metadata if metadata exists and has a numeric slot value
DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_schema = 'public'
			AND table_name = 'locations'
			AND column_name = 'metadata'
	) THEN
		EXECUTE $$
			UPDATE public.locations
			SET slot_duration_minutes = COALESCE(
				NULLIF((metadata->>'slot_duration_minutes')::int, 0),
				slot_duration_minutes,
				30
			)
			WHERE metadata IS NOT NULL
		$$;
	END IF;
END
$$;

-- Create index for efficient slot availability queries
CREATE INDEX IF NOT EXISTS idx_test_drives_slot_availability 
ON public.test_drives(location_id, scheduled_date, scheduled_time, status);

-- Create index for no-show checking
CREATE INDEX IF NOT EXISTS idx_test_drives_no_show_check 
ON public.test_drives(scheduled_date, status) 
WHERE status IN ('scheduled', 'confirmed', 'show');

-- Add comment documenting the slot system
COMMENT ON COLUMN public.test_drives.slot_duration_minutes IS 
'Duration of the booking slot in minutes (inherited from location config at time of booking)';

COMMENT ON COLUMN public.test_drives.no_show_checked_at IS 
'Timestamp when this booking was checked for no-show status';

COMMENT ON COLUMN public.locations.slot_duration_minutes IS
'Default slot duration for this location in minutes';
