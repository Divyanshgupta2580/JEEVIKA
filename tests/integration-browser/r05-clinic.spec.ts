import { expect, type Page, test } from "@playwright/test";
import { demoPassword } from "../../backend/local/seed";
import { r05Catalog, r05Hq, r05Pharmacy, type R05Post, signR05Prescription } from "../r05-fixture";

const org = "other-org";
async function signIn(page: Page, user: string, orgId = org) {
  const response = await page.request.post("/api/v1/auth/login", {
    data: { orgId, email: `${user}@demo.test`, password: demoPassword },
  });
  expect(response.status()).toBe(200);
  const session = (await response.json()) as { token: string };
  await page.addInitScript(value => localStorage.setItem("cf_auth_session", JSON.stringify(value)), session);
  return session.token;
}

test("Clinic Operations reconciles and reprints a canonical receipt across fresh roles", async ({ page, browser }) => {
  const makePage = () => browser.newPage({ baseURL: test.info().project.use.baseURL });
  const [seedPage, cashierPage, hqPage, eastPage] = await Promise.all([makePage(), makePage(), makePage(), makePage()]);
  try {
    const [admin, doctor, cashier] = await Promise.all(["admin", "doctor", "cashier"].map(user => signIn(seedPage, user)));
    const post: R05Post = async (path, token, data, key = crypto.randomUUID()) => {
      const reply = await seedPage.request.post(`/api/v1${path}`, {
        data, headers: { Authorization: `Bearer ${token}`, "Idempotency-Key": key },
      });
      return { status: reply.status(), json: () => reply.json() };
    };
    expect((await post(`${r05Pharmacy}/catalog`, admin!, r05Catalog)).status).toBe(201);
    const order = await post("/clinical/procurement/orders", admin!, {
      supplierReference: "Synthetic R05 supplier",
      lines: [{ skuId: r05Catalog.id, units: 15, costPaise: 101, pricePaise: 245 }],
    });
    expect(order.status).toBe(201);
    const { id: orderId } = await order.json() as { id: string };
    expect((await post(`/clinical/procurement/orders/${orderId}/issue`, admin!, {})).status).toBe(200);
    const pending = await seedPage.request.get("/api/v1/clinical/procurement/grn", {
      headers: { Authorization: `Bearer ${cashier}` },
    });
    const { lines } = await pending.json() as { lines: { lineId: string; orderId: string }[] };
    const dateInIndia = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" });
    const day = dateInIndia.format(new Date());
    const tomorrow = dateInIndia.format(new Date(Date.now() + 86_400_000));
    for (const [batchNo, received, expiry] of [
      ["SYN-R05-FIRST", 5, "2099-11-01"], ["SYN-R05-SECOND", 8, "2099-12-31"], ["SYN-R05-NEAR", 2, tomorrow],
    ] as const) {
      expect((await post("/clinical/procurement/grn", cashier!, {
        orderId, lineId: lines.find(line => line.orderId === orderId)!.lineId,
        batchNo, received, expiry, damaged: 0, invoice: batchNo,
      })).status).toBe(201);
    }
    const prescriptionId = await signR05Prescription(post, doctor!, r05Catalog.id);
    const pay = { prescriptionId, expectedTotalPaise: 1715, cashReceived: true, taxMode: "intra" };
    const key = crypto.randomUUID();
    const checkout = await post(`${r05Pharmacy}/checkout`, cashier!, pay, key);
    expect(checkout.status).toBe(201);
    const { id } = await checkout.json() as { id: string };
    const replay = await post(`${r05Pharmacy}/checkout`, cashier!, pay, key);
    expect(replay.status).toBe(200);
    expect(await replay.json()).toMatchObject({ id, totalPaise: 1715 });

    const [, freshCashier, , east] = await Promise.all([
      signIn(page, "clinic-admin"), signIn(cashierPage, "cashier"), signIn(hqPage, "admin"), signIn(eastPage, "east-cashier"),
    ]);
    const read = (path: string, token: string) => seedPage.request.get(`/api/v1${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect((await read(`${r05Hq}/finance?clinic=north`, freshCashier)).status()).toBe(403);
    expect((await read(`${r05Pharmacy}/receipts/${id}`, east)).status()).toBe(404);

    await cashierPage.goto("/erp.html#/app/pos");
    await cashierPage.getByRole("button", { name: "Find cash receipt" }).click();
    await cashierPage.getByLabel("Receipt reference").fill(id);
    await cashierPage.getByLabel("Posted date (IST, optional)").fill("2000-01-01");
    await cashierPage.getByRole("button", { name: "Open receipt" }).click();
    await expect(cashierPage.getByText("This record is unavailable.", { exact: true })).toBeVisible();
    await cashierPage.getByLabel("Posted date (IST, optional)").fill(day);
    await cashierPage.getByRole("button", { name: "Open receipt" }).click();
    await expect(cashierPage.getByRole("heading", { name: "Cash receipt" })).toBeVisible();
    await expect(cashierPage.getByText("Total ₹17.15", { exact: true })).toBeVisible();
    await expect(cashierPage.getByText(/SYN-R05-FIRST · Exp/)).toBeVisible();
    await expect(cashierPage.getByText(/SYN-R05-SECOND · Exp/)).toBeVisible();

    await page.bringToFront();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/erp.html#/app/command");
    await expect(page.getByRole("heading", { name: "Clinic Operations Hub", exact: true })).toBeVisible();
    await expect(page.getByText("D1 ledger verified · Stock verified")).toBeVisible();
    await expect(page.getByText("No prior revenue baseline")).toBeVisible();
    await expect(page.getByText("Attendance tracking is not configured.")).toBeVisible();
    await expect(page.getByText("1d left", { exact: true })).toBeVisible();
    const search = page.getByRole("textbox", { name: "Search counter transactions" });
    await search.click();
    await search.pressSequentially("Missing synthetic reference");
    await expect(search).toHaveValue("Missing synthetic reference");
    await expect(page.getByText("No matching transactions")).toBeVisible();
    await search.fill(id.slice(0, 8).toUpperCase());
    const saleRow = page.getByRole("row").filter({ hasText: id });
    await expect(saleRow).toContainText("₹17.15");
    await page.getByRole("button", { name: "UPI", exact: true }).click();
    await expect(page.getByText("No matching transactions")).toBeVisible();
    await page.getByRole("button", { name: "Cash", exact: true }).click();
    await page.getByRole("button", { name: "Pharmacy", exact: true }).click();
    await page.getByRole("button", { name: "Last 30 Days" }).click();
    await expect(saleRow).toContainText(id);
    await saleRow.getByRole("button", { name: "Receipt", exact: true }).click();
    const receiptDialog = page.getByRole("dialog", { name: "Pharmacy tax receipt" });
    await expect(receiptDialog.getByText(`Receipt ${id}`, { exact: true })).toBeVisible();
    await expect(receiptDialog.getByText("₹16.34", { exact: true })).toBeVisible();
    await expect(receiptDialog.getByText("₹0.81", { exact: true })).toBeVisible();
    await expect(receiptDialog.getByText(/SYN-R05-FIRST · Exp/)).toBeVisible();
    await expect(receiptDialog.getByText(/SYN-R05-SECOND · Exp/)).toBeVisible();
    await page.emulateMedia({ media: "print" });
    await page.evaluate(() => {
      window.print = () => {
        const article = document.querySelector('[data-clinical-print-content="active"]');
        const workspace = document.querySelector("main");
        if (article?.textContent?.includes("SYN-R05-SECOND") && workspace && getComputedStyle(workspace).display === "none") {
          document.body.dataset.receiptPrinted = "yes";
        }
      };
    });
    await receiptDialog.getByRole("button", { name: "Print receipt" }).click();
    await expect(page.locator("body")).toHaveAttribute("data-receipt-printed", "yes");
    await page.emulateMedia({ media: "screen" });
    await receiptDialog.getByRole("button", { name: "Close" }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
    await page.getByRole("button", { name: "Sync D1", exact: true }).click();
    await expect(page.getByText("D1 ledger verified · Stock verified")).toBeVisible();
    await page.getByRole("button", { name: "Quick POS Checkout" }).click();
    await expect(page.getByRole("heading", { name: "Pharmacy POS" })).toBeVisible();

    await hqPage.goto("/erp.html#/app/command");
    const north = hqPage.getByRole("group", { name: "North Clinic", exact: true });
    await north.getByRole("button", { name: "Drill-down to Clinic" }).click();
    const hqSale = hqPage.getByRole("row").filter({ hasText: id });
    await expect(hqSale).toContainText("₹17.15");
    await hqSale.getByRole("button", { name: "Receipt", exact: true }).click();
    await expect(hqPage.getByRole("dialog", { name: "Pharmacy tax receipt" }).getByText(`Receipt ${id}`)).toBeVisible();
  } finally {
    await Promise.all([seedPage, cashierPage, hqPage, eastPage].map(item => item.close()));
  }
});
