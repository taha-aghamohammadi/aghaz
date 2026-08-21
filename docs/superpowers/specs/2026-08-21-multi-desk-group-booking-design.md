# Multi-Desk Group Booking — Design

Date: 2026-08-21

## Goal
Users can reserve multiple desks in one booking (e.g., for their team or friends), with a configurable maximum number of desks per booking.

## Decisions
- **Group booking model:** one booking containing N desks; single payment, single cancel.
- **Config location:** `pricing_settings` DB column (admin-editable without redeploy).
- **Schema:** `booking_desks` junction table (relational source of truth).

## Data model
1. New table:
   ```sql
   create table public.booking_desks (
     id uuid primary key default gen_random_uuid(),
     booking_id uuid not null references public.bookings(id) on delete cascade,
     desk_id uuid not null references public.desks(id),
     desk_code text not null,
     unit_price integer not null,
     created_at timestamptz not null default now()
   );
   create index on public.booking_desks(booking_id);
   create index on public.booking_desks(desk_id);
   ```
   RLS mirroring `bookings` policies: users read own bookings' desks; service role writes.
2. `pricing_settings`: add `max_desks_per_booking integer not null default 4`. Code fallback `DEFAULT_PRICING.maxDesksPerBooking = 4`, read via existing `fetchPricingSettings()`.
3. `bookings.desk_id` / `desk_code` remain, populated with the first selected desk so existing display paths (my-bookings, telegram bot) keep working. Convenience copy only — junction table is authoritative.

## Backend (`src/lib/booking.functions.ts`, `src/lib/booking.service.ts`)
- Zod input changes to `deskIds: uuid[]` (min 1).
- Server validates: all desks exist and are active; count ≤ `max_desks_per_booking`; every desk available for the window via overlap query extended to join `booking_desks`.
- Pricing: sum of per-desk price × units → single `total_amount`.
- Atomicity: Postgres RPC `create_booking_with_desks(...)` inserts the booking row and junction rows in one transaction and returns the booking.
- Race handling: if any desk became unavailable between selection and confirm, server returns `{ unavailableDeskCodes }`; UI keeps valid desks selected and shows which failed.

## Frontend (`src/components/site/BookingDialog.tsx`)
- Desk cards become multi-select toggles (tap to add/remove from selection).
- Sticky selection bar appears when ≥1 desk selected: Persian-digit count ("۲ میز انتخاب شده"), live total price, cap indicator ("حداکثر ۴ میز").
- At the cap, remaining free desks render disabled with a hint.
- Confirm step lists chosen desks with combined total; single card-transfer receipt upload covers all (existing flow unchanged).
- Visual polish guided by frontend-design and ui-ux-pro-max skills.

## Error handling
- Unavailable-at-confirm desks reported per desk code; user adjusts selection and retries.
- Max-count violations rejected server-side (client also disables selection at cap).

## Testing / verification
- Unit checks for max-count enforcement, pricing sum, availability query with group bookings.
- Migration applied locally and verified.
- Manual E2E: select multiple → confirm → receipt flow.

## Out of scope
- Per-desk cancellation within a group booking.
- Mixed booking types within one booking.
- Admin UI for editing the max (direct DB edit for now).
