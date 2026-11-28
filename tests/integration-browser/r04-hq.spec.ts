import { expect, type Page, test } from "@playwright/test";
import { demoPassword } from "../../backend/local/seed";

async function signedIn(page: Page, user: string, orgId = "demo") {
  const response = await page.request.post("/api/v1/auth/login", {
    data: { orgId, email: `${user}@demo.test`, password: demoPassword },
  });
  expect(response.status()).toBe(200);
  const session = (await response.json()) as { token: string };
  await page.addInitScript(
    (value) => localStorage.setItem("cf_auth_session", JSON.stringify(value)),
    session,
  );
  return { Authorization: `Bearer ${session.token}` };
}

test("HQ persists organization, branch, lot transfer, scoped views and exact copied finance", async ({
  browser,
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  const admin = await signedIn(page, "admin");
  const cashierPage = await browser.newPage();
  const cashier = await signedIn(cashierPage, "cashier");
  const doctorPage = await browser.newPage();
  const doctor = await signedIn(doctorPage, "doctor");
  const post = (path: string, auth: Record<string, string>, data?: object) =>
    page.request.post(`/api/v1${path}`, {
      data,
      headers: { ...auth, "Idempotency-Key": crypto.randomUUID() },
    });

  await page.goto("/erp.html#/app/command/setup");
  const orgName = page.getByLabel("Hospital Entity Name");
  await expect
    .poll(() =>
      orgName.evaluate((element) => element.closest("[inert]") === null),
    )
    .toBe(true);
  await orgName.fill("Synthetic HQ Network");
  await page
    .getByLabel("Administrative Email")
    .fill("synthetic-hq@example.test");
  await page.getByRole("button", { name: "Create Organization" }).click();
  await expect(
    page.getByText("Synthetic HQ Network", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Clinic / Branch Name").fill("Synthetic Main Branch");
  await page.getByLabel("Address / Location").fill("Synthetic Main Address");
  await page.getByRole("button", { name: "Launch Dashboard" }).click();
  await expect(
    page.getByRole("heading", { name: "Synthetic HQ Network" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Synthetic Main Branch" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Onboard Clinic HUB" }).click();
  const onboarding = page.getByRole("dialog", {
    name: "Onboard New Clinic Hub",
  });
  await onboarding.getByLabel("Clinic Branch Name").fill("Synthetic Satellite");
  await onboarding
    .getByLabel("Physical Location Address")
    .fill("Synthetic satellite address");
  await onboarding
    .getByLabel("Medical Director / Staff Name")
    .fill("Synthetic Branch Manager");
  await onboarding
    .getByLabel("Official Staff Email")
    .fill("synthetic-branch@example.test");
  await onboarding.getByLabel("Initial Secure Password").fill(demoPassword);
  await onboarding
    .getByRole("button", { name: "Provision Clinic Node" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Synthetic Satellite" }),
  ).toBeVisible();
  await page.getByLabel("Search clinic fleet").fill("Synthetic Satellite");
  await expect(
    page.getByRole("group", { name: "North Clinic", exact: true }),
  ).toHaveCount(0);
  const satellite = page.getByRole("group", {
    name: "Synthetic Satellite",
    exact: true,
  });
  await satellite.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: "Paused (1)", exact: true }).click();
  await satellite.getByRole("button", { name: "Unpause", exact: true }).click();
  await page.getByRole("button", { name: "All (4)", exact: true }).click();
  await page.getByLabel("Search clinic fleet").clear();
  await expect(
    page.getByRole("group", { name: "North Clinic", exact: true }),
  ).toBeVisible();

  const item = {
    id: "synthetic-r04-browser",
    brand: "Synthetic HQ Tablet",
    salt: "Synthetic HQ salt",
    strengthMg: 20,
    form: "tablet",
    nti: false,
    scheduleH: false,
    gstBps: 500,
  };
  expect((await post("/clinical/pharmacy/catalog", admin, item)).status()).toBe(
    201,
  );
  const order = await post("/clinical/procurement/orders", admin, {
    supplierReference: "Synthetic supplier",
    lines: [{ skuId: item.id, units: 18, costPaise: 101, pricePaise: 245 }],
  });
  expect(order.status()).toBe(201);
  const { id: orderId } = await order.json();
  expect(
    (
      await post(`/clinical/procurement/orders/${orderId}/issue`, admin)
    ).status(),
  ).toBe(200);
  const receipts = await page.request.get("/api/v1/clinical/procurement/grn", {
    headers: cashier,
  });
  const { lines } = await receipts.json();
  expect(
    (
      await post("/clinical/procurement/grn", cashier, {
        orderId,
        lineId: lines.find(
          (line: { orderId: string }) => line.orderId === orderId,
        ).lineId,
        batchNo: "SYN-BROWSER-HQ",
        expiry: "2099-12-31",
        received: 18,
        damaged: 0,
        invoice: "SYN-HQ",
      })
    ).status(),
  ).toBe(201);
  const intake = await post("/encounters", doctor, {
    patient: {
      name: "Synthetic HQ Patient",
      birthDate: "1990-01-01",
      gender: "female",
      language: "en-IN",
    },
    chiefComplaint: "Synthetic consultation",
    answers: { chestPain: "no", breathless: "no", fainting: "no" },
    careConsent: true,
    synthetic: true,
  });
  expect(intake.status()).toBe(201);
  const { id: encounterId } = await intake.json();
  expect(
    (
      await post(`/encounters/${encounterId}/review`, doctor, {
        note: "Synthetic reviewed note",
      })
    ).status(),
  ).toBe(200);
  const rx = {
    encounterId,
    note: "Synthetic order",
    allergiesReviewed: true,
    pharmacyConsentConfirmed: true,
    allergies: [],
    lines: [
      {
        skuId: item.id,
        units: 7,
        courseEnd: "2099-11-30",
        directions: "Synthetic directions",
        allowEquivalent: false,
      },
    ],
  };
  const quote = await post(
    "/clinical/pharmacy/prescriptions/quote",
    doctor,
    rx,
  );
  expect(quote.status()).toBe(200);
  const { checkedAt, approval } = await quote.json();
  const prescription = await post("/clinical/pharmacy/prescriptions", doctor, {
    draft: rx,
    checkedAt,
    approval,
  });
  expect(prescription.status()).toBe(201);
  const { id: prescriptionId } = await prescription.json();
  expect(
    (
      await post("/clinical/pharmacy/checkout", cashier, {
        prescriptionId,
        expectedTotalPaise: 1715,
        cashReceived: true,
        taxMode: "intra",
      })
    ).status(),
  ).toBe(201);

  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Synthetic Satellite" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: /Group SKU Matrix/ })
      .getByText("North Clinic: 11 units"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Central Stock Transfer" }).click();
  const transfer = page.getByRole("dialog", {
    name: "Inter-Clinic Stock Rebalancer",
  });
  const choose = async (field: string, option: RegExp) => {
    await transfer.getByRole("combobox", { name: field, exact: true }).click();
    await page.getByRole("option", { name: option }).click();
  };
  await choose("Medicine", /Synthetic HQ Tablet/);
  await choose("Source clinic", /North Clinic/);
  await choose("Destination clinic", /Synthetic Satellite/);
  await choose("Source batch", /SYN-BROWSER-HQ/);
  await transfer.getByLabel("Transfer quantity").fill("4");
  await transfer
    .getByLabel("Transfer reason")
    .fill("Synthetic browser transfer");
  await transfer
    .getByRole("button", { name: "Confirm & Execute Rebalance" })
    .click();
  const matrix = page.getByRole("region", { name: /Group SKU Matrix/ });
  await expect(matrix.getByText("North Clinic: 7 units")).toBeVisible();
  await expect(matrix.getByText("Synthetic Satellite: 4 units")).toBeVisible();

  await page.getByRole("tab", { name: "Payment Matrix" }).click();
  await expect(page.getByText("cash", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Copy Report", exact: true }).click();
  const report = await page.evaluate(() => navigator.clipboard.readText());
  expect(report).toContain("Selected gross receipts ₹17.15 (1715 paise)");
  expect(report).toContain("cash · ₹17.15 (1715 paise)");

  await satellite.getByRole("button", { name: "Drill-down to Clinic" }).click();
  await expect(
    page.getByRole("heading", { name: "Synthetic Satellite", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Synthetic satellite address", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back to HQ Network" }).click();
  await page.getByRole("link", { name: "View audit status" }).click();
  await expect(page.getByText(/Synthetic browser transfer/)).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  expect(
    (
      await cashierPage.request.get("/api/v1/clinical/command/hq/fleet", {
        headers: cashier,
      })
    ).status(),
  ).toBe(403);
  await page.goto("/erp.html#/app/command/earnings");
  await expect(
    page.getByRole("heading", { name: "Earnings Dashboard" }),
  ).toBeVisible();
  await expect(page.getByText("₹17.15", { exact: true }).first()).toBeVisible();
  await doctorPage.close();
  await cashierPage.close();
});
