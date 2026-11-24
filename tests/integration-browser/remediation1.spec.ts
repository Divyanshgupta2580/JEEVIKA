import { expect, type Page, test } from "@playwright/test";
import { demoPassword } from "../../backend/local/seed";
import { loginResponseSchema } from "../../packages/shared/integration";
import { demoPatientIdentity } from "../../packages/shared/patient-experience";

const endpoints = [
  { path: "/app/command/expenses", view: "expenses", label: "Other Expenses" },
  {
    path: "/app/command/equipment",
    view: "equipments",
    label: "Equipments & Assets",
  },
  {
    path: "/app/command/roster",
    view: "shift-management",
    label: /Hospital Shift Management|Shift Operations/,
  },
  {
    path: "/app/ca/audit",
    view: "audit_logs",
    label: /^(Audit status|Security Audit Logs)$/,
  },
] as const;
const personas = [
  {
    role: "SUPER_ADMIN",
    email: "admin",
    org: "demo",
    landing: "/app/command",
    granted: [3],
  },
  {
    role: "HOSPITAL_ADMIN",
    email: "admin",
    org: "other-org",
    landing: "/app/command",
    granted: [0, 1, 2, 3],
  },
  {
    role: "CLINIC_ADMIN",
    email: "clinic-admin",
    org: "demo",
    landing: "/app/command",
    granted: [2],
  },
  {
    role: "DOCTOR",
    email: "doctor",
    org: "demo",
    landing: "/app/doctor",
    granted: [],
  },
  {
    role: "NURSE",
    email: "nurse",
    org: "demo",
    landing: "/app/ipd",
    granted: [],
  },
  {
    role: "STAT_NURSE",
    email: "stat-nurse",
    org: "demo",
    landing: "/app/casualty/triage",
    granted: [],
  },
  {
    role: "CASHIER",
    email: "cashier",
    org: "demo",
    landing: "/app/pos",
    granted: [],
  },
] as const;

for (const { role, email, org, landing, granted } of personas) {
  test(`${role} matches direct staff and view-selector authorization`, async ({
    page,
  }) => {
    const login = await page.request.post("/api/v1/auth/login", {
      data: { orgId: org, email: `${email}@demo.test`, password: demoPassword },
    });
    expect(login.status()).toBe(200);
    const credentials = loginResponseSchema.parse(await login.json());
    expect(credentials.principal.role).toBe(role);
    await page.addInitScript(
      (session) =>
        localStorage.setItem("cf_auth_session", JSON.stringify(session)),
      credentials,
    );
    await checkPaths(page, landing, granted);
    if (role === "CLINIC_ADMIN") {
      await page.goto("/app/command/roster");
      await expect(
        page.getByRole("heading", { name: "Shift Operations" }),
      ).toBeVisible();
      await expect(page.getByText("east-doctor", { exact: true })).toHaveCount(
        0,
      );
      await page.getByRole("button", { name: "New Shift" }).click();
      await expect(
        page.getByRole("dialog", { name: "Create Shift Template" }),
      ).toBeVisible();
    }
  });
}

test("patient sessions cannot access direct or view-selector staff panels", async ({
  page,
}) => {
  const start = await page.request.post("/api/v1/auth/patient/otp/start", {
    data: {
      method: "mobile",
      identifier: demoPatientIdentity.mobile,
      purpose: "home",
    },
  });
  expect(start.status()).toBe(201);
  const challenge = (await start.json()) as { id: string; demoCode: string };
  const verified = await page.request.post("/api/v1/auth/patient/otp/verify", {
    data: { id: challenge.id, code: challenge.demoCode, purpose: "home" },
  });
  expect(verified.status()).toBe(200);
  const { token } = (await verified.json()) as { token: string };
  await page.addInitScript(
    (patientToken) =>
      sessionStorage.setItem("jeevika_patient_session_v1", patientToken),
    token,
  );
  await page.goto("/app/home");
  await expect(
    page.getByRole("heading", { name: "Health Thread" }),
  ).toBeVisible();
  await checkPaths(page, "/login", [], "/app/command");
});

async function checkPaths(
  page: Page,
  landing: string,
  granted: readonly number[],
  holder = landing,
) {
  for (const [index, target] of endpoints.entries()) {
    const permitted = granted.includes(index);
    for (const url of [
      target.path,
      `${holder}?view=${target.view}`,
      `/erp.html#${target.path}`,
      `/erp.html#${holder}?view=${target.view}`,
    ]) {
      await page.goto(url);
      const panel = page.getByRole("heading", { name: target.label });
      if (permitted) await expect(panel).toBeVisible();
      else {
        await expect(page).toHaveURL((actual) => actual.hash === `#${landing}`);
        await expect(panel).toHaveCount(0);
      }
    }
  }
}

test("a STAT nurse can refer an emergency case and the doctor sees only that referral", async ({
  browser,
  page,
}) => {
  const nurseLogin = await page.request.post("/api/v1/auth/login", {
    data: {
      orgId: "demo",
      email: "stat-nurse@demo.test",
      password: demoPassword,
    },
  });
  expect(nurseLogin.status()).toBe(200);
  const nurse = loginResponseSchema.parse(await nurseLogin.json());
  const doctorLogin = await page.request.post("/api/v1/auth/login", {
    data: { orgId: "demo", email: "doctor@demo.test", password: demoPassword },
  });
  expect(doctorLogin.status()).toBe(200);
  const doctor = loginResponseSchema.parse(await doctorLogin.json());
  for (const name of [
    "Synthetic Referred Encounter",
    "Synthetic Unreferred Encounter",
  ]) {
    const intake = await page.request.post("/api/v1/encounters", {
      headers: {
        Authorization: `Bearer ${nurse.token}`,
        "Idempotency-Key": crypto.randomUUID(),
      },
      data: {
        patient: {
          name,
          birthDate: "1990-01-01",
          gender: "other",
          language: "en-IN",
        },
        chiefComplaint: "Synthetic triage fixture",
        answers: { chestPain: "yes", breathless: "no", fainting: "no" },
        careConsent: true,
        synthetic: true,
      },
    });
    expect(intake.status()).toBe(201);
  }
  await page.addInitScript(
    (session) =>
      localStorage.setItem("cf_auth_session", JSON.stringify(session)),
    nurse,
  );
  await page.goto("/app/casualty/triage");
  const encounter = page.getByRole("combobox", {
    name: "Encounter",
    exact: true,
  });
  const option = encounter.locator("option", {
    hasText: "Synthetic Referred Encounter",
  });
  await encounter.selectOption({
    value: (await option.getAttribute("value")) ?? "",
  });
  await page
    .getByRole("combobox", { name: "Attending doctor", exact: true })
    .selectOption("doctor");
  await page
    .getByRole("button", { name: "Refer to doctor", exact: true })
    .click();
  await expect(
    page.getByText("Emergency encounter referred.", { exact: true }),
  ).toBeVisible();

  const physician = await browser.newPage({
    baseURL: new URL(page.url()).origin,
  });
  try {
    await physician.addInitScript(
      (session) =>
        localStorage.setItem("cf_auth_session", JSON.stringify(session)),
      doctor,
    );
    await physician.goto("/app/casualty/bays");
    await expect(
      physician.getByRole("heading", { name: "Referred emergency encounters" }),
    ).toBeVisible();
    await expect(
      physician.getByText("Synthetic Referred Encounter"),
    ).toBeVisible();
    await expect(
      physician.getByText("Synthetic Unreferred Encounter"),
    ).toHaveCount(0);
    await expect(
      physician.getByRole("button", { name: "Refer to doctor" }),
    ).toHaveCount(0);
  } finally {
    await physician.close();
  }
});
