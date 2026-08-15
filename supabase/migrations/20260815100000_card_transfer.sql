-- Card-transfer payment: card config on pricing_settings + payment_receipts + storage bucket

-- 1. Card config (editable by staff in admin pricing page)
ALTER TABLE public.pricing_settings
  ADD COLUMN IF NOT EXISTS card_number text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS card_holder text NOT NULL DEFAULT '';

-- 2. Payment receipts (manual card-transfer proof of payment)
CREATE TABLE IF NOT EXISTS public.payment_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  image_path text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_receipts_booking_idx ON public.payment_receipts (booking_id);
CREATE INDEX IF NOT EXISTS payment_receipts_user_idx ON public.payment_receipts (user_id);

GRANT SELECT, INSERT, UPDATE ON public.payment_receipts TO authenticated;
GRANT ALL ON public.payment_receipts TO service_role;
ALTER TABLE public.payment_receipts ENABLE ROW LEVEL SECURITY;

-- user sees / creates own
CREATE POLICY "own receipts select" ON public.payment_receipts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own receipts insert" ON public.payment_receipts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
-- staff sees all + updates (approve/reject)
CREATE POLICY "staff receipts select" ON public.payment_receipts
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff receipts update" ON public.payment_receipts
  FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- 3. Private storage bucket for receipt images
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', false)
ON CONFLICT (id) DO NOTHING;

-- Users can only upload under their own {user_id}/ folder
CREATE POLICY "receipts own upload" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text
  );
-- Users can read own, staff read all
CREATE POLICY "receipts own read" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "receipts staff read" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'receipts' AND public.is_staff(auth.uid())
  );