# Architecture

This document describes how **آغاز (Aghaz)** — a smart coworking platform — is structured at the code and infrastructure level.

For phased delivery status and future work, see **[ROADMAP.md](./ROADMAP.md)**.

## High-level overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Browser (RTL, fa)                             │
│  Landing · LiveDeskMap · Auth · Account · Dashboard · Admin      │
└────────────────────────────┬────────────────────────────────────┘
                             │
         TanStack Router (file routes) + React Query
                             │
┌────────────────────────────┴────────────────────────────────────┐
│              TanStack Start (SSR + server functions)               │
│  booking.* · auth.* · admin.* · payment.* · wallet.* · door.*      │
└────────────────────────────┬────────────────────────────────────┘
                             │
              Supabase (Postgres + Auth + RLS)
                             │
┌────────────────────────────┴────────────────────────────────────┐
│  Optional workers (not in default Docker image)                  │
│  services/notification-worker · apps/telegram-bot                │
└─────────────────────────────────────────────────────────────────┘
```

| Layer | Technology |
| --- | --- |
| UI | React 19, Tailwind CSS 4, shadcn/ui, Lucide icons |
| Routing / SSR | TanStack Router, TanStack Start, Vite 8 |
| Data fetching | TanStack Query, TanStack Start `createServerFn` |
| Backend / DB | Supabase (PostgreSQL, Row Level Security, Auth) |
| Build / deploy | Nitro `node-server` preset (self-hosted); see [SELF_HOSTING.md](./SELF_HOSTING.md) |

## Design decisions

Why the system looks the way it does. Current architecture above describes **what**; this section records **why** and what we did not choose. Superseded decisions should be marked and linked to replacements.

### TanStack Start on self-hosted Node

**Decision:** Single React app with SSR, file routes, and `createServerFn` server functions. Deploy via Nitro `node-server` (`npm run build` → `npm start`).

**Context:** Coworking ops need a full web app (marketing, booking, admin) without operating a separate API service.

**Alternatives considered:** Separate REST API; serverless edge (e.g. Cloudflare Workers); Lovable-hosted preset.

**Why this:** One codebase, shared types between UI and server logic, straightforward self-hosting on a VPS. Workers (notifications, Telegram) stay optional side processes.

**Status:** Accepted.

### Supabase (Postgres + Auth + RLS) as the backend

**Decision:** Supabase for database, auth session storage, and row-level security. No custom ORM layer.

**Context:** Need multi-user data with strict per-user and staff boundaries without building auth middleware from scratch.

**Alternatives considered:** Plain Postgres + custom auth; Firebase; dedicated backend (Nest/Fastify).

**Why this:** RLS enforces access at the database layer; Auth integrates with the publishable key client; migrations live in `supabase/migrations/`. Service role is used only on the server for OTP and trusted reads.

**Status:** Accepted.

### Phone OTP instead of passwords

**Decision:** Iranian mobile number + SMS OTP. No password field. OTP stored hashed in `phone_otps` (service role only); expiry and attempt limits in application code.

**Context:** Target users expect phone-first login; passwords are poorly adopted for this product.

**Alternatives considered:** Email/password; magic link only; Supabase native phone auth without custom OTP table.

**Why this:** Full control over OTP lifecycle, signup metadata on the OTP row, and Kavenegar integration. `OTP_DEMO_MODE` / dev fallback when SMS is not configured.

**Status:** Accepted. Demo OTP exposure gated by env — not for production.

### Synthetic email for Supabase Auth users

**Decision:** Map each phone to `{digits}@phone.hayat.space` and use Supabase Auth email + `verifyOtp` / magic-link token for the browser session.

**Context:** Supabase Auth expects an email identifier; we do not collect real email at signup.

**Alternatives considered:** Custom JWT without Supabase Auth; Supabase phone provider only.

**Why this:** Reuses Supabase session, `localStorage` client, and `requireSupabaseAuth` middleware. Domain is legacy branding (`hayat.space`) — may change later.

**Status:** Accepted. Revisit if branding or Auth provider changes ([ROADMAP.md](./ROADMAP.md) branding note).

### Signup requires valid کد ملی (national ID checksum)

**Decision:** New users complete name + national ID on `/auth`. `normalizeNationalId` in `national-id.ts` validates the official 10-digit checksum on client and server.

**Context:** Member records need a stable identity field for admin and future compliance; random 10 digits are not sufficient.

**Alternatives considered:** Optional national ID; length-only check; store unvalidated digits.

**Why this:** Rejects common fake values (e.g. `1234567890`, old placeholder `0012345678`). Dev test value: `0123456789`.

**Status:** Accepted.

### User bookings always start `pending` + `unpaid`

**Decision:** `createUserBooking` inserts bookings with `status: pending` and `payment_status: unpaid`. Users cannot set `confirmed` or `paid` via the public API. Staff `createBooking` and payment flows upgrade state.

**Context:** Prevent forged paid bookings and keep staff confirmation or payment as the gate before occupancy.

**Alternatives considered:** Auto-confirm on submit; trust client-side payment flags.

**Why this:** Aligns with MVP (manual confirm) and payment phases; overlap checks still apply at insert time.

**Status:** Accepted.

### RLS plus explicit `requireStaff()` on server functions

**Decision:** Database policies use `is_staff()` for operational tables. Admin server functions also call `requireStaff()` before staff-only handlers.

**Context:** UI can hide `/admin`, but server functions must not rely on UI alone.

**Alternatives considered:** RLS only; application-only checks without RLS.

**Why this:** Defense in depth — RLS is the primary guard; `requireStaff()` fails fast with a clear error for non-staff API calls.

**Status:** Accepted.

### Shared booking logic in `booking.service.ts`

**Decision:** Pricing, Iran +03:30 time windows, overlap checks, and `AGZ-*` codes live in one service module. Server functions and future workers/bot import it.

**Context:** Booking rules must not diverge between landing map, dialog, admin, payment callback, and door access.

**Alternatives considered:** Duplicate logic in each route; SQL-only rules without app layer.

**Why this:** Single place to change hourly/daily/monthly rules and timezone behavior.

**Status:** Accepted.

### Roles in `user_roles`, not only JWT metadata

**Decision:** `admin`, `staff`, and `user` roles stored in `public.user_roles`. First admin granted via `npm run grant-admin` or SQL after signup.

**Context:** Staff access must be revocable and auditable without redeploying env vars.

**Alternatives considered:** Hardcoded admin UUID list; Supabase `app_metadata` only.

**Why this:** Admin UI can assign roles; RLS `has_role()` / `is_staff()` read the same table.

**Status:** Accepted.

### Zarinpal for online payment (Iran)

**Decision:** Zarinpal redirect flow; callback at `/api/payment/callback`; `payment_orders` tracks authority/ref.

**Context:** Domestic gateway expected for IRT coworking payments in Iran.

**Alternatives considered:** International Stripe; manual bank transfer only; multiple gateways at once.

**Why this:** Scaffold matches local market; sandbox supported for dev. Wallet pay is a separate path on the account page.

**Status:** Accepted for Phase B. Production merchant config still required.

### Kavenegar for SMS OTP

**Decision:** OTP delivery via Kavenegar API (`sms.server.ts`).

**Alternatives considered:** Other Iranian SMS providers; email OTP.

**Why this:** Common choice for Iran; template name configurable via env.

**Status:** Accepted. SMS optional in dev via demo mode.

### Background workers outside the web process

**Decision:** `services/notification-worker` and `apps/telegram-bot` are not started by `npm run dev` or the default Docker image.

**Context:** Polling notifications and Telegram long-polling should not block or crash the HTTP server.

**Alternatives considered:** In-process cron inside Nitro; Supabase Edge Functions only.

**Why this:** Simple ops model — run workers as separate systemd/Docker services when needed.

**Status:** Accepted. Workers are partial/scaffolded — see [ROADMAP.md](./ROADMAP.md).

### Desk availability: app check + SQL helper

**Decision:** `isDeskAvailable()` in `booking.service.ts` plus SQL `is_desk_available(desk_id, start, end)` for overlap prevention.

**Context:** Double-booking the same desk must be impossible under concurrent requests.

**Alternatives considered:** Application-only check; optimistic UI without server validation.

**Why this:** App layer gives clear errors to users; SQL function supports constraints and future triggers.

**Status:** Accepted.

## Directory layout

```
src/
├── routes/
│   ├── __root.tsx
│   ├── index.tsx              # Landing
│   ├── auth.tsx
│   ├── brand.tsx
│   ├── api/payment/callback.tsx   # Zarinpal redirect handler
│   └── _authenticated/
│       ├── account.tsx        # Profile + my bookings
│       ├── dashboard.tsx      # Member booking dashboard
│       └── admin/             # Staff panel
├── components/site/
│   ├── LiveDeskMap.tsx        # Live desk map from Supabase
│   ├── BookingDialog.tsx      # Desk-aware booking flow
│   ├── SiteHeader.tsx, SiteFooter.tsx, receipt-document.ts
├── lib/
│   ├── booking.service.ts     # Shared pricing, windows, availability
│   ├── booking.functions.ts   # Public desks, createUserBooking, cancel
│   ├── admin.functions.ts     # Admin + listMyBookings
│   ├── auth.server.ts, auth.functions.ts
│   ├── national-id.ts         # Iranian کد ملی checksum (client + server)
│   ├── payment.server.ts, payment.functions.ts
│   ├── wallet.functions.ts
│   ├── door.functions.ts
│   ├── sms.server.ts
│   └── fa-format.ts, error-*.ts
├── integrations/supabase/
│   ├── client.ts, client.server.ts
│   ├── auth-middleware.ts, auth-attacher.ts
│   └── types.ts
├── server.ts, start.ts
apps/telegram-bot/             # Telegram polling bot (optional)
services/notification-worker/  # Notification delivery (optional)
supabase/migrations/
```

## Routing

Routes follow [TanStack Router file conventions](https://tanstack.com/router). See `src/routes/README.md`.

| Path | File | Access |
| --- | --- | --- |
| `/` | `index.tsx` | Public |
| `/auth` | `auth.tsx` | Public |
| `/brand` | `brand.tsx` | Public |
| `/account` | `_authenticated/account.tsx` | Authenticated |
| `/dashboard` | `_authenticated/dashboard.tsx` | Authenticated |
| `/admin` | `_authenticated/admin/*` | Authenticated + staff (UI gate) |
| `/api/payment/callback` | `api/payment/callback.tsx` | Public (gateway redirect) |

`_authenticated/route.tsx` redirects to `/auth` if no Supabase user. Admin routes check `getMyAccess()` for staff roles.

## Authentication flow

Phone-based OTP (no password):

1. **Request OTP** — `requestPhoneOtp` validates phone; stores hashed OTP in `phone_otps`; attempts Kavenegar SMS via `sms.server.ts`.
2. **Demo fallback** — If SMS fails and dev/demo mode is on, `demoCode` is returned to the client (not for production).
3. **Verify OTP** — `consumeOtp` + `issueSessionToken` (create user if needed, upsert profile).
4. **Signup** — New users complete profile on `/auth` (name + کد ملی). `normalizeNationalId` in `national-id.ts` validates the 10-digit checksum on client and server.
5. **Client session** — `supabase.auth.verifyOtp` with magic-link token; session in `localStorage`.

Synthetic email: `{phone_digits}@phone.hayat.space` (legacy domain — see [ROADMAP.md](./ROADMAP.md) branding note).

Authenticated server functions use `requireSupabaseAuth` + Bearer token from `attachSupabaseAuth`.

## Database model

Core tables (`supabase/migrations/`):

| Table | Purpose |
| --- | --- |
| `profiles` | User profile; optional `telegram_id` for bot linking |
| `phone_otps` | OTP hashes (service role only) |
| `user_roles` | `admin`, `staff`, `user` |
| `desks` | Inventory, rates, zones, manual status |
| `bookings` | Reservations (`desk_id`, times, status, payment_status) |
| `transactions` | Staff finance ledger (income/expense) |
| `payment_orders` | Zarinpal authority/ref tracking |
| `wallets` | Per-user balance (IRT) |
| `wallet_transactions` | Wallet ledger |
| `notifications` | Outbound notification queue |
| `door_events` | Smart door audit log |

**RLS:** Users see own profiles/bookings/wallet; staff see all operational data via `is_staff()`. `phone_otps` has no client access.

**SQL helpers:** `has_role()`, `is_staff()`, `is_desk_available(desk_id, start, end)`.

## Server functions

| Module | Key functions | Auth |
| --- | --- | --- |
| `auth.functions.ts` | `requestPhoneOtp`, `verifyPhoneOtp`, `updateMyProfile` | OTP public; profile requires auth |
| `booking.functions.ts` | `listPublicDesks`, `checkDeskAvailability`, `createUserBooking`, `cancelMyBooking` | Public list; booking requires auth |
| `admin.functions.ts` | Overview, bookings CRUD, desks, members, roles, finance, `listMyBookings` | Auth + `requireStaff()` on staff ops |
| `payment.functions.ts` | `createBookingPayment`, `handlePaymentCallback` | Auth; callback public route |
| `wallet.functions.ts` | `getWalletBalance`, `payBookingFromWallet`, `adjustWalletBalance` | Auth; adjust staff-only |
| `door.functions.ts` | `requestDoorUnlock`, `verifyDoorUnlockToken` | Member unlock auth; ESP device key |

Shared business logic lives in **`booking.service.ts`** (pricing, time windows, overlap checks) for reuse by web, future bot, and door flows.

## Booking system (current state)

End-to-end flow:

1. **Live map** — `listPublicDesks` loads active desks + overlapping bookings; `LiveDeskMap` shows free / held / busy.
2. **Select desk** — User opens `BookingDialog` with desk rates from DB (not hardcoded).
3. **Auth gate** — Logged-out users redirect to `/auth` with pending booking restored from `sessionStorage`.
4. **Create** — `createUserBooking` inserts `status: pending`, `payment_status: unpaid`, code `AGZ-*`.
5. **Confirm** — Staff toggles confirmed/paid in admin, **or** user pays via Zarinpal / wallet on account page.
6. **Cancel** — User can cancel own `pending` bookings.

Overlap prevention: application query in `isDeskAvailable()` + SQL `is_desk_available()`.

## Payment flow (partial)

1. User clicks «پرداخت آنلاین» on account → `createBookingPayment` → Zarinpal redirect.
2. Gateway returns to `/api/payment/callback` → `processPaymentCallback` → booking `paid` + `confirmed`.

Requires `SITE_URL`, `ZARINPAL_MERCHANT_ID` (sandbox OK for dev).

## Background workers

Not started by the main web server. Run separately:

| Worker | Path | Purpose |
| --- | --- | --- |
| Notification worker | `services/notification-worker/index.ts` | Poll `notifications` where `status = pending` |
| Telegram bot | `apps/telegram-bot/index.ts` | `/start`, `/link`, `/my` (scaffold) |

Both need `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Bot needs `TELEGRAM_BOT_TOKEN`.

## Error handling

- `src/server.ts` — SSR catastrophic error HTML pages
- `src/start.ts` — request middleware for uncaught errors
- Root `ErrorComponent` + `reportLovableError` / client error reporting

## Environment variables

See [.env.example](../.env.example). Minimum for MVP:

| Variable | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | Client |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | Server user client |
| `SUPABASE_SERVICE_ROLE_KEY` | OTP, overlap reads, workers (server only) |

Optional: `SITE_URL`, `KAVENEGAR_*`, `ZARINPAL_*`, `TELEGRAM_BOT_TOKEN`, `DOOR_DEVICE_API_KEY`.

Never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser.

## Deployment

Self-hosted Node via Nitro `node-server`:

```sh
npm run build
npm start
```

See [SELF_HOSTING.md](./SELF_HOSTING.md). Local dev: `npm run dev`.

## Related docs

- [ROADMAP.md](./ROADMAP.md) — phases, risks, future features
- [DEVELOPER.md](./DEVELOPER.md) — setup and conventions
- [MVP_CHECKLIST.md](./MVP_CHECKLIST.md) — Phase A manual tests
