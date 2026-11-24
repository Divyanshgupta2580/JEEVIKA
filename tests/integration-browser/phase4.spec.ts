import { expect, type Page, test } from "@playwright/test";

async function session(page: Page, user: string, orgId = "demo") {
  const response = await page.request.post("/api/v1/auth/login", {
    data: { orgId, email: `${user}@demo.test`, password: "Dhaaga-demo-2026!" },
  });
  expect(response.ok()).toBeTruthy();
  const credentials = await response.json();
  await page.addInitScript((value) => {
    localStorage.setItem("cf_auth_session", JSON.stringify(value));
  }, credentials);
  return credentials.token as string;
}

test("super admin can open a Prune child route and run its firewall check", async ({
  page,
}) => {
  await session(page, "admin");
  await page.goto("/erp.html#/app/prune/waf");
  await expect(
    page.getByRole("heading", { name: "Active firewall rules" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Run built-in firewall check" })
    .click();
  await expect(
    page.getByText("Firewall blocked the built-in test."),
  ).toBeVisible();
  await expect(page.getByText("Simulation", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Redaction", exact: true }).click();
  await page.getByLabel("Original text").fill("Sample Person");
  await page.getByLabel("Exact identifiers").fill("Sample Person");
  await page.getByRole("button", { name: "Preview redaction" }).click();
  await expect(page.getByLabel("Sanitized preview")).toHaveValue("[NAME]");
});

test("hospital admin sees read-only monitoring and cannot open redaction", async ({
  page,
}) => {
  await session(page, "admin", "other-org");
  await page.goto("/erp.html#/app/swarm");
  await expect(
    page.getByRole("heading", { name: "Agent activity", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Live agent status unavailable", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Run mesh simulation" }),
  ).toHaveCount(0);
  await page.goto("/erp.html#/app/prune/cache");
  await expect(
    page.getByRole("heading", { name: "Edge cache is empty" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Clear edge cache" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Redaction", exact: true }),
  ).toHaveCount(0);
  await page.goto("/erp.html#/app/prune/redaction");
  await expect(page).toHaveURL(/#\/app\/command$/);
});

test("doctor opens and saves the existing encounter case sheet on a narrow viewport", async ({
  page,
}) => {
  const token = await session(page, "doctor");
  const headers = {
    Authorization: `Bearer ${token}`,
    "Idempotency-Key": crypto.randomUUID(),
  };
  const response = await page.request.post("/api/v1/encounters", {
    headers,
    data: {
      patient: {
        name: "Browser AYUSH patient",
        birthDate: "1974-03-15",
        gender: "female",
        language: "hi-IN",
      },
      chiefComplaint: "Synthetic presentation for browser testing.",
      answers: {
        chestPain: "no",
        breathless: "no",
        fainting: "no",
        fever: "yes",
      },
      careConsent: true,
      synthetic: true,
    },
  });
  expect(response.status()).toBe(201);
  const encounter = await response.json();
  expect(
    (
      await page.request.post(`/api/v1/encounters/${encounter.id}/review`, {
        headers,
        data: { note: "Reviewed test encounter." },
      })
    ).ok(),
  ).toBeTruthy();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/erp.html#/app/ayush");
  await page.getByRole("button", { name: "Browser AYUSH patient" }).click();
  await page
    .getByLabel("Prakriti · Constitution")
    .fill("Clinician observation");
  await page.getByLabel("Vata score").fill("30");
  await page.getByRole("button", { name: "Save case sheet" }).click();
  await expect(
    page.getByText("Case sheet saved to the encounter."),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.reload();
  await page.getByRole("button", { name: "Browser AYUSH patient" }).click();
  await expect(page.getByLabel("Prakriti · Constitution")).toHaveValue(
    "Clinician observation",
  );
  await page.goto("/erp.html#/app/swarm");
  await expect(page).toHaveURL(/#\/app\/doctor$/);
});
