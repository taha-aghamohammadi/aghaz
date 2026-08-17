#!/usr/bin/env node
/**
 * Push migrations to the linked Supabase project (remote Postgres).
 * Requires the database password from Dashboard → Settings → Database.
 *
 * Usage:
 *   SUPABASE_DB_PASSWORD='your-password' npm run db:push
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
for (const line of fs.readFileSync(path.join(root, ".env"), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
  if (!m) continue;
  let value = m[2].trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  if (process.env[m[1]] === undefined) process.env[m[1]] = value;
}

const projectRef =
  process.env.SUPABASE_PROJECT_ID?.trim() || "anratgfyidasufaccslj";
const region = process.env.SUPABASE_DB_REGION?.trim() || "ap-northeast-2";
const password = process.env.SUPABASE_DB_PASSWORD?.trim();

if (!password) {
  console.error(
    "Missing SUPABASE_DB_PASSWORD.\n" +
      "Get it from: https://supabase.com/dashboard/project/" +
      projectRef +
      "/settings/database\n" +
      "Then run: SUPABASE_DB_PASSWORD='...' npm run db:push",
  );
  process.exit(1);
}

const supabaseBin = path.join(root, "node_modules", "supabase", "dist", "supabase.js");
if (!fs.existsSync(supabaseBin)) {
  console.error("Supabase CLI not installed. Run: npm install supabase@2.113.0 --no-save");
  process.exit(1);
}

const encoded = encodeURIComponent(password);
const dbUrl = `postgresql://postgres.${projectRef}:${encoded}@aws-0-${region}.pooler.supabase.com:5432/postgres`;

console.log(`Pushing migrations to ${projectRef} (${region})...`);

const result = spawnSync(
  process.execPath,
  [supabaseBin, "db", "push", "--yes", "--db-url", dbUrl],
  { cwd: root, stdio: "inherit", env: process.env },
);

process.exit(result.status ?? 1);
