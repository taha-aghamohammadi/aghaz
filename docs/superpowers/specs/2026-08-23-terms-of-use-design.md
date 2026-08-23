# Terms of Use — Design Spec (2026-08-23)

**Goal:** Admin-managed terms with mandatory consent before registration and re-consent on updates.

## 1. Data Model
- `terms_settings` single-row table (id `000...001`, like `pricing_settings`): `content text DEFAULT ''`, `version int DEFAULT 1`, `require_reconsent bool DEFAULT false`, `updated_at timestamptz DEFAULT now()`, `updated_by uuid nullable`. RLS: `SELECT USING(true)`, `UPDATE USING(is_staff(auth.uid()))`. Seed `ON CONFLICT DO NOTHING`. On content change → `version = version+1`.
- `profiles.terms_accepted_version int NULL` — null = never accepted.

## 2. Service & Admin
- `src/lib/terms.service.ts`: `TERMS_SETTINGS_ID`, `TermsSettings {content, version, requireReconsent, updatedAt}`, `DEFAULT_TERMS`, `mapTermsRow`, `fetchTermsSettings(client)`, `needsReconsent(profileVersion, terms)` → `content !== "" && requireReconsent && (profileVersion==null || profileVersion < version)`.
- `src/lib/admin.functions.ts`: `getTermsSettings` (staff, maybeSingle, fallback DEFAULT_TERMS+source), `updateTermsSettings` (z.object{content:max20000, requireReconsent:bool}, bump version atomically if content changed).
- `src/lib/terms.functions.ts`: `acceptTerms` (auth, z.object{version:int}, update profiles.terms_accepted_version).
- `src/routes/_authenticated/admin/terms.tsx`: textarea + checkbox "نیاز به تأیید مجدد", save via `updateTermsSettings`, invalidate `["admin-terms"],["public-terms"]`, shows version/updatedAt.
- `admin/route.tsx` NAV: add `{to:"/admin/terms", label:"قوانین", icon:FileText}`.
- `src/integrations/supabase/types.ts`: add `terms_settings` table, add `terms_accepted_version` to profiles Row/Insert/Update.

## 3. User Flow
- **Signup** (`/auth` step signup): required checkbox "قوانین را خواندم و می‌پذیرم" + link dialog showing current terms. Submit disabled until checked. On `completeSignup` also calls `acceptTerms({version})`.
- **Gate** (`/_authenticated/route.tsx` beforeLoad): fetch terms + profile version. If `needsReconsent` → blocking `TermsGateDialog` (non-dismissible, shows content, "می‌پذیرم" → acceptTerms). If `content!=="" && !requireReconsent && profileVersion != null && profileVersion < version` or never-accepted but not requireReconsent → dismissible banner at top, stored `dismissedTermsVersion` in localStorage.
- Empty terms (version 0 / content "") → no gate, checkbox hidden.

## 4. Edge Cases & Non-goals
- Version bump atomic; stale accept allowed if `version <= currentVersion`.
- Out of scope: per-clause consent, PDF, diff view, email notification.
- Perf: one extra select per gate; no N+1.
- Security: public read terms, staff-only write via RLS.
