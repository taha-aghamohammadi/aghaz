# Self-hosting آغاز

This project is a **standalone** TanStack Start application. It does not require Lovable Cloud or any Lovable-specific tooling.

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│   Browser   │────▶│  Node (Nitro)    │────▶│  Supabase   │
│  Vite build │     │  .output/server  │     │  Postgres   │
└─────────────┘     └──────────────────┘     └─────────────┘
```

- **Build:** Vite + TanStack Start + Nitro (`node-server` preset)
- **Runtime:** `node .output/server/index.mjs`
- **Static assets:** served from `.output/public/`
- **SSR / server functions:** handled by Nitro + TanStack Start

## Prerequisites

- Node.js 20+ (22 recommended)
- Supabase project with migrations applied
- Optional: Docker 24+ for container deployment

## Local development

```sh
npm install
cp .env.example .env
npm run dev
```

Default dev URL: http://127.0.0.1:5175 (`vite dev --host 127.0.0.1 --port 5175` in `package.json`)

## Production build

```sh
npm run build
npm start
```

Environment variables must be available at **runtime** (not only at build time) for server functions and OTP:

```env
SUPABASE_URL=...
SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Client bundle reads `VITE_*` variables injected at build time. Rebuild after changing `VITE_SUPABASE_*`.

## Docker

```sh
docker compose up --build
```

The image runs the Nitro Node server on port 3000. Mount or inject `.env` via `env_file` in `docker-compose.yml`.

### Manual Docker

```sh
docker build -t aghaz .
docker run --env-file .env -p 3000:3000 aghaz
```

## Reverse proxy (nginx example)

```nginx
server {
  listen 80;
  server_name aghaz.example.com;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Use TLS (Let's Encrypt / Caddy) in production.

## Process manager (systemd example)

```ini
[Unit]
Description=Aghaz coworking app
After=network.target

[Service]
Type=simple
User=aghaz
WorkingDirectory=/opt/aghaz
EnvironmentFile=/opt/aghaz/.env
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=/usr/bin/node .output/server/index.mjs
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Deploy flow:

```sh
git pull
npm ci
npm run build
sudo systemctl restart aghaz
```

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com) or self-host Supabase.
2. Run SQL migrations in `supabase/migrations/` in order.
3. Copy project URL, publishable key, and service role key into `.env`.
4. Create first admin user: sign up at `/auth`, then:

```sh
npm run grant-admin -- --phone 09123456789
```

Or insert in SQL:

```sql
INSERT INTO public.user_roles (user_id, role)
VALUES ('<uuid>', 'admin');
```

## What was removed (Lovable decoupling)

- `@lovable.dev/vite-tanstack-config` and related plugins
- Lovable error telemetry (`lovable-error-reporting`)
- Cloudflare Workers default preset (replaced with `node-server`)
- `.lovable/` project metadata

## Troubleshooting

| Issue | Fix |
| --- | --- |
| `Missing Supabase environment variable` | Complete `.env`; restart server after changes |
| OTP fails | Add `SUPABASE_SERVICE_ROLE_KEY` |
| `Cannot find module` on start | Run `npm run build` first |
| Port in use | Set `PORT=8080` or `NITRO_PORT=8080` |
| Stale client after env change | Rebuild after changing `VITE_*` vars |
