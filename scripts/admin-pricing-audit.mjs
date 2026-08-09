/**
 * Admin pricing page — current rates must render (not blank).
 * Usage: npm run dev  then  node scripts/admin-pricing-audit.mjs
 */
import { chromium } from "playwright";

const BASE = process.env.APP_URL ?? "http://127.0.0.1:5175";

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  await page.goto(`${BASE}/admin/pricing`, { waitUntil: "networkidle", timeout: 45000 });

  const state = await page.evaluate(() => {
    const text = document.body.innerText;
    return {
      hasCurrentSection: text.includes("تعرفه‌های فعلی"),
      hasHourly: /ساعتی:\s*[\d۰-۹,]+/.test(text),
      hasDaily: /روزانه:\s*[\d۰-۹,]+/.test(text),
      hasMonthly: /ماهانه:\s*[\d۰-۹,]+/.test(text),
      hasAccessDenied: text.includes("دسترسی مدیریتی ندارید"),
      snippet: text.slice(0, 500),
    };
  });

  console.log(state);
  await page.screenshot({ path: ".ui-audit/admin-pricing-audit.png", fullPage: true });
  await browser.close();

  if (state.hasAccessDenied) {
    console.log("Admin pricing audit skipped — not signed in as staff.");
    return;
  }

  if (!state.hasCurrentSection || !state.hasHourly || !state.hasDaily || !state.hasMonthly) {
    console.error("Admin pricing audit failed — current rates not visible.");
    process.exit(1);
  }
  console.log("Admin pricing audit passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
