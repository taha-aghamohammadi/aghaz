-- Telegram notifications: per-user channel preference + deep-link tokens

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notification_pref text NOT NULL DEFAULT 'telegram';

CREATE TABLE IF NOT EXISTS public.telegram_link_tokens (
  token text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at timestamptz
);

CREATE INDEX IF NOT EXISTS telegram_link_tokens_user_idx ON public.telegram_link_tokens (user_id);

ALTER TABLE public.telegram_link_tokens ENABLE ROW LEVEL SECURITY;

-- Created by the web app (service role) and consumed by the bot (service role);
-- users never touch this table directly.
GRANT ALL ON public.telegram_link_tokens TO service_role;