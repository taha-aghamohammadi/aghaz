# Code review report

> **Historical review (August 2026).** For **current** open issues, risks, and phase status see **[ROADMAP.md](./ROADMAP.md)** — especially §9 Issues, risks, and heads-up.

Review scope: full codebase at initial review. Focus: bugs, security, regressions, missing tests.

Findings below are ordered by severity at review time. **Resolution status** is summarized at the end.

---

## Critical

### 1. OTP code exposed to the client (authentication bypass risk)

`requestPhoneOtp` returns the raw OTP as `demoCode` in the API response. The auth page displays it when SMS is not connected.

**Location:** `src/lib/auth.functions.ts`, `src/routes/auth.tsx`

**Risk:** Anyone who can request an OTP for a phone number receives the code in the HTTP response — no SMS needed. Unacceptable in production.

**Fix:** Integrate SMS; never return `demoCode` in production; gate demo mode behind `NODE_ENV === 'development'`.

### 2. Booking flow does not persist or charge

`BookingDialog.handleConfirm` only builds a local receipt. No call to `createBooking`, no payment, no database write.

**Location:** `src/components/site/BookingDialog.tsx`

**Risk:** Users believe they booked and paid; admin has no record; revenue and occupancy logic cannot work.

**Fix:** Persist booking after payment; set status from payment result.

### 3. Users can create paid bookings via server function

`createBooking` allows any authenticated user to insert rows with `status: "confirmed"` and `payment_status: "paid"`. RLS allows users to insert their own bookings.

**Location:** `src/lib/admin.functions.ts`

**Risk:** Fraudulent “paid” reservations without payment.

**Fix:** Restrict paid/confirmed inserts to staff or post-payment webhook; default new user bookings to `pending` / `unpaid`.

---

## High

### 4. `issueSessionToken` always calls `createUser`

Returning users on sign-in trigger `auth.admin.createUser` without checking existence. Error is ignored; `generateLink` may still work, but behavior is fragile and may log errors or fail in edge cases.

**Location:** `src/lib/auth.server.ts`

**Fix:** Look up user by email first; create only if missing.

### 5. `.env` not in `.gitignore`

Publishable Supabase keys and project ID are in a committed `.env` pattern risk. Service role key must never be committed.

**Location:** `.gitignore`

**Fix:** Add `.env`, `.env.*`, keep `.env.example` with placeholders.

### 6. Admin server functions lack explicit role checks

Most admin handlers rely only on RLS (`is_staff`). UI gates non-staff, but server functions like `getAdminOverview` return partial data for regular users (own bookings only) instead of failing clearly.

**Location:** `src/lib/admin.functions.ts`

**Fix:** Add `is_staff` RPC check at the start of staff-only handlers for consistent errors and defense in depth.

### 7. Price inconsistency across UI

| Context | Hourly rate shown |
| --- | --- |
| `BookingDialog` TYPES | 90,000 TOMAN |
| Landing desk dialog | 45,000 TOMAN |
| Seeded `desks` table | 35,000–55,000 TOMAN |

**Risk:** Wrong customer expectations and billing bugs when booking is wired up.

---

## Medium

### 8. Live availability is static mock data

`DESKS` in `index.tsx` is hardcoded; not synced with `desks` table or real occupancy.

### 9. No payment integration

“تأیید و پرداخت” confirms without payment. Product spec requires online payment.

### 10. Major product features not implemented

Smart door, member dashboard, notifications, AI services, reservation extension — described in README/spec but absent from code.

### 11. Sign-in mode does not verify account exists

Phone-first auth: OTP is sent for any valid phone; after verify, registered users (profile with name + national ID) go home/booking; new users complete signup on `/auth` with phone prefilled.

### 12. `createUser` error not handled in `issueSessionToken`

```ts
await supabaseAdmin.auth.admin.createUser({ ... });
```

Return value `error` is never checked before `generateLink`.

---

## Low

### 13. No automated tests

No unit, integration, or E2E tests. Auth, OTP, RLS, and booking logic are high-risk without coverage.

### 14. README mismatch

Root `README.md` is a Lovable product prompt (“Hayat Space”), npm instructions, not آغاز branding or Bun lockfile.

### 15. Legacy email domain

`phoneToEmail` uses `@phone.hayat.space` while product is آغاز.

### 16. No git repository in workspace

Project folder was not a git repo at review time — version control and `.gitignore` enforcement missing.

### 17. Dependencies not installed by default

Fresh clone requires `npm install`; `vite` not available until install completes.

---

## Positive observations

- **RLS policies** are well structured for profiles, bookings, desks, and transactions.
- **`phone_otps`** correctly blocked from client access.
- **OTP hashing** with SHA-256, expiry, and attempt limits.
- **Iranian phone and national ID** validation (`national-id.ts` — کد ملی checksum).
- **SSR error handling** wrapper in `server.ts` and middleware in `start.ts`.
- **Admin UI** is functional for staff with real Supabase data.
- **RTL / Persian** UX is consistent on marketing and auth flows.

---

## Recommended next steps (at review time)

Most items addressed in subsequent implementation — see resolution table below and [ROADMAP.md](./ROADMAP.md).

1. Remove OTP demo exposure in production; complete SMS integration.
2. Payment gateway production config + `SITE_URL` callback.
3. Atomic wallet transactions; secure Telegram link flow.
4. Add tests for `normalizePhone`, `consumeOtp`, overlap logic, payment callback.

---

## Resolution status (post-implementation)

| # | Finding | Status | Notes |
|---|---------|--------|-------|
| 1 | OTP exposed as `demoCode` | **Partial** | Gated by `NODE_ENV` / `OTP_DEMO_MODE`; Kavenegar scaffold in `sms.server.ts` |
| 2 | Booking UI-only | **Fixed** | `createUserBooking` + `BookingDialog.tsx` |
| 3 | Users forge paid bookings | **Fixed** | `createUserBooking` → pending/unpaid; staff-only `createBooking` |
| 4 | `issueSessionToken` always `createUser` | **Fixed** | Handles existing users in `auth.server.ts` |
| 5 | `.env` not gitignored | **Fixed** | `.gitignore` updated |
| 6 | Admin lacks explicit staff checks | **Fixed** | `requireStaff()` on admin handlers |
| 7 | Price inconsistency across UI | **Fixed** | Landing `#pricing` + dialog use `pricing_settings`; per-desk overrides on `desks` |
| 8 | Static desk map | **Fixed** | `LiveDeskMap.tsx` + `listPublicDesks` |
| 9 | No payment integration | **Partial** | Zarinpal scaffold + account pay button |
| 10 | Major features missing | **Partial** | Wallet/door/Telegram scaffolded — see ROADMAP |
| 11 | Sign-in does not verify account | **Open** | Sign-in still allows OTP for new phones |
| 12 | `createUser` error ignored | **Fixed** | Error handling in `issueSessionToken` |
| 13 | No automated tests | **Open** | — |
| 14 | README mismatch | **Fixed** | README + `docs/` updated |
| 15 | Legacy email domain | **Open** | `@phone.hayat.space` |
| 16 | No git repo | **N/A** | Environment-specific at review time |
| 17 | Dependencies not installed | **N/A** | Run `npm install` on clone |
