-- Multi-desk group booking: junction table + max config

CREATE TABLE public.booking_desks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  desk_id uuid NOT NULL REFERENCES public.desks(id),
  desk_code text NOT NULL,
  unit_price integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_booking_desks_booking_id ON public.booking_desks(booking_id);
CREATE INDEX idx_booking_desks_desk_id ON public.booking_desks(desk_id);

ALTER TABLE public.booking_desks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "booking_desks user read own"
  ON public.booking_desks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_desks.booking_id
        AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "booking_desks staff read all"
  ON public.booking_desks FOR SELECT
  USING (public.is_staff(auth.uid()));

CREATE POLICY "booking_desks service write"
  ON public.booking_desks FOR ALL
  USING (true)
  WITH CHECK (true);

ALTER TABLE public.pricing_settings
  ADD COLUMN max_desks_per_booking integer NOT NULL DEFAULT 4;
