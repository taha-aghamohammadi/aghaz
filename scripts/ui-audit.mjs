import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const BASE = process.env.APP_URL ?? "http://localhost:5174";
const outDir = join(process.cwd(), ".ui-audit");
mkdirSync(outDir, { recursive: true });

const routes = [
  { path: "/", name: "landing" },
  { path: "/auth", name: "auth" },
  { path: "/brand", name: "brand" },
  { path: "/dashboard", name: "dashboard-unauth" },
];

const findings = [];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    locale: "fa-IR",
  });
  const page = await context.newPage();

  page.on("console", (msg) => {
    if (msg.type() === "error") findings.push(`[console] ${msg.text()}`);
  });
  page.on("pageerror", (err) => findings.push(`[pageerror] ${err.message}`));

  for (const route of routes) {
    const url = `${BASE}${route.path}`;
    const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    const status = res?.status() ?? 0;
    findings.push(`[${route.name}] HTTP ${status} — ${url}`);

    await page.waitForTimeout(800);
    await page.screenshot({
      path: join(outDir, `${route.name}-desktop.png`),
      fullPage: true,
    });

    // Mobile snapshot for landing + auth
    if (route.name === "landing" || route.name === "auth") {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(300);
      await page.screenshot({
        path: join(outDir, `${route.name}-mobile.png`),
        fullPage: true,
      });
      await page.setViewportSize({ width: 1280, height: 800 });
    }
  }

  // Landing: open booking dialog
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  const bookBtn = page.getByRole("button", { name: /رزرو میز/ }).first();
  if (await bookBtn.isVisible()) {
    await bookBtn.click();
    await page.waitForTimeout(800);
    const dialogVisible = await page.getByRole("dialog").isVisible().catch(() => false);
    findings.push(`[booking-dialog] open=${dialogVisible}`);
    if (dialogVisible) {
      await page.screenshot({ path: join(outDir, "booking-dialog.png") });
    }
  } else {
    findings.push("[booking-dialog] CTA not found");
  }

  // Auth flow structure
  await page.goto(`${BASE}/auth`, { waitUntil: "domcontentloaded" });
  findings.push(
    `[auth] has phone=${await page.getByLabel(/شماره موبایل/).isVisible()} signup tab visible`,
  );

  await browser.close();

  const report = findings.join("\n");
  writeFileSync(join(outDir, "report.txt"), report);
  console.log(report);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
