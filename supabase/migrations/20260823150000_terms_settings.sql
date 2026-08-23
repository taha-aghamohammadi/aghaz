CREATE TABLE public.terms_settings (
  id uuid PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000001',
  content text NOT NULL DEFAULT '',
  version integer NOT NULL DEFAULT 1,
  require_reconsent boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

INSERT INTO public.terms_settings (id, content, version, require_reconsent)
VALUES ('00000000-0000-0000-0000-000000000001', '', 0, false)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.terms_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "terms public read" ON public.terms_settings FOR SELECT USING (true);
CREATE POLICY "terms staff update" ON public.terms_settings FOR UPDATE USING (public.is_staff(auth.uid()));

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS terms_accepted_version integer;
