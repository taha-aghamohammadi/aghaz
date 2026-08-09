# MVP manual test checklist (Phase A7)

Part of **Phase A** in the product roadmap — see [ROADMAP.md](./ROADMAP.md).

## Prerequisites

- `npm install` and `.env` with Supabase URL, publishable key, and `SUPABASE_SERVICE_ROLE_KEY`
- Apply migrations: `supabase db push` (or run SQL in `supabase/migrations/`)

## End-to-end flow

1. **Landing** — Open `/`, live desk map loads from database (not static mock).
2. **Pick desk** — Click a free desk → «رزرو این میز» opens booking dialog with desk rates.
3. **Auth** — Confirm booking while logged out → redirect to `/auth`, demo OTP shown if SMS not configured. New users complete signup with a valid کد ملی (10 digits + checksum; dev test: `0123456789`).
4. **Book** — After login, complete booking → receipt shows `pending` / `unpaid`, code prefix `AGZ-`.
5. **Account** — `/account` lists booking under «رزروهای من».
6. **Admin** — Grant staff access (`npm run grant-admin -- --phone …`), then confirm booking and toggle payment in `/admin/bookings`.
7. **Cancel** — User can cancel own `pending` booking from account page.

## Security checks

- User cannot insert `paid`/`confirmed` booking via API (only `pending`/`unpaid`).
- Non-staff cannot access admin overview (staff check on server functions).
- Double-booking same desk/time is rejected.

## Deploy

- Set env vars on Lovable/host: Supabase keys, `SITE_URL`, optional SMS/payment vars.
- Run `npm run build` before deploy.

## Branding

- Booking codes use `AGZ-` prefix.
- Receipt shows «در انتظار تأیید» until staff confirms or payment completes.
