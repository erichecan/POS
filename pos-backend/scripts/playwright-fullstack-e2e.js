/* eslint-disable no-console */
// 2026-02-24 22:40:00: 适配中餐菜单（宫保鸡丁）、新 UI 结构（+ 与购物车按钮）
const path = require("node:path");
const fs = require("node:fs/promises");
const { chromium } = require("playwright");

const FRONTEND_URL = `${process.env.PW_E2E_FRONTEND_URL || "http://localhost:5173"}`.replace(/\/$/, "");
const BACKEND_URL = `${process.env.PW_E2E_BACKEND_URL || "http://127.0.0.1:8000"}`.replace(/\/$/, "");
const ADMIN_EMAIL = `${process.env.PW_E2E_ADMIN_EMAIL || "admin@restro.local"}`.trim();
const ADMIN_PASSWORD = `${process.env.PW_E2E_ADMIN_PASSWORD || "Admin@12345"}`.trim();
const PARTNER_API_KEY = `${process.env.PW_E2E_PARTNER_API_KEY || "pos_partner_seed_orders_read_2026"}`.trim();
const SCREENSHOT_DIR = process.env.PW_E2E_SCREENSHOT_DIR
  ? path.resolve(process.env.PW_E2E_SCREENSHOT_DIR)
  : path.resolve(__dirname, "../../output/playwright");
const HEADLESS = process.env.PW_E2E_HEADLESS !== "false";

const nowTag = () => new Date().toISOString().replace(/[:.]/g, "-");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const assertOk = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const waitForHttpReady = async (url, timeoutMs = 60_000) => {
  const start = Date.now();
  let lastError;

  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url, { method: "GET" });
      if (response.ok) {
        return;
      }
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(500);
  }

  throw new Error(`Service not ready: ${url}. lastError=${lastError?.message || "unknown"}`);
};

const saveShot = async (page, name) => {
  const filePath = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  return filePath;
};

const ensureAvailableTable = async (context) => {
  const listResponse = await context.request.get(`${FRONTEND_URL}/api/table`);
  assertOk(listResponse.ok(), `Load tables failed: HTTP ${listResponse.status()}`);
  const listPayload = await listResponse.json();
  const rows = Array.isArray(listPayload?.data) ? listPayload.data : [];

  const firstAvailable = rows.find((table) => `${table?.status || ""}` === "Available");
  if (firstAvailable) {
    return firstAvailable;
  }

  const maxTableNo = rows.reduce((max, row) => Math.max(max, Number(row?.tableNo || 0)), 0);
  const createResponse = await context.request.post(`${FRONTEND_URL}/api/table`, {
    data: {
      tableNo: maxTableNo + 1,
      seats: 4,
    },
    headers: {
      "x-idempotency-key": `pw-e2e-table-${Date.now()}`,
    },
  });
  assertOk(createResponse.ok(), `Create table failed: HTTP ${createResponse.status()}`);
  const createPayload = await createResponse.json();
  return createPayload?.data;
};

const openFirstAvailableTable = async (page, { customerName, customerPhone }) => {
  const cards = page
    .locator("div.cursor-pointer")
    .filter({ has: page.locator("h1:has-text('Table')") })
    .filter({ hasText: "Available" });

  const start = Date.now();
  let count = 0;
  while (Date.now() - start < 20_000) {
    count = await cards.count();
    if (count > 0) {
      break;
    }
    await sleep(500);
  }
  console.log("[playwright-e2e] available-table-cards-detected:", count);
  if (count <= 0) {
    return false;
  }

  const card = cards.first();
  await card.click();

  const openModal = page.locator("div.fixed.inset-0").filter({ hasText: "Open Table" }).first();
  await openModal.waitFor({ timeout: 10_000 });
  await openModal.getByPlaceholder("Enter customer name").fill(customerName);
  await openModal.getByPlaceholder("+353851234567").fill(customerPhone);
  await openModal.getByRole("button", { name: "Open Table And Start Order" }).click();

  await page.waitForURL("**/menu", { timeout: 20_000 });
  return true;
};

const run = async () => {
  const runId = nowTag();
  await fs.mkdir(SCREENSHOT_DIR, { recursive: true });

  console.log("[playwright-e2e] runId:", runId);
  console.log("[playwright-e2e] frontend:", FRONTEND_URL);
  console.log("[playwright-e2e] backend:", BACKEND_URL);

  await waitForHttpReady(`${BACKEND_URL}/`);
  await waitForHttpReady(`${FRONTEND_URL}/`);

  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
  });
  await context.addInitScript(() => {
    localStorage.setItem("i18nextLng", "en");
  });
  const page = await context.newPage();

  const customerName = `PW_E2E_${Date.now()}`;
  const customerPhone = `9${Math.floor(100000000 + Math.random() * 899999999)}`;

  const summary = {
    runId,
    customerName,
    customerPhone,
    screenshots: [],
    partnerPullCount: 0,
    matchedOrderCount: 0,
  };

  try {
    console.log("[playwright-e2e] step=login");
    await page.goto(`${FRONTEND_URL}/auth`, { waitUntil: "domcontentloaded" });
    await page.getByPlaceholder("Enter employee email").fill(ADMIN_EMAIL);
    await page.getByPlaceholder("Enter password").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(`${FRONTEND_URL}/`, { timeout: 20_000 });
    await page.getByText("System Admin").first().waitFor({ timeout: 20_000 });
    summary.screenshots.push(await saveShot(page, `${runId}-01-home-after-login`));

    console.log("[playwright-e2e] step=open-table-and-create-order");
    await page.locator("div.fixed.bottom-0").getByRole("button", { name: /Tables/ }).click();
    await page.waitForURL("**/tables", { timeout: 20_000 });
    await page.getByRole("heading", { name: "Tables" }).waitFor({ timeout: 20_000 });
    summary.screenshots.push(await saveShot(page, `${runId}-02-tables-before-pick`));
    const picked = await openFirstAvailableTable(page, { customerName, customerPhone });
    if (!picked) {
      const createdTable = await ensureAvailableTable(context);
      console.log("[playwright-e2e] no available table, created fallback table:", createdTable?.tableNo);
      await page.goto(`${FRONTEND_URL}/tables`, { waitUntil: "domcontentloaded" });
      await page.getByRole("heading", { name: "Tables" }).waitFor({ timeout: 20_000 });
      summary.screenshots.push(await saveShot(page, `${runId}-03-tables-after-reload`));
      const pickedAfterCreate = await openFirstAvailableTable(page, { customerName, customerPhone });
      assertOk(pickedAfterCreate, "No available table found even after creating fallback table.");
    }
    await page.waitForURL(`${FRONTEND_URL}/menu`, { timeout: 20_000 });
    summary.screenshots.push(await saveShot(page, `${runId}-04-menu`));

    // 使用热门推荐切换至热菜并预选宫保鸡丁（或直接选凉菜夫妻肺片）
    const dishName = "宫保鸡丁";
    await page.getByRole("button", { name: dishName }).first().click();
    await sleep(500);

    const dishHeading = page.getByRole("heading", { name: dishName, exact: true }).first();
    const dishCard = dishHeading.locator("xpath=ancestor::div[contains(@class,'cursor-pointer')]").first();
    await dishCard.waitFor({ timeout: 10_000 });
    // 购物车按钮（首项，count 已由热门推荐设为 1）
    await dishCard.getByRole("button").first().click();

    await page.getByRole("button", { name: "Place Order" }).waitFor({ state: "visible", timeout: 10_000 });
    await page.getByRole("button", { name: "Place Order" }).click();
    await page.getByRole("heading", { name: "Receipt" }).waitFor({ timeout: 20_000 });
    await page.getByText(customerName, { exact: false }).waitFor({ timeout: 10_000 });
    summary.screenshots.push(await saveShot(page, `${runId}-05-order-receipt`));
    await page.getByRole("button", { name: "Close" }).click();

    console.log("[playwright-e2e] step=orders-page-verify");
    await page.locator("div.fixed.bottom-0").getByRole("button", { name: /Orders/ }).click();
    await page.waitForURL(`${FRONTEND_URL}/orders`, { timeout: 20_000 });
    const foundInUi = await page
      .getByText(customerName, { exact: false })
      .first()
      .waitFor({ timeout: 8_000 })
      .then(() => true)
      .catch(() => false);
    if (!foundInUi) {
      const orderResponse = await context.request.get(`${FRONTEND_URL}/api/order`);
      assertOk(orderResponse.ok(), `Order query failed: HTTP ${orderResponse.status()}`);
      const orderPayload = await orderResponse.json();
      const orderRows = Array.isArray(orderPayload?.data) ? orderPayload.data : [];
      const matched = orderRows.filter(
        (order) => `${order?.customerDetails?.name || ""}` === customerName
      );
      assertOk(matched.length >= 1, `Newly created order not found for ${customerName}`);
    }
    summary.screenshots.push(await saveShot(page, `${runId}-06-orders`));

    console.log("[playwright-e2e] step=dashboard-kitchen-payments-slo");
    await page.goto(`${FRONTEND_URL}/dashboard/kitchen/tickets`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Tickets" }).waitFor({ timeout: 20_000 });
    const setRushBtn = page.locator("button", { hasText: "Set Rush" }).first();
    const hasTicket = await setRushBtn.waitFor({ timeout: 15_000 }).then(() => true).catch(() => false);
    if (hasTicket) {
      await setRushBtn.click();
    }
    summary.screenshots.push(await saveShot(page, `${runId}-07-kitchen`));

    await page.goto(`${FRONTEND_URL}/dashboard/payments`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Payment Summary" }).waitFor({ timeout: 20_000 });
    summary.screenshots.push(await saveShot(page, `${runId}-08-payments-board`));

    await page.goto(`${FRONTEND_URL}/dashboard/slo`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Ops SLO Snapshot" }).waitFor({ timeout: 20_000 });
    summary.screenshots.push(await saveShot(page, `${runId}-09-slo-board`));

    console.log("[playwright-e2e] step=partner-pull");
    const partnerResponse = await context.request.get(`${BACKEND_URL}/api/partner/orders?limit=200&offset=0`, {
      headers: {
        "x-api-key": PARTNER_API_KEY,
      },
    });
    assertOk(partnerResponse.ok(), `Partner pull failed: HTTP ${partnerResponse.status()}`);
    const partnerPayload = await partnerResponse.json();
    assertOk(partnerPayload?.success === true, "Partner payload success=false");
    assertOk(Array.isArray(partnerPayload?.data), "Partner payload data is not an array");

    summary.partnerPullCount = partnerPayload.data.length;
    summary.matchedOrderCount = partnerPayload.data.filter(
      (order) => `${order?.customerDetails?.name || ""}` === customerName
    ).length;
    assertOk(summary.matchedOrderCount >= 1, `Partner pull did not include order for ${customerName}`);

    console.log("[playwright-e2e] SUCCESS");
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await browser.close();
  }
};

run().catch((error) => {
  console.error("[playwright-e2e] FAILED:", error.message);
  process.exitCode = 1;
});
