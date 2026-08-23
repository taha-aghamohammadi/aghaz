import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export const TERMS_SETTINGS_ID = "00000000-0000-0000-0000-000000000001";

export type TermsSettings = {
  content: string;
  version: number;
  requireReconsent: boolean;
  updatedAt: string | null;
};

type TermsRow = Database["public"]["Tables"]["terms_settings"]["Row"];
export type { TermsRow };

export const DEFAULT_TERMS: TermsSettings = {
  content: "",
  version: 0,
  requireReconsent: false,
  updatedAt: null,
};

export function mapTermsRow(row: TermsRow): TermsSettings {
  return {
    content: row.content,
    version: row.version,
    requireReconsent: row.require_reconsent,
    updatedAt: row.updated_at,
  };
}

export async function fetchTermsSettings(client: SupabaseClient<Database>): Promise<TermsSettings> {
  const { data, error } = await client
    .from("terms_settings")
    .select("*")
    .eq("id", TERMS_SETTINGS_ID)
    .maybeSingle();
  if (error || !data) return DEFAULT_TERMS;
  return mapTermsRow(data as TermsRow);
}

// ponytail: simple version compare, add semver/range if terms versioning gets complex
export function needsReconsent(profileVersion: number | null, terms: TermsSettings): boolean {
  if (!terms.content?.trim()) return false;
  if (!terms.requireReconsent) return false;
  if (profileVersion == null) return true;
  return profileVersion < terms.version;
}

export function shouldShowBanner(profileVersion: number | null, terms: TermsSettings): boolean {
  if (!terms.content?.trim()) return false;
  if (needsReconsent(profileVersion, terms)) return false; // hard gate takes precedence
  if (profileVersion == null) return false; // gate handles never-accepted + requireReconsent
  return profileVersion < terms.version; // minor update → banner
}
