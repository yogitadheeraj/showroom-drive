-- Car Purchase Bookings table
CREATE TABLE public.car_bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Core references
  customer_id     UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  vehicle_id      UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  location_id     UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  test_drive_id   UUID REFERENCES public.test_drives(id) ON DELETE SET NULL,
  opportunity_id  UUID REFERENCES public.sales_opportunities(id) ON DELETE SET NULL,
  sales_person_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Booking details
  booking_status TEXT NOT NULL DEFAULT 'confirmed'
    CHECK (booking_status IN ('confirmed', 'cancelled', 'refunded')),

  payment_method TEXT NOT NULL DEFAULT 'cash'
    CHECK (payment_method IN ('cash', 'payment_link', 'online')),

  payment_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'paid', 'refunded', 'partial_refund')),

  booking_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  refund_amount  NUMERIC(14,2) NOT NULL DEFAULT 0,

  payment_link   TEXT,          -- URL for payment link (if method = payment_link)
  payment_link_sent_at TIMESTAMPTZ,

  -- Cancellation / Refund
  cancellation_reason TEXT,
  refund_notes        TEXT,
  cancelled_at        TIMESTAMPTZ,
  refunded_at         TIMESTAMPTZ,
  cancelled_by_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- General
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Timestamps trigger
CREATE TRIGGER update_car_bookings_updated_at
  BEFORE UPDATE ON public.car_bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.car_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated staff can view bookings"
  ON public.car_bookings FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated staff can insert bookings"
  ON public.car_bookings FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated staff can update bookings"
  ON public.car_bookings FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

-- Index for common queries
CREATE INDEX idx_car_bookings_customer_id   ON public.car_bookings(customer_id);
CREATE INDEX idx_car_bookings_vehicle_id    ON public.car_bookings(vehicle_id);
CREATE INDEX idx_car_bookings_location_id   ON public.car_bookings(location_id);
CREATE INDEX idx_car_bookings_test_drive_id ON public.car_bookings(test_drive_id);
CREATE INDEX idx_car_bookings_status        ON public.car_bookings(booking_status);
CREATE INDEX idx_car_bookings_created_at    ON public.car_bookings(created_at DESC);
