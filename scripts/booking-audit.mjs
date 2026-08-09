/**
 * Booking dialog + pricing regression.
 * Usage: npm run dev  then  node scripts/booking-audit.mjs
 */
import { chromium } from "playwright";

const BASE = process.env.APP_URL ?? "http://127.0.0.1:5175";

async function fetchPricing(page) {
  const fromPage = await page.evaluate(() => {
    const section = document.querySelector("#pricing");
    if (!section) return null;
    const text = section.textContent ?? "";
    const hourlyMatch = text.match(/([۰-۹]+)/);
    return { sectionText: text.slice(0, 200), hasPricing: text.length > 50 };
  });
  return fromPage;
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  let failed = false;

  await page.goto(BASE, { waitUntil: "networkidle" });

  await page.goto(`${BASE}#pricing`, { waitUntil: "networkidle" });
  const pricingSection = await fetchPricing(page);
  if (!pricingSection?.hasPricing) {
    console.error("Landing #pricing section missing or empty");
    failed = true;
  } else {
    console.log("landing pricing loaded");
  }

  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "رزرو میز" }).first().click();
  await page.waitForTimeout(800);

  const emptyMsg = page.getByText("برای رزرو، از نقشه میزهای آزاد یک میز انتخاب کنید.");
  if (await emptyMsg.count()) {
    console.error("Booking dialog still shows old empty state");
    failed = true;
  }

  const picker = page.getByText("انتخاب میز");
  if (!(await picker.count())) {
    console.error("Desk picker not shown in booking dialog");
    failed = true;
  }

  const freeDesk = page.locator('[role="dialog"] button:not([disabled])').filter({ hasText: "آزاد" });
  const deskCount = await freeDesk.count();
  console.log("free desk buttons:", deskCount);

  if (deskCount > 0) {
    await freeDesk.first().click();
    await page.waitForTimeout(400);

    const typeSection = page.getByText("نوع رزرو");
    if (!(await typeSection.count())) {
      console.error("Booking form not shown after desk selection");
      failed = true;
    } else {
      console.log("booking form shown after desk pick");
    }
  } else {
    console.warn("No free desks in picker — skipping form step");
  }

  await browser.close();
  if (failed) {
    console.error("Booking audit failed.");
    process.exit(1);
  }
  console.log("Booking audit passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
