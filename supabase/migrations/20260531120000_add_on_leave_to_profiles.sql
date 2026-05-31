-- Add on_leave field to profiles for staff leave management
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS on_leave boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.on_leave IS 'When true, this staff member is on leave and will be excluded from auto-assignment of walk-in leads';
