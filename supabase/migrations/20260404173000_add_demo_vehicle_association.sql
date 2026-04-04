ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS demo_for_vehicle_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'vehicles_demo_for_vehicle_id_fkey'
      AND table_schema = 'public'
      AND table_name = 'vehicles'
  ) THEN
    ALTER TABLE public.vehicles
      ADD CONSTRAINT vehicles_demo_for_vehicle_id_fkey
      FOREIGN KEY (demo_for_vehicle_id)
      REFERENCES public.vehicles (id)
      ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE public.vehicles
  DROP CONSTRAINT IF EXISTS vehicles_demo_role_logic;

ALTER TABLE public.vehicles
  ADD CONSTRAINT vehicles_demo_role_logic CHECK (
    (is_demo = false AND demo_for_vehicle_id IS NULL)
    OR (is_demo = true AND demo_for_vehicle_id IS NOT NULL AND is_new = true AND is_used = false)
  );
