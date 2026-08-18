# آغاز (Aghaz)

Smart coworking platform — desk booking, member dashboard, and staff admin panel. Self-hosted TanStack Start app with Supabase backend.

## Quick start

```sh
npm install
cp .env.example .env
# Fill in Supabase credentials (including SERVICE_ROLE_KEY for OTP)
npm run dev
```

Open http://127.0.0.1:5175 (see `npm run dev` in `package.json`)

## Production (Node)

```sh
npm run build
npm start
```

Server listens on `PORT` / `NITRO_PORT` (default **3000**).

## Docker

```sh
cp .env.example .env
docker compose up --build
```

App runs at http://localhost:3000

## Environment

See [.env.example](.env.example). Required for full functionality:

| Variable | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` | Client Supabase URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Client anon/publishable key |
| `SUPABASE_URL` | Server Supabase URL |
| `SUPABASE_PUBLISHABLE_KEY` | Server user-scoped client |
| `SUPABASE_SERVICE_ROLE_KEY` | OTP, user provisioning (server only) |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token (BotFather) — OTP/notification delivery |
| `TELEGRAM_BOT_USERNAME` | Bot username without `@` — deep-link `t.me/<bot>?start=` |
| `NOTIFICATION_DEFAULT_CHANNEL` | Default channel for new users: `telegram` or `sms` |

Never commit `.env` or expose the service role key to the browser.

OTP, payment approvals, and booking status messages are delivered via **Telegram first**, falling back to **SMS** when Telegram is unavailable or the user prefers SMS (toggle in account / `/pref`).

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build → `.output/` |
| `npm start` | Run built Node server |
| `npm run preview` | Vite preview (dev-oriented) |
| `npm run lint` | ESLint |
| `npm run db:push` | Push Supabase migrations |
| `npm run grant-admin` | Grant admin/staff by phone (`--phone`, optional `--role`) |
| `npm run audit:booking` | Playwright check: landing scroll funnel + pricing section |
| `npm run audit:navbar` | Playwright check: header/nav at common breakpoints |
| `npm run check:notify` | Self-check for notification channel/fallback logic |
| `npm run bot` | Run Telegram bot (polling, needs `--env-file`-loaded `.env`) |
| `npm run worker` | Run notification worker (polls `notifications` table) |

## Stack

- React 19, TanStack Router + Start, Tailwind CSS 4, shadcn/ui
- Supabase (Auth, Postgres, RLS)
- Nitro `node-server` preset for self-hosted deployment

## Documentation

- [Roadmap & phases](docs/ROADMAP.md)
- [Developer guide](docs/DEVELOPER.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Self-hosting details](docs/SELF_HOSTING.md)
- [MVP test checklist](docs/MVP_CHECKLIST.md)

## Database

Apply migrations from `supabase/migrations/` to your Supabase project (`npm run db:push`), then grant admin to a signed-up user:

```sh
npm run grant-admin -- --phone 09123456789
```

Or via SQL:

```sql
INSERT INTO public.user_roles (user_id, role)
VALUES ('<auth.users uuid>', 'admin');
```
