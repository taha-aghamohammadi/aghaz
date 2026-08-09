#!/usr/bin/env node
/**
 * Grant admin (or staff) role to a user by phone or user UUID.
 *
 * Usage:
 *   node scripts/grant-admin.mjs --phone 09123456789
 *   node scripts/grant-admin.mjs --id <uuid>
 *   node scripts/grant-admin.mjs --phone 09123456789 --role staff
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function loadEnv() {
  const envPath = path.join(root, ".env");
  const out = { ...process.env };
  try {
    const lines = readFileSync(envPath, "utf8").split("\n");
    for (const line of lines) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i === -1) continue;
      out[t.slice(0, i)] = t.slice(i + 1);
    }
  } catch {
    /* no .env */
  }
  return out;
}

function normalizePhone(raw) {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("0098")) digits = digits.slice(4);
  else if (digits.startsWith("98")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = digits.slice(1);
  if (!/^9\d{9}$/.test(digits)) return null;
  return `+98${digits}`;
}

function parseArgs(argv) {
  let phone = null;
  let id = null;
  let role = "admin";
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--phone" && argv[i + 1]) phone = argv[++i];
    else if (a === "--id" && argv[i + 1]) id = argv[++i];
    else if (a === "--role" && argv[i + 1]) role = argv[++i];
  }
  return { phone, id, role };
}

const env = loadEnv();
const url = env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const { phone, id, role } = parseArgs(process.argv.slice(2));
if (!["admin", "staff"].includes(role)) {
  console.error("Role must be admin or staff");
  process.exit(1);
}
if (!phone && !id) {
  console.error("Usage: node scripts/grant-admin.mjs --phone 09123456789");
  process.exit(1);
}

const supabase = createClient(url, key);

let userId = id;
if (phone) {
  const normalized = normalizePhone(phone);
  if (!normalized) {
    console.error("Invalid phone. Example: 09123456789");
    process.exit(1);
  }
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, full_name, phone")
    .eq("phone", normalized)
    .maybeSingle();
  if (error) {
    console.error("Profile lookup failed:", error.message);
    process.exit(1);
  }
  if (!profile) {
    console.error(`No user with phone ${normalized}. Sign up first at /auth`);
    process.exit(1);
  }
  userId = profile.id;
  console.log(`Found: ${profile.full_name || "—"} (${profile.phone})`);
}

await supabase.from("user_roles").delete().eq("user_id", userId);

const { error: insertErr } = await supabase.from("user_roles").insert({
  user_id: userId,
  role,
});

if (insertErr) {
  console.error("Failed to grant role:", insertErr.message);
  process.exit(1);
}

console.log(`Granted role "${role}" to user ${userId}`);
console.log("Sign in again or refresh /admin to pick up access.");
