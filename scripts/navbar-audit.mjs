/**
 * Navbar layout regression — staff admin badge should not overlap nav links.
 * Usage: npm run dev  then  node scripts/navbar-audit.mjs
 */
import { chromium } from "playwright";
import fs from "fs";

const BASE = process.env.APP_URL ?? "http://127.0.0.1:5175";
const OUT = ".ui-audit/navbar";
fs.mkdirSync(OUT, { recursive: true });

function measureHeader(page) {
  return page.evaluate(() => {
    const header = document.querySelector("header");
    if (!header) return { error: "no header" };
    const headerRect = header.getBoundingClientRect();
    const nav = header.querySelector("nav");
    const navRect = nav?.getBoundingClientRect();
    let maxRight = 0;
    header.querySelectorAll("a, button").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) maxRight = Math.max(maxRight, r.right);
    });
    const headerCenter = headerRect.left + headerRect.width / 2;
    const navCenter = navRect ? navRect.left + navRect.width / 2 : null;
    return {
      headerW: headerRect.width,
      maxRight,
      clipped: maxRight <= headerRect.right + 2,
      navCentered:
        navCenter !== null && Math.abs(navCenter - headerCenter) <= headerRect.width * 0.08,
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
      horizontalOverflow:
        document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    };
  });
}

async function injectStaffState(page) {
  await page.evaluate(() => {
    const actions = document.querySelector("header .relative.z-10 .hidden.md\\:flex");
    if (!actions) return;
    actions.innerHTML = "";
    const mk = (label, iconOnly = false) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className =
        "inline-flex h-8 shrink-0 items-center rounded-full border px-2.5 text-[13px]";
      b.textContent = iconOnly ? "⚙" : label;
      actions.appendChild(b);
    };
    mk("پنل مدیریت", true);
    mk("داشبورد", true);
    mk("حساب من", true);
    mk("رزرو میز");
  });
}

const browser = await chromium.launch();
let failed = false;

for (const width of [1024, 1280]) {
  const page = await browser.newPage({ viewport: { width, height: 720 } });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 45000 });
  await injectStaffState(page);
  const metrics = await measureHeader(page);
  await page.screenshot({ path: `${OUT}/staff-${width}.png` });
  console.log(`width ${width}:`, metrics);
  if (!metrics.clipped || metrics.horizontalOverflow || !metrics.navCentered) failed = true;
  await page.close();
}

const authPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
await authPage.goto(`${BASE}/auth`, { waitUntil: "networkidle", timeout: 45000 });
const authMetrics = await authPage.evaluate(() => ({
  horizontalOverflow:
    document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  hasDemoBadge: document.body.innerText.includes("حالت دمو"),
}));
await authPage.screenshot({ path: `${OUT}/auth-mobile.png` });
console.log("auth mobile:", authMetrics);
if (authMetrics.horizontalOverflow) failed = true;
await authPage.close();

await browser.close();
if (failed) {
  console.error("Navbar audit failed — overlap or horizontal overflow detected.");
  process.exit(1);
}
console.log("Navbar audit passed.");
