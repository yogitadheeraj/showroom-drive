-- Add leave date range fields to profiles for multi-day leave management.
-- on_leave remains as a convenience flag; leave_start_date and leave_end_date define the period.
-- When leave_end_date < today the API auto-clears all three fields.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS leave_start_date date;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS leave_end_date   date;

COMMENT ON COLUMN public.profiles.leave_start_date IS 'First day of the approved leave period (inclusive)';
COMMENT ON COLUMN public.profiles.leave_end_date   IS 'Last day of the approved leave period (inclusive). When today > this date the record is auto-cleared.';
