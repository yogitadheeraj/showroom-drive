CREATE TABLE IF NOT EXISTS public.test_drive_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_drive_id UUID NOT NULL REFERENCES public.test_drives(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  enquiry_id TEXT,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  experience_badge TEXT NOT NULL,
  total_duration_minutes INT,
  feedback_text TEXT,
  would_recommend BOOLEAN NOT NULL DEFAULT true,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_test_drive_feedback_unique_drive
  ON public.test_drive_feedback(test_drive_id);

CREATE INDEX IF NOT EXISTS idx_test_drive_feedback_customer_id
  ON public.test_drive_feedback(customer_id);

ALTER TABLE public.test_drive_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view test drive feedback"
  ON public.test_drive_feedback FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Anyone can submit test drive feedback"
  ON public.test_drive_feedback FOR INSERT TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.test_drives td
      WHERE td.id = test_drive_id
    )
  );

CREATE POLICY "Authenticated can submit test drive feedback"
  ON public.test_drive_feedback FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.test_drives td
      WHERE td.id = test_drive_id
    )
  );
