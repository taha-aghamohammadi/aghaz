# Developer guide

How to run, configure, and extend the آغاز (Aghaz) coworking platform locally.

**Roadmap and feature status:** see [ROADMAP.md](./ROADMAP.md) (authoritative implementation snapshot).

## Prerequisites

- **Node.js** 20+
- A **Supabase** project with migrations applied
- **Service role key** for server-side auth (OTP, user provisioning, public desk overlap reads)

## Quick start

```sh
git clone <repository-url>
cd aghaz-main
npm install
cp .env.example .env
# Fill in Supabase URL, publishable key, and SUPABASE_SERVICE_ROLE_KEY
npm run dev
```

Open http://127.0.0.1:5175 (configured in `package.json`; override with `vite dev --port …`).

### Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Development server with HMR |
| `npm run build` | Production build → `.output/` |
| `npm start` | Run built Node server |
| `npm run preview` | Vite preview |
| `npm run lint` | ESLint |
| `npm run format` | Prettier write |
| `npm run db:push` | Push migrations to linked Supabase project (needs `SUPABASE_DB_PASSWORD`) |
| `npm run grant-admin` | Grant `admin` or `staff` role by phone (needs service role key) |
| `npm run audit:booking` | Playwright: landing scroll funnel, `#desks` / `#pricing`, no duplicate `#spaces` |
| `npm run audit:navbar` | Playwright: header layout at 768 / 1024 / 1280px |

## Environment setup

Copy [.env.example](../.env.example) to `.env`:

```env
# Client (Vite)
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
VITE_SITE_URL=http://127.0.0.1:5175

# Server
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
SITE_URL=http://127.0.0.1:5175

# Optional — Phase B+
KAVENEGAR_API_KEY=
KAVENEGAR_OTP_TEMPLATE=verify
OTP_DEMO_MODE=true
ZARINPAL_MERCHANT_ID=
ZARINPAL_SANDBOX=true
TELEGRAM_BOT_TOKEN=
TELEGRAM_BOT_USERNAME=
NOTIFICATION_DEFAULT_CHANNEL=telegram
LIMOSMS_BOOKING_OTP_ID=
DOOR_DEVICE_API_KEY=
```

Never commit `.env`. `.gitignore` excludes it.

`NOTIFICATION_DEFAULT_CHANNEL` is the default message channel for new users (`telegram` or `sms`); users override it in their account settings or via the bot's `/pref` command.

### Apply database schema

```sh
npm run db:push
# or: supabase db push
```

Requires `SUPABASE_DB_PASSWORD` from Dashboard → Settings → Database. Or run SQL files in `supabase/migrations/` in order via the Supabase dashboard.

### Seed admin user

The user must **sign up first** (phone OTP at `/auth`) so a row exists in `profiles`.

**Option A — npm script (recommended)**

```sh
npm run grant-admin -- --phone 09123456789
# staff role:
npm run grant-admin -- --phone 09123456789 --role staff
```

Uses `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from `.env`. Script: `scripts/grant-admin.mjs`.

**Option B — SQL in Supabase dashboard**

```sql
INSERT INTO public.user_roles (user_id, role)
VALUES ('<uuid-from-auth.users>', 'admin');
```

After granting, sign in again (or refresh) so `/admin` picks up the new role.

## Running background workers (optional)

Workers are **not** started by `npm run dev` or the default Docker image.

```sh
# Notification delivery (polls notifications table, Telegram-first / SMS-fallback)
npm run worker

# Telegram bot (polling)
npm run bot
```

Both scripts load `.env` via `--env-file`. They require `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. The bot also needs `TELEGRAM_BOT_TOKEN`; the app server needs `TELEGRAM_BOT_USERNAME` for deep-link generation. Delivery to Telegram falls back to SMS automatically when the user isn't linked or Telegram is unreachable.

See [ROADMAP.md](./ROADMAP.md) for maturity of each worker.

## Project conventions

### RTL and Persian UI

- Root HTML: `lang="fa"` `dir="rtl"` in `__root.tsx`
- Font: Vazirmatn via Google Fonts
- Use `fa-format.ts` for admin numbers/dates/currency
- Marketing pages may use inline `toFa()` for digits

### Adding a route

1. Create `src/routes/your-page.tsx` (or nested path).
2. Export `Route` via `createFileRoute("/your-path")`.
3. `routeTree.gen.ts` is auto-generated — do not edit manually.

### Adding a server function

```ts
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const myFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("profiles").select("*");
    return data;
  });
```

Keep `attachSupabaseAuth` registered in `src/start.ts`.

For booking-related logic, extend **`booking.service.ts`** rather than duplicating rules in UI or workers.

### UI components

- shadcn primitives: `src/components/ui/`
- Product UI: `src/components/site/`
- Theme tokens: `src/styles.css`
- Marketing images: `src/assets/` (bundled via `src/lib/site-assets.ts`)
- Public contact mailto: `src/lib/site-contact.ts` (`info@aghaz.ir`)

### Landing page and booking funnel

On `/`, most «رزرو» CTAs **scroll to the live map** (`#desks`) instead of opening the dialog immediately:

| CTA location | Behavior on `/` |
| --- | --- |
| Header «رزرو میز» | `scrollToLiveMap()` |
| Hero / bottom CTA | `scrollToLiveMap()` |
| Pricing tier buttons | `prepareTier(type)` then scroll to map |
| Live map «رزرو این میز» | `useBooking().open({ desk, type?, date? })` → dialog |

On other routes (e.g. `/brand`), header «رزرو میز» still opens `BookingDialog` directly.

The live map card carries a **4-mode availability toggle** (لحظهای / اول میز / اول زمان / هفته), persisted to localStorage under `aghaz_availability_mode` (`desk-display-meta.ts`):

- **لحظهای / اول میز** — desk status at current time.
- **اول زمان** — a compact date + hour picker above the map; statuses reflect the chosen window.
- **هفته** — replaces the grid with the 7-day `WeekAvailabilityGrid`; clicking a free cell opens the dialog with that date preselected (`date?`).

Helpers:

- `src/lib/scroll-to-live-map.ts` — smooth scroll with sticky-header offset (`scroll-mt-24` on `#desks`)
- `BookingDialog` provider — `prepareTier()` sets preferred hourly/daily/monthly before desk selection
- `src/components/site/week-availability-grid.tsx` — shared week planner (homepage + booking dialog)

Section anchors on landing: `#gallery`, `#desks`, `#pricing` (no separate `#spaces` section).

Global rates for landing tiers and booking defaults come from **`pricing_settings`** (`getPublicPricing`, `fetchPricingSettings` in `booking.service.ts`). Per-desk overrides remain on the `desks` table.

### Playwright audits (optional)

`playwright` is a devDependency. First run: `npx playwright install chromium`.

```sh
npm run dev
npm run audit:booking    # APP_URL defaults to http://127.0.0.1:5175
npm run audit:navbar
node scripts/ui-audit.mjs           # screenshots → .ui-audit/
node scripts/admin-pricing-audit.mjs  # /admin/pricing (needs staff session or shows access denied)
```

Set `APP_URL` if the dev server uses a different host or port.

### Supabase clients

| Import | Use when |
| --- | --- |
| `@/integrations/supabase/client` | Browser, user session, RLS |
| `@/integrations/supabase/client.server` | Trusted server-only (`supabaseAdmin`) |
| `requireSupabaseAuth` middleware | Server functions as logged-in user |

Do not import `client.server.ts` from client-shipped route bundles.

## Feature status

See the **Implementation status snapshot** table in [ROADMAP.md](./ROADMAP.md). Do not rely on outdated per-feature tables in this file.

## Common tasks

### Test MVP booking flow

Follow [MVP_CHECKLIST.md](./MVP_CHECKLIST.md).

### Complete signup (new users)

After OTP verify, new users fill name + **کد ملی** on `/auth`. National ID must pass the official 10-digit checksum (not just any 10 digits). For local testing you can use `0123456789`. Validation lives in `src/lib/national-id.ts` (client + server).

### Enable production SMS

1. Set `KAVENEGAR_API_KEY` and template name.
2. Set `OTP_DEMO_MODE=false` and deploy with `NODE_ENV=production`.
3. Verify `demoCode` is not returned from `requestPhoneOtp`.

### Enable Zarinpal payments

1. Set `ZARINPAL_MERCHANT_ID` (sandbox or production).
2. Set `SITE_URL` to your public HTTPS origin (callback URL).
3. Test: account → unpaid booking → «پرداخت آنلاین».

### Connect Telegram bot

1. Create bot via BotFather; set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_BOT_USERNAME` (no `@`).
2. Run `npm run bot`.
3. Users connect from account («اتصال تلگرام») or the login OTP screen — the app generates a one-time `t.me/<bot>?start=<token>` deep link (15-min expiry, `telegram_link_tokens` table); tapping **Start** in Telegram links the chat. Bot commands: `/start <token>`, `/pref sms|telegram`, `/my`.
4. Once linked, OTP codes, booking status, and payment approvals are delivered via Telegram; unlinked users or failed sends fall back to SMS.

## Troubleshooting

| Issue | Likely cause |
| --- | --- |
| `Missing Supabase environment variable` | Incomplete `.env` |
| OTP / signup fails on server | Missing `SUPABASE_SERVICE_ROLE_KEY` |
| Server functions Unauthorized | Not logged in; check `attachSupabaseAuth` in `start.ts` |
| Admin empty / errors | User lacks `staff` or `admin` in `user_roles` — run `npm run grant-admin` |
| «کد ملی معتبر نیست» on signup | National ID failed checksum; use a real کد ملی or dev test value `0123456789` |
| Payment callback does not confirm booking | Wrong `SITE_URL` vs public URL |
| Desk map empty | Migrations not applied; Supabase connection error |
| `vite: command not found` | Run `npm install` |
| Build fails | See [SELF_HOSTING.md](./SELF_HOSTING.md) |

## Self-hosted deployment

See [SELF_HOSTING.md](./SELF_HOSTING.md) for Docker, systemd, nginx.

```sh
npm run build
npm start
```

## Related docs

- [ROADMAP.md](./ROADMAP.md) — phased plan, risks, future ideas
- [ARCHITECTURE.md](./ARCHITECTURE.md) — system design
- [MVP_CHECKLIST.md](./MVP_CHECKLIST.md) — Phase A manual tests
- [SELF_HOSTING.md](./SELF_HOSTING.md) — production deploy
- [CODE_REVIEW.md](./CODE_REVIEW.md) — historical review + resolution status
- [TanStack routes README](../src/routes/README.md)
