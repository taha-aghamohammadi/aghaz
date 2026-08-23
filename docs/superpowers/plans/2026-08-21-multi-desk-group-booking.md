# Multi-Desk Group Booking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Users can select and book multiple desks in a single booking, with a configurable max desks per booking.

**Architecture:** New `booking_desks` junction table is the source of truth for desk assignments. `bookings.desk_id`/`desk_code` remain populated with first desk for backward compat. Frontend desk cards become multi-select toggles with a sticky selection bar. Server validates availability for all desks atomically and returns per-desk conflict info.

**Tech Stack:** Supabase (Postgres), TanStack Start server functions, React + TanStack Router, shadcn/radix UI, Zod

## Global Constraints

- Persian (Farsi) UI — all user-facing strings in Farsi
- Supabase Postgres with RLS
- Hand-maintained types in `src/integrations/supabase/types.ts`
- No test framework — verify via `npm run lint`, `npm run build`
- Migration naming: `YYYYMMDDHHMMSS_descriptive.sql`
- Existing `bookings.desk_id`/`desk_code` columns kept for backward compat (telegram bot, my-bookings list)

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `supabase/migrations/20260821120000_multi_desk_booking.sql` | Create | `booking_desks` table + `max_desks_per_booking` column + RLS |
| `src/integrations/supabase/types.ts` | Modify | Add `booking_desks` table type, add `max_desks_per_booking` to `pricing_settings` |
| `src/lib/booking.service.ts` | Modify | Add `fetchMaxDesksPerBooking()`, update `findOverlappingBookings` to also check `booking_desks` |
| `src/lib/booking.functions.ts` | Modify | Change `createUserBooking` to accept `deskIds: uuid[]`, multi-desk availability + insert logic |
| `src/components/site/BookingDialog.tsx` | Modify | Multi-select desks, selection bar, cap indicator, combined total, multi-desk confirm flow |

---

### Task 1: Migration — booking_desks table + config column

**Files:**
- Create: `supabase/migrations/20260821120000_multi_desk_booking.sql`

**Interfaces:**
- Produces: `public.booking_desks` table, `public.pricing_settings.max_desks_per_booking` column

- [ ] **Step 1: Create the migration file**

```sql
-- Multi-desk group booking: junction table + max config

CREATE TABLE public.booking_desks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  desk_id uuid NOT NULL REFERENCES public.desks(id),
  desk_code text NOT NULL,
  unit_price integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_booking_desks_booking_id ON public.booking_desks(booking_id);
CREATE INDEX idx_booking_desks_desk_id ON public.booking_desks(desk_id);

ALTER TABLE public.booking_desks ENABLE ROW LEVEL SECURITY;

-- Users can read desks for their own bookings
CREATE POLICY "booking_desks user read own"
  ON public.booking_desks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_desks.booking_id
        AND b.user_id = auth.uid()
    )
  );

-- Staff can read all booking desks
CREATE POLICY "booking_desks staff read all"
  ON public.booking_desks FOR SELECT
  USING (public.is_staff(auth.uid()));

-- Only service role can insert/update/delete (server-side only)
CREATE POLICY "booking_desks service write"
  ON public.booking_desks FOR ALL
  USING (true)
  WITH CHECK (true);

-- Add max_desks_per_booking to pricing_settings
ALTER TABLE public.pricing_settings
  ADD COLUMN max_desks_per_booking integer NOT NULL DEFAULT 4;
```

- [ ] **Step 2: Verify migration applies**

Run: `cd supabase && npx supabase db reset` (or `npx supabase migration up` if local DB is running)
Expected: Migration applies without errors, `booking_desks` table exists, `pricing_settings` has new column

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260821120000_multi_desk_booking.sql
git commit -m "feat: add booking_desks junction table and max_desks_per_booking config"
```

---

### Task 2: Update TypeScript types

**Files:**
- Modify: `src/integrations/supabase/types.ts:9-10` (add `booking_desks` to Tables)
- Modify: `src/integrations/supabase/types.ts:133-167` (add `max_desks_per_booking` to pricing_settings)

**Interfaces:**
- Consumes: migration from Task 1
- Produces: `Database["public"]["Tables"]["booking_desks"]` type, updated `pricing_settings` Row/Insert/Update

- [ ] **Step 1: Add booking_desks table type to types.ts**

Insert after the `bookings` table definition (after line 84, before `desks`):

```typescript
      booking_desks: {
        Row: {
          id: string;
          booking_id: string;
          desk_id: string;
          desk_code: string;
          unit_price: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          booking_id: string;
          desk_id: string;
          desk_code: string;
          unit_price: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          booking_id?: string;
          desk_id?: string;
          desk_code?: string;
          unit_price?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "booking_desks_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "booking_desks_desk_id_fkey";
            columns: ["desk_id"];
            isOneToOne: false;
            referencedRelation: "desks";
            referencedColumns: ["id"];
          },
        ];
      };
```

- [ ] **Step 2: Add max_desks_per_booking to pricing_settings**

In the `pricing_settings` table type, add `max_desks_per_booking` to Row, Insert, and Update:

Row: add `max_desks_per_booking: number;` after `discount_ends_at`
Insert: add `max_desks_per_booking?: number;` after `discount_ends_at`
Update: add `max_desks_per_booking?: number;` after `discount_ends_at`

- [ ] **Step 3: Verify types compile**

Run: `npm run build`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add src/integrations/supabase/types.ts
git commit -m "feat: add booking_desks types and max_desks_per_booking to pricing_settings"
```

---

### Task 3: Backend service updates

**Files:**
- Modify: `src/lib/booking.service.ts:10-16` (add maxDesksPerBooking to PricingTiers)
- Modify: `src/lib/booking.service.ts:130-170` (update mapPricingRow, fetchPricingSettings)
- Modify: `src/lib/booking.service.ts:197-223` (update findOverlappingBookings)

**Interfaces:**
- Consumes: types from Task 2
- Produces: `fetchMaxDesksPerBooking(client)` → number, updated `findOverlappingBookings` checks both tables

- [ ] **Step 1: Add maxDesksPerBooking to PricingTiers and defaults**

```typescript
// In PricingTiers type (line 10-16), add:
export type PricingTiers = {
  hourlyRate: number;
  dailyRate: number;
  monthlyRate: number;
  discountPercent: number;
  discountEndsAt: string | null;
  maxDesksPerBooking: number;  // ADD THIS
};

// In DEFAULT_PRICING (line 140-146), add:
export const DEFAULT_PRICING: PricingTiers = {
  hourlyRate: 90000,
  dailyRate: 590000,
  monthlyRate: 7900000,
  discountPercent: 0,
  discountEndsAt: null,
  maxDesksPerBooking: 4,  // ADD THIS
};

// In mapPricingRow (line 130-138), add:
export function mapPricingRow(row: PricingRow): PricingTiers {
  return {
    hourlyRate: row.hourly_rate,
    dailyRate: row.daily_rate,
    monthlyRate: row.monthly_rate,
    discountPercent: row.discount_percent ?? 0,
    discountEndsAt: row.discount_ends_at,
    maxDesksPerBooking: row.max_desks_per_booking ?? 4,  // ADD THIS
  };
}
```

- [ ] **Step 2: Update findOverlappingBookings to check booking_desks too**

The current function queries `bookings` by `desk_id`. For group bookings, a desk might only appear in `booking_desks`. We need to also check `booking_desks` for overlapping bookings:

```typescript
export async function findOverlappingBookings(
  client: SupabaseClient<Database>,
  deskId: string,
  startAt: string,
  endAt: string,
): Promise<BookingRow[]> {
  // Check direct bookings (backward compat)
  const { data: directBookings, error: err1 } = await client
    .from("bookings")
    .select("*")
    .eq("desk_id", deskId)
    .neq("status", "cancelled")
    .lt("start_at", endAt)
    .gt("end_at", startAt);

  if (err1) throw new Error("بررسی ظرفیت میز ناموفق بود.");

  // Check group bookings via booking_desks junction table
  const { data: groupBookingIds, error: err2 } = await client
    .from("booking_desks")
    .select("booking_id")
    .eq("desk_id", deskId);

  if (err2) throw new Error("بررسی ظرفیت میز ناموفق بود.");

  const groupIds = (groupBookingIds ?? []).map((r) => r.booking_id);
  let groupBookings: BookingRow[] = [];
  if (groupIds.length > 0) {
    const { data, error: err3 } = await client
      .from("bookings")
      .select("*")
      .in("id", groupIds)
      .neq("status", "cancelled")
      .lt("start_at", endAt)
      .gt("end_at", startAt);
    if (err3) throw new Error("بررسی ظرفیت میز ناموفق بود.");
    groupBookings = data ?? [];
  }

  // Merge and dedupe
  const all = [...(directBookings ?? []), ...groupBookings];
  const seen = new Set<string>();
  return all.filter((b) => {
    if (seen.has(b.id)) return false;
    seen.add(b.id);
    return true;
  });
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/booking.service.ts
git commit -m "feat: add maxDesksPerBooking config and update overlap check for booking_desks"
```

---

### Task 4: Backend functions — multi-desk booking creation

**Files:**
- Modify: `src/lib/booking.functions.ts:20-28` (update Zod schema)
- Modify: `src/lib/booking.functions.ts:83-112` (update checkDeskAvailability to handle multiple)
- Modify: `src/lib/booking.functions.ts:114-194` (rewrite createUserBooking for deskIds[])

**Interfaces:**
- Consumes: service functions from Task 3, types from Task 2
- Produces: `createUserBooking` accepts `{deskIds: uuid[], ...}`, returns `{id, code, desk_code, desk_ids[], ...}`

- [ ] **Step 1: Update Zod schema to accept deskIds array**

```typescript
const bookingInputSchema = z.object({
  deskIds: z.array(z.string().uuid()).min(1),  // CHANGED from deskId
  bookingType: z.enum(["hourly", "daily", "monthly"]),
  dateStr: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startHour: z.number().int().min(BUSINESS_HOUR_START).max(BUSINESS_HOUR_END).optional(),
  duration: z.number().int().min(1).max(365).optional(),
  months: z.number().int().min(1).max(12).optional(),
  note: z.string().trim().max(200).optional().default(""),
});
```

- [ ] **Step 2: Rewrite createUserBooking handler**

Replace the handler (lines 117-193) with:

```typescript
.handler(async ({ data, context }) => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const supabase = context.supabase;

  // 1. Fetch pricing (includes maxDesksPerBooking)
  const pricing = await fetchPricingSettings(supabaseAdmin);

  // 2. Validate count
  if (data.deskIds.length > pricing.maxDesksPerBooking) {
    throw new Error(`حداکثر ${pricing.maxDesksPerBooking} میز قابل رزرو است.`);
  }

  // 3. Fetch all desks, verify active + not maintenance
  const { data: desks, error: desksErr } = await supabase
    .from("desks")
    .select("*")
    .in("id", data.deskIds)
    .eq("is_active", true);

  if (desksErr || !desks || desks.length !== data.deskIds.length) {
    throw new Error("یک یا چند میز انتخاب‌شده موجود نیست.");
  }
  const maintenanceDesk = desks.find((d) => d.status === "maintenance");
  if (maintenanceDesk) {
    throw new Error(`میز ${maintenanceDesk.code} در تعمیر است.`);
  }

  // 4. Compute booking window
  const window = computeBookingWindow({
    bookingType: data.bookingType,
    dateStr: data.dateStr,
    startHour: data.startHour,
    duration: data.duration,
    months: data.months,
  });

  // 5. Check availability for ALL desks
  const unavailableDeskCodes: string[] = [];
  for (const desk of desks) {
    const available = await isDeskAvailable(
      supabaseAdmin,
      desk.id,
      window.startAt,
      window.endAt,
    );
    if (!available) unavailableDeskCodes.push(desk.code);
  }

  if (unavailableDeskCodes.length > 0) {
    return { unavailableDeskCodes } as any;  // Signal to UI
  }

  // 6. Pricing: sum of per-desk prices × units
  let totalAmount = 0;
  const deskPrices: { desk: typeof desks[number]; unitPrice: number }[] = [];
  for (const desk of desks) {
    const unitPrice = unitPriceForDesk(desk, data.bookingType);
    totalAmount += computeTotalAmount(unitPrice, window.units);
    deskPrices.push({ desk, unitPrice });
  }
  const firstUnitPrice = deskPrices[0].unitPrice;

  // 7. Fetch profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, phone")
    .eq("id", context.userId)
    .maybeSingle();

  // 8. Generate unique code
  let code = generateBookingCode();
  for (let i = 0; i < 5; i++) {
    const { data: existing } = await supabaseAdmin
      .from("bookings")
      .select("id")
      .eq("code", code)
      .maybeSingle();
    if (!existing) break;
    code = generateBookingCode();
  }

  // 9. Insert booking (first desk for backward compat)
  const firstDesk = desks[0];
  const { data: row, error } = await supabase
    .from("bookings")
    .insert({
      code,
      user_id: context.userId,
      desk_id: firstDesk.id,
      desk_code: firstDesk.code,
      booking_type: data.bookingType,
      start_at: window.startAt,
      end_at: window.endAt,
      units: window.units,
      unit_price: firstUnitPrice,
      total_amount: totalAmount,
      status: "pending",
      payment_status: "unpaid",
      full_name: profile?.full_name ?? "",
      phone: profile?.phone ?? "",
      note: data.note,
    })
    .select("id, code, desk_code, booking_type, start_at, end_at, units, unit_price, total_amount, status, payment_status")
    .single();

  if (error) throw new Error("ثبت رزرو ناموفق بود.");

  // 10. Insert junction rows
  const junctionRows = deskPrices.map(({ desk, unitPrice }) => ({
    booking_id: row.id,
    desk_id: desk.id,
    desk_code: desk.code,
    unit_price: unitPrice,
  }));

  const { error: jErr } = await supabase.from("booking_desks").insert(junctionRows);
  if (jErr) {
    // Rollback: delete the booking
    await supabase.from("bookings").delete().eq("id", row.id);
    throw new Error("ثبت جزئیات رزرو ناموفق بود.");
  }

  return { ...row, desk_ids: data.deskIds };
});
```

- [ ] **Step 3: Update checkDeskAvailability for multi-desk**

The existing single-desk check can stay as-is for pre-checks. The real multi-desk validation happens in `createUserBooking`. No change needed here — the UI will call this per-desk as a quick pre-check, but the server function handles the full validation.

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/booking.functions.ts
git commit -m "feat: multi-desk booking creation with availability check and junction insert"
```

---

### Task 5: Frontend — multi-select desks and selection bar

**Files:**
- Modify: `src/components/site/BookingDialog.tsx:179` (selectedDesk → selectedDesks array)
- Modify: `src/components/site/BookingDialog.tsx:339-344` (total calculation for multiple desks)
- Modify: `src/components/site/BookingDialog.tsx:447-478` (desk card click handler)
- Modify: `src/components/site/BookingDialog.tsx:626-743` (handleConfirm for multi-desk)
- Modify: `src/components/site/BookingDialog.tsx:1030-1096` (confirm view for multi-desk)

**Interfaces:**
- Consumes: `createUserBooking` now accepts `{deskIds: uuid[], ...}`
- Produces: Multi-select UI with sticky selection bar

- [ ] **Step 1: Change state from single desk to array**

Replace:
```typescript
const [selectedDesk, setSelectedDesk] = useState<PublicDesk | null>(null);
```
With:
```typescript
const [selectedDesks, setSelectedDesks] = useState<PublicDesk[]>([]);
```

Add a helper to toggle desk selection:
```typescript
const toggleDesk = useCallback((desk: PublicDesk) => {
  setSelectedDesks((prev) => {
    const exists = prev.find((d) => d.id === desk.id);
    if (exists) return prev.filter((d) => d.id !== desk.id);
    return [...prev, desk];
  });
}, []);
```

Replace `setSelectedDesk(null)` calls with `setSelectedDesks([])`.
Replace `selectedDesk` references with `selectedDesks[0]` where single desk is needed (e.g., conflict check).
For `openFn`: accept `desk` as `PublicDesk | PublicDesk[]`, handle both.

- [ ] **Step 2: Update total calculation for multiple desks**

Replace:
```typescript
const total = useMemo(() => {
  if (!selectedDesk) return 0;
  if (type === "hourly") return current.price * duration;
  if (type === "daily") return current.price * duration;
  return current.price * months;
}, [type, duration, months, current, selectedDesk]);
```
With:
```typescript
const total = useMemo(() => {
  if (selectedDesks.length === 0) return 0;
  const units = type === "monthly" ? months : duration;
  return selectedDesks.reduce((sum, desk) => {
    const deskPrice = unitPriceForDesk(desk, type);
    return sum + deskPrice * units;
  }, 0);
}, [type, duration, months, selectedDesks]);
```

Import `unitPriceForDesk` from `@/lib/booking.service`.

- [ ] **Step 3: Update desk card click to toggle**

Replace:
```typescript
onClick={() => setSelectedDesk(d)}
```
With:
```typescript
onClick={() => toggleDesk(d)}
```

Add visual indicator for selected state — add a check icon or ring when desk is in `selectedDesks`:
```typescript
const isSelected = selectedDesks.some((sd) => sd.id === d.id);
// Add to className: isSelected ? "ring-2 ring-primary" : ""
```

- [ ] **Step 4: Add sticky selection bar**

After the desk grid, when `selectedDesks.length > 0`, show:
```tsx
{selectedDesks.length > 0 && (
  <div className="sticky bottom-0 border-t border-hairline bg-background/95 backdrop-blur px-4 py-3 flex items-center justify-between">
    <div className="text-[13px]">
      <span className="font-semibold">{toFa(selectedDesks.length)}</span> میز انتخاب شده
      {pricing.maxDesksPerBooking && (
        <span className="text-muted-foreground mr-2">
          (حداکثر {toFa(pricing.maxDesksPerBooking)} میز)
        </span>
      )}
    </div>
    <div className="text-[14px] font-semibold">{formatToman(total)}</div>
  </div>
)}
```

- [ ] **Step 5: Update handleConfirm for multi-desk**

In `handleConfirm`, change:
```typescript
deskId: selectedDesk.id,
```
To:
```typescript
deskIds: selectedDesks.map((d) => d.id),
```

Handle the `unavailableDeskCodes` response — if returned, show which desks failed and keep valid ones selected.

- [ ] **Step 6: Update confirm view to show all selected desks**

Replace the single desk summary with a list of all selected desks in the confirmation card.

- [ ] **Step 7: Update description header**

Change `selectedDesk` references in dialog description to show count or first desk name.

- [ ] **Step 8: Verify build**

Run: `npm run build`
Expected: No errors

- [ ] **Step 9: Commit**

```bash
git add src/components/site/BookingDialog.tsx
git commit -m "feat: multi-select desk UI with selection bar and combined pricing"
```

---

### Task 6: Final verification

- [ ] **Step 1: Full build check**

Run: `npm run build`
Expected: Clean build

- [ ] **Step 2: Lint check**

Run: `npm run lint`
Expected: No lint errors

- [ ] **Step 3: Commit any fixes**

If lint/build found issues, fix and commit.
