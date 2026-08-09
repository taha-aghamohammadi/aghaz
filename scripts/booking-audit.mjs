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
    return { sectionText: text.slice(0, 200), hasPricing: text.length > 50 };
  });
  return fromPage;
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  let failed = false;

  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);

  const spacesSection = await page.$("#spaces");
  if (spacesSection) {
    console.error("Duplicate #spaces section still present");
    failed = true;
  } else {
    console.log("no duplicate #spaces section");
  }

  const desksSection = await page.$("#desks");
  if (!desksSection) {
    console.error("Missing #desks section for live map");
    failed = true;
  } else {
    console.log("live desk map #desks present");
  }

  const heroDeskCta = page.getByRole("button", { name: "انتخاب میز" }).first();
  if (!(await heroDeskCta.count())) {
    console.error("Hero primary CTA should scroll to live map");
    failed = true;
  } else {
    console.log("hero has انتخاب میز CTA");
  }

  const headerDeskBtn = page.locator("header button").filter({ hasText: "رزرو میز" });
  if (!(await headerDeskBtn.count())) {
    console.error("Landing header should have رزرو میز scroll button");
    failed = true;
  } else {
    console.log("landing header has رزرو میز button");
  }

  const tierBookButtons = await page.locator("#pricing button").filter({
    hasText: /انتخاب میز با این پلن/,
  }).count();
  console.log("tier scroll buttons in #pricing:", tierBookButtons);
  if (tierBookButtons !== 3) {
    console.error("Expected 3 tier CTAs in #pricing, got", tierBookButtons);
    failed = true;
  }

  await page.locator("#pricing button").first().click();
  await page.waitForTimeout(600);
  const bookingDialogs = await page.locator('[role="dialog"]').count();
  if (bookingDialogs > 0) {
    console.error("Pricing tier click should not open booking dialog");
    failed = true;
  } else {
    console.log("pricing tier click does not open dialog");
  }

  const tierBanner = page.getByText(/پلن .* انتخاب شد/);
  if (!(await tierBanner.count())) {
    console.error("Preferred tier banner not shown after pricing tier click");
    failed = true;
  } else {
    console.log("preferred tier banner visible");
  }

  await page.goto(`${BASE}#pricing`, { waitUntil: "domcontentloaded" });
  const pricingSection = await fetchPricing(page);
  if (!pricingSection?.hasPricing) {
    console.error("Landing #pricing section missing or empty");
    failed = true;
  } else {
    console.log("landing pricing loaded");
  }

  await page.goto(`${BASE}/brand`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  const brandBookBtn = page.getByRole("button", { name: "رزرو میز" }).first();
  if (!(await brandBookBtn.count())) {
    console.error("Brand page should have رزرو میز button opening dialog");
    failed = true;
  } else {
    await brandBookBtn.click();
    await page.waitForTimeout(1200);
    const dialogCount = await page.locator('[role="dialog"]').count();
    if (dialogCount === 0) {
      console.error("Brand header booking should open dialog");
      failed = true;
    } else {
      console.log("brand page opens booking dialog from header");
    }
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
