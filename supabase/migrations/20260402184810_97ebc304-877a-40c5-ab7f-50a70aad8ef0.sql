
CREATE TABLE public.test_drive_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_drive_id uuid NOT NULL REFERENCES public.test_drives(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  enquiry_id text,
  customer_name text NOT NULL,
  customer_email text,
  customer_phone text,
  rating integer NOT NULL DEFAULT 5,
  experience_badge text,
  total_duration_minutes integer,
  feedback_text text,
  would_recommend boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.test_drive_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert feedback" ON public.test_drive_feedback
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can view feedback" ON public.test_drive_feedback
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Anon can view own feedback" ON public.test_drive_feedback
  FOR SELECT TO anon USING (true);
