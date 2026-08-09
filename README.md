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

Never commit `.env` or expose the service role key to the browser.

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
