-- Phase B: payment orders
CREATE TABLE IF NOT EXISTS public.payment_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  amount integer NOT NULL DEFAULT 0,
  authority text NOT NULL DEFAULT '',
  ref_id text NOT NULL DEFAULT '',
  gateway text NOT NULL DEFAULT 'zarinpal',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_orders_booking_idx ON public.payment_orders (booking_id);
CREATE INDEX IF NOT EXISTS payment_orders_authority_idx ON public.payment_orders (authority);

ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own payment orders select" ON public.payment_orders
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "staff payment orders select" ON public.payment_orders
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

GRANT SELECT, INSERT, UPDATE ON public.payment_orders TO authenticated;
GRANT ALL ON public.payment_orders TO service_role;

-- Phase C: user wallets
CREATE TABLE IF NOT EXISTS public.wallets (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'IRT',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_user_id uuid NOT NULL REFERENCES public.wallets(user_id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'credit',
  amount integer NOT NULL DEFAULT 0,
  balance_after integer NOT NULL DEFAULT 0,
  description text NOT NULL DEFAULT '',
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  payment_order_id uuid REFERENCES public.payment_orders(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wallet_transactions_user_idx ON public.wallet_transactions (wallet_user_id, created_at DESC);

ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own wallet select" ON public.wallets FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own wallet tx select" ON public.wallet_transactions
  FOR SELECT TO authenticated USING (auth.uid() = wallet_user_id);
CREATE POLICY "staff wallet select" ON public.wallets
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff wallet tx select" ON public.wallet_transactions
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

GRANT SELECT ON public.wallets TO authenticated;
GRANT SELECT ON public.wallet_transactions TO authenticated;
GRANT ALL ON public.wallets TO service_role;
GRANT ALL ON public.wallet_transactions TO service_role;

-- Phase D: notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'web',
  type text NOT NULL DEFAULT '',
  payload jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending',
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_pending_idx ON public.notifications (status, created_at);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own notifications select" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "staff notifications select" ON public.notifications
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

GRANT SELECT ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

-- Phase E: Telegram link on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS telegram_id bigint UNIQUE,
  ADD COLUMN IF NOT EXISTS telegram_linked_at timestamptz;

-- Phase F: door access audit
CREATE TABLE IF NOT EXISTS public.door_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  device_id text NOT NULL DEFAULT '',
  result text NOT NULL DEFAULT '',
  token_hash text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS door_events_created_idx ON public.door_events (created_at DESC);

ALTER TABLE public.door_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff door events select" ON public.door_events
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "own door events select" ON public.door_events
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

GRANT SELECT ON public.door_events TO authenticated;
GRANT ALL ON public.door_events TO service_role;

-- Enqueue notification on booking changes
CREATE OR REPLACE FUNCTION public.enqueue_booking_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications (user_id, channel, type, payload, status)
    VALUES (
      NEW.user_id,
      'web',
      'booking_created',
      jsonb_build_object('booking_id', NEW.id, 'code', NEW.code, 'status', NEW.status),
      'pending'
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.notifications (user_id, channel, type, payload, status)
    VALUES (
      NEW.user_id,
      'web',
      'booking_status_changed',
      jsonb_build_object('booking_id', NEW.id, 'code', NEW.code, 'status', NEW.status),
      'pending'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bookings_notify ON public.bookings;
CREATE TRIGGER bookings_notify
  AFTER INSERT OR UPDATE OF status ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_booking_notification();
