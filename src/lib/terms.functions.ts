import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DEFAULT_TERMS, mapTermsRow, TERMS_SETTINGS_ID, type TermsRow } from "@/lib/terms.service";

export const getPublicTerms = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("terms_settings")
    .select("*")
    .eq("id", TERMS_SETTINGS_ID)
    .maybeSingle();
  if (error || !data) return DEFAULT_TERMS;
  return mapTermsRow(data as TermsRow);
});

export const acceptTerms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ version: z.number().int().min(0) }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ terms_accepted_version: data.version } as never)
      .eq("id", context.userId);
    if (error) throw new Error("ثبت تأیید قوانین ناموفق بود.");
    return { ok: true };
  });

export const getMyTermsStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: termsRow }, { data: profile }] = await Promise.all([
      supabaseAdmin.from("terms_settings").select("*").eq("id", TERMS_SETTINGS_ID).maybeSingle(),
      context.supabase
        .from("profiles")
        .select("terms_accepted_version")
        .eq("id", context.userId)
        .maybeSingle(),
    ]);
    const terms = termsRow ? mapTermsRow(termsRow as TermsRow) : DEFAULT_TERMS;
    return {
      terms,
      acceptedVersion:
        (profile as { terms_accepted_version?: number | null } | null)?.terms_accepted_version ??
        null,
    };
  });
