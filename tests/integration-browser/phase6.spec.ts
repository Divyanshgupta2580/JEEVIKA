import { expect, type Page, test } from "@playwright/test";
import { demoPassword } from "../../backend/local/seed";
import { loginResponseSchema } from "../../packages/shared/integration";

async function session(page: Page, user: string) {
  const result = await page.request.post("/api/v1/auth/login", {
    data: { orgId: "demo", email: `${user}@demo.test`, password: demoPassword },
  });
  expect(result.status()).toBe(200);
  const credentials = loginResponseSchema.parse(await result.json());
  await page.addInitScript((value) => {
    localStorage.setItem("cf_auth_session", JSON.stringify(value));
  }, credentials);
  return { Authorization: `Bearer ${credentials.token}` };
}

test("keeps one Code Blue and one attending modal across staff routes", async ({
  browser,
  page,
}) => {
  const doctor = await session(page, "doctor");
  const nursePage = await browser.newPage();
  const nurse = await session(nursePage, "nurse");
  const adminPage = await browser.newPage();
  await session(adminPage, "admin");
  const cashierPage = await browser.newPage();
  await session(cashierPage, "cashier");
  const encounter = await page.request.post("/api/v1/encounters", {
    headers: { ...doctor, "Idempotency-Key": crypto.randomUUID() },
    data: {
      patient: {
        name: "Synthetic Alert Patient",
        birthDate: "1990-01-01",
        gender: "female",
        language: "hi-IN",
      },
      chiefComplaint: "Synthetic ward case",
      answers: { chestPain: "no", breathless: "no", fainting: "no" },
      careConsent: true,
      synthetic: true,
    },
  });
  expect(encounter.status()).toBe(201);
  const { id: encounterId } = await encounter.json();
  const location = await page.request.post("/api/v1/clinical/ipd/locations", {
    headers: nurse,
    data: { room: "Synthetic room", label: "Alert bed" },
  });
  expect(location.status()).toBe(201);
  const { id: locationId } = await location.json();
  const admission = await page.request.post("/api/v1/clinical/ipd/admissions", {
    headers: nurse,
    data: {
      encounterId,
      locationId,
      doctorId: "doctor",
      reason: "Synthetic observation",
    },
  });
  expect(admission.status()).toBe(201);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/erp.html#/app/ayush");
  await nursePage.goto("/erp.html#/app/ipd");
  await nursePage.getByRole("button", { name: "Report Code Blue" }).click();
  await nursePage
    .getByLabel("Reason for Code Blue")
    .fill("Synthetic test alarm");
  await nursePage.getByRole("button", { name: "Record Code Blue" }).click();
  const banner = (target: Page) =>
    target.getByRole("alert", { name: "Code Blue banner" });
  await expect(banner(nursePage)).toHaveCount(1);
  const modal = page.getByRole("dialog", {
    name: "Attending doctor · En Route",
  });
  await expect(modal).toBeVisible({ timeout: 10000 });
  await expect(modal).toHaveCount(1);
  await expect(banner(page)).toHaveCount(0);
  await expect(
    page.getByText("Code Blue · Synthetic room · Alert bed", { exact: true }),
  ).toHaveCount(1);
  await page.evaluate(() => {
    window.location.hash = "#/app/ipd";
  });
  await expect(modal).toBeVisible();
  await expect(banner(page)).toHaveCount(0);
  const acknowledge = modal.getByRole("button", {
    name: "Acknowledge & En Route",
  });
  await acknowledge.focus();
  await page.keyboard.press("Enter");
  await expect(
    modal.getByText("En Route recorded", { exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(modal).toHaveCount(0);
  await expect(banner(page)).toHaveCount(1);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await adminPage.goto("/erp.html#/app/ipd");
  await expect(
    adminPage.getByText("Code Blue · Synthetic room · Alert bed", {
      exact: true,
    }),
  ).toHaveCount(1);
  await expect(banner(adminPage)).toHaveCount(0);
  await expect(adminPage.getByText("Synthetic Alert Patient")).toHaveCount(0);
  await cashierPage.goto("/erp.html#/app/procurement/grn");
  await expect(
    cashierPage.getByRole("heading", { name: "Goods receipt", exact: true }),
  ).toBeVisible();
  await expect(
    cashierPage.getByRole("button", { name: "Create draft" }),
  ).toHaveCount(0);
  await expect(cashierPage.getByText(/Code Blue/)).toHaveCount(0);
  await cashierPage.goto("/erp.html#/kiosk");
  await expect(cashierPage.getByText(/Code Blue/)).toHaveCount(0);
  await nursePage.getByRole("button", { name: "Resolve Code Blue" }).click();
  await expect(banner(nursePage)).toHaveCount(0);
  await adminPage.close();
  await cashierPage.close();
  await nursePage.close();
});

test("signs an OPD note and prescription, then completes the authorized POS handoff", async ({
  browser,
  page,
}) => {
  const doctor = await session(page, "doctor");
  const adminPage = await browser.newPage();
  const admin = await session(adminPage, "admin");
  const cashierPage = await browser.newPage();
  const cashier = await session(cashierPage, "cashier");
  const api = (path: string, headers: Record<string, string>, data?: unknown) =>
    page.request.post(`/api/v1${path}`, {
      headers: { ...headers, "Idempotency-Key": crypto.randomUUID() },
      data,
    });
  const item = {
    id: "browser-synthetic-tablet",
    brand: "Synthetic Browser Tablet",
    salt: "Synthetic salt",
    strengthMg: 10,
    form: "tablet",
    nti: false,
    scheduleH: false,
    gstBps: 500,
  };
  expect(
    (await api("/clinical/pharmacy/catalog", cashier, item)).status(),
  ).toBe(403);
  expect((await api("/clinical/pharmacy/catalog", admin, item)).status()).toBe(
    201,
  );
  const draft = await api("/clinical/procurement/orders", admin, {
    supplierReference: "Synthetic Browser Supplier",
    lines: [{ skuId: item.id, units: 5, costPaise: 120, pricePaise: 250 }],
  });
  expect(draft.status()).toBe(201);
  const { id: orderId } = await draft.json();
  expect(
    (
      await api(`/clinical/procurement/orders/${orderId}/issue`, admin)
    ).status(),
  ).toBe(200);

  await cashierPage.setViewportSize({ width: 390, height: 844 });
  await cashierPage.goto("/erp.html#/app/procurement/grn");
  await cashierPage.getByLabel("Issued order line").selectOption({ index: 1 });
  await cashierPage.getByLabel("Invoice reference").fill("SYN-BROWSER-INVOICE");
  await cashierPage.getByLabel("Batch number").fill("SYN-BROWSER-BATCH");
  await cashierPage.getByLabel("Expiry").fill("2099-12-31");
  await cashierPage.getByLabel("Received units").fill("5");
  await cashierPage.getByRole("button", { name: "Post goods receipt" }).click();
  await expect(
    cashierPage.getByText(
      "Goods receipt recorded and accepted units posted to inventory.",
    ),
  ).toBeVisible();

  const intake = await api("/encounters", doctor, {
    patient: {
      name: "Synthetic OPD Handoff",
      birthDate: "1990-01-01",
      gender: "female",
      language: "hi-IN",
    },
    chiefComplaint: "Synthetic routine visit",
    answers: { chestPain: "no", breathless: "no", fainting: "no" },
    careConsent: true,
    synthetic: true,
  });
  expect(intake.status()).toBe(201);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/erp.html#/app/doctor");
  await page
    .getByText("Synthetic OPD Handoff", { exact: true })
    .first()
    .click();
  await page
    .getByLabel("SOAP note", { exact: true })
    .fill("Synthetic signed clinical note.");
  await page.getByLabel("Clinician sign-off for SOAP note").check();
  await page.getByRole("button", { name: "Sign and save SOAP" }).click();
  await expect(
    page.getByText("Synthetic signed clinical note.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Sign prescription for pharmacy" })
    .click();
  const drawer = page.getByRole("dialog", {
    name: "Sign prescription for pharmacy",
  });
  await drawer
    .getByLabel("Prescription note")
    .fill("Synthetic pharmacy handoff.");
  await drawer.getByLabel("Catalog item").selectOption(item.id);
  await drawer.getByLabel("Units", { exact: true }).fill("2");
  await drawer.getByLabel("Course end").fill("2099-11-30");
  await drawer.getByLabel("Directions").fill("Synthetic directions.");
  await drawer.getByLabel("I reviewed the patient’s allergies.").check();
  await drawer.getByLabel("The patient authorized pharmacy sharing.").check();
  await drawer
    .getByRole("button", { name: "Sign and send to pharmacy" })
    .click();
  await expect(
    page.getByText(
      "Prescription signed and available in the clinic pharmacy queue.",
    ),
  ).toBeVisible();

  await cashierPage.goto("/erp.html#/app/pos");
  await cashierPage
    .getByRole("button", { name: /Synthetic OPD Handoff/ })
    .click();
  await cashierPage.getByLabel("Tax treatment").selectOption("intra");
  await cashierPage.getByLabel("Cash received and amount confirmed.").check();
  await cashierPage
    .getByRole("button", { name: "Record cash sale and dispense" })
    .click();
  await expect(
    cashierPage.getByRole("heading", { name: "Cash sale recorded" }),
  ).toBeVisible();
  await expect(
    cashierPage.getByText("Total ₹5.00", { exact: true }),
  ).toBeVisible();
  expect(
    await cashierPage.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await adminPage.close();
  await cashierPage.close();
});
