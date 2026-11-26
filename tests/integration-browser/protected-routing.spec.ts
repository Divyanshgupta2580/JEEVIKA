import { expect, type Page, test } from "@playwright/test";
import { demoPassword } from "../../backend/local/seed";
import { loginResponseSchema } from "../../packages/shared/integration";

async function signIn(page: Page, role: string) {
  await expect(page.locator("[data-jvk-splash]")).toHaveCount(0);
  await page.getByLabel("Staff Email", { exact: true }).fill(`${role}@demo.test`);
  await page.getByLabel("Password", { exact: true }).fill(demoPassword);
  await page.getByRole("button", { name: "Sign In with Credentials" }).click();
}

async function staffToken(page: Page) {
  const stored = await page.evaluate(() => localStorage.getItem("cf_auth_session"));
  return loginResponseSchema.parse(JSON.parse(stored ?? "null")).token;
}

test("private deep links require the respective login and preserve authorized destinations", async ({ page }) => {
  await page.goto("/erp.html#/app/doctor/queue");
  await expect(page).toHaveURL(/#\/login$/);
  await expect(page.getByRole("heading", { name: "Patient Intake Queue" })).toHaveCount(0);
  await signIn(page, "doctor");
  await expect(page).toHaveURL(/#\/app\/doctor\/queue$/);
  await expect(page.getByRole("heading", { name: "Patient Intake Queue", exact: true })).toBeVisible();

  await page.goto("/erp.html#/app/pos?view=doctor-consultation");
  await expect(page).toHaveURL(/#\/app\/doctor$/);
  await expect(page.getByRole("heading", { name: "Pharmacy POS" })).toHaveCount(0);
  await page.goto("/erp.html#/app/doctor?view=doctor-alerts");
  await expect(page).toHaveURL(/#\/app\/alerts$/);

  await page.goto("/erp.html#/app/home/check-in");
  await expect(page).toHaveURL(/#\/home\/sign-in$/);
  await expect(page.getByRole("heading", { name: "Daily Check-In" })).toHaveCount(0);
  await page.goto("/erp.html#/kiosk");
  await expect(page.getByRole("heading", { name: "Choose a language" })).toBeVisible();
});

test("staff API revocation removes the mounted workspace and its stored session", async ({ page }) => {
  await page.goto("/erp.html#/app/doctor/queue");
  await signIn(page, "doctor");
  await expect(page.getByRole("heading", { name: "Patient Intake Queue", exact: true })).toBeVisible();
  const response = await page.request.post("/api/v1/auth/logout", {
    headers: { Authorization: `Bearer ${await staffToken(page)}` },
  });
  expect(response.status()).toBe(200);
  await page.getByRole("button", { name: "Refresh queue" }).click();
  await expect(page).toHaveURL(/#\/login$/);
  await expect(page.getByRole("heading", { name: "Patient Intake Queue", exact: true })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("cf_auth_session"))).toBeNull();
});

test("a staff workspace closes when the verified login reaches its expiry", async ({ page }) => {
  await page.clock.install();
  await page.goto("/erp.html#/app/doctor/queue");
  await signIn(page, "doctor");
  await expect(page.getByRole("heading", { name: "Patient Intake Queue", exact: true })).toBeVisible();
  const elapsed = await page.evaluate(() => {
    const stored = JSON.parse(localStorage.getItem("cf_auth_session") ?? "{}");
    return Date.parse(stored.expiresAt) - Date.now() + 1000;
  });
  expect(elapsed).toBeGreaterThan(0);
  await page.clock.fastForward(elapsed);
  await expect(page).toHaveURL(/#\/login$/);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("cf_auth_session"))).toBeNull();
});

test("admin routing uses the verified clinic role when the cached profile is stale", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("cf_d1_store_profiles", JSON.stringify([{
      id: "clinic-admin", role: "HOSPITAL_ADMIN", clinic_id: "east", hospital_id: "demo",
    }]));
  });
  await page.goto("/erp.html#/app/command");
  await signIn(page, "clinic-admin");
  await expect(page.getByText("Clinic Operations Hub", { exact: true })).toBeVisible();
  await page.goto("/erp.html#/app/command/expenses");
  await expect(page).toHaveURL(/#\/app\/command$/);
  await expect(page.getByRole("heading", { name: "Other Expenses" })).toHaveCount(0);
});

test("a staff sign-out closes protected pages in other tabs and clears the CBC login", async ({ context, page }) => {
  await page.goto("/erp.html#/app/doctor/queue");
  await signIn(page, "doctor");
  await expect(page).toHaveURL(/#\/app\/doctor\/queue$/);

  const second = await context.newPage();
  await second.goto("/erp.html#/app/doctor/consultation");
  await expect(second.getByRole("heading", { name: "Clinical Consultation", exact: true })).toBeVisible();
  const cbcKey = "jeevika.cbc.doctor-session.v1";
  await second.evaluate((key) => sessionStorage.setItem(key, "test cache"), cbcKey);

  await page.getByRole("button", { name: "Sign Out", exact: true }).click();
  await expect(page).toHaveURL(/#\/login$/);
  await expect(second).toHaveURL(/#\/login$/);
  await expect.poll(() => second.evaluate((key) => sessionStorage.getItem(key), cbcKey)).toBeNull();
});

test("a patient lands on the requested page and leaves it when an authenticated write returns 401", async ({ page }) => {
  await page.goto("/erp.html#/app/home/check-in");
  await expect(page).toHaveURL(/#\/home\/sign-in$/);
  await page.getByRole("radio", { name: "Mobile number" }).check();
  await page.getByRole("button", { name: "Use synthetic identifier" }).click();
  await page.getByRole("button", { name: "Request demo code" }).click();
  const code = await page.getByText(/Demo verification code/).locator("strong").textContent();
  await page.getByLabel("Verification code", { exact: true }).fill(code ?? "");
  await page.getByRole("button", { name: "Verify code" }).click();
  await expect(page).toHaveURL(/#\/app\/home\/check-in$/);
  await expect(page.getByRole("heading", { name: "Daily Check-In" })).toBeVisible();

  const token = await page.evaluate(() => sessionStorage.getItem("jeevika_patient_session_v1"));
  expect(token).toBeTruthy();
  const revoked = await page.request.post("/api/v1/auth/patient/logout", {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(revoked.status()).toBe(200);
  await page.getByLabel("How are you feeling today?").selectOption("same");
  await page.getByLabel("Did you take your scheduled medicines?").selectOption("not-applicable");
  await page.getByLabel("Do you need urgent help right now?").selectOption("no");
  await page.getByRole("button", { name: "Save check-in", exact: true }).click();
  await expect(page).toHaveURL(/#\/home\/sign-in$/);
  await expect(page.getByRole("heading", { name: "Daily Check-In" })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem("jeevika_patient_session_v1"))).toBeNull();
});
