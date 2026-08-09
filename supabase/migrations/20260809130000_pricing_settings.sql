CREATE TABLE public.pricing_settings (
  id uuid PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000001',
  hourly_rate integer NOT NULL DEFAULT 90000,
  daily_rate integer NOT NULL DEFAULT 590000,
  monthly_rate integer NOT NULL DEFAULT 7900000,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.pricing_settings (id, hourly_rate, daily_rate, monthly_rate)
VALUES ('00000000-0000-0000-0000-000000000001', 90000, 590000, 7900000)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.pricing_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pricing public read" ON public.pricing_settings
  FOR SELECT USING (true);

CREATE POLICY "pricing staff update" ON public.pricing_settings
  FOR UPDATE USING (public.is_staff(auth.uid()));
