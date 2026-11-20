import { expect, type Page, test } from "@playwright/test";

async function login(page: Page, user = "doctor") {
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill(`${user}@demo.test`);
  await page.getByLabel("Password", { exact: true }).fill("Dhaaga-demo-2026!");
  await page.getByRole("button", { name: "Sign in to workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "Every handoff, in view." }),
  ).toBeVisible();
}
async function intake(page: Page, name: string, emergency = false) {
  await page.getByRole("link", { name: "Patient intake", exact: true }).click();
  await page.getByLabel("Patient name", { exact: true }).fill(name);
  await page.getByLabel("Confirmed date of birth").fill("1974-03-15");
  await page
    .getByLabel("What brings the patient in today?")
    .fill("Synthetic patient reports fever for two days.");
  await page
    .getByLabel("Chest pain", { exact: true })
    .selectOption(emergency ? "yes" : "no");
  await page
    .getByLabel("Difficulty breathing", { exact: true })
    .selectOption("no");
  await page.getByLabel("Fainting", { exact: true }).selectOption("no");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Send intake to clinician" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
  await page.screenshot({
    path: "/tmp/dhaaga-integration-thread.png",
    fullPage: true,
  });
}
test("intake appears for another clinician session, review persists and consent revokes", async ({
  page,
  browser,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await login(page, "nurse");
  const name = `Synthetic Browser ${Date.now()}`;
  await intake(page, name);
  const thread = page.url();
  await expect(
    page.getByRole("button", { name: "Save clinician review" }),
  ).toHaveCount(0);
  const context = await browser.newContext();
  const doctor = await context.newPage();
  await login(doctor);
  await doctor.goto(thread);
  await expect(doctor.getByRole("heading", { name })).toBeVisible();
  await doctor
    .getByLabel("Clinician review note")
    .fill("Synthetic case reviewed. Follow-up assessment documented.");
  await doctor.getByRole("button", { name: "Save clinician review" }).click();
  await expect(
    doctor.getByText(
      "Synthetic case reviewed. Follow-up assessment documented.",
    ),
  ).toBeVisible();
  await doctor.reload();
  await expect(
    doctor.getByText(
      "Synthetic case reviewed. Follow-up assessment documented.",
    ),
  ).toBeVisible();
  await doctor.getByText("Consent & record access", { exact: true }).click();
  await doctor
    .getByRole("button", { name: "Record withdrawal of care consent" })
    .click();
  await expect(
    doctor.getByRole("heading", { name: "Clinic queue", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Encounter unavailable" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
  await context.close();
});
test("emergency intake cannot enter routine review", async ({ page }) => {
  await login(page);
  await intake(page, `Synthetic Emergency ${Date.now()}`, true);
  await expect(
    page.getByText("Emergency pathway remains active"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save clinician review" }),
  ).toHaveCount(0);
});
test("mobile intake has no horizontal overflow and server errors are visible", async ({
  page,
}) => {
  let failQueue = false;
  await page.routeWebSocket("**/api/v1/socket", (socket) => {
    const server = socket.connectToServer();
    socket.onMessage((frame) => {
      if (failQueue && typeof frame === "string") {
        const request = JSON.parse(frame);
        if (request.method === "GET" && request.path === "/encounters") {
          socket.send(JSON.stringify({
            id: request.id, status: 503, body: { error: { message: "Backend temporarily unavailable" } },
          }));
          return;
        }
      }
      server.send(frame);
    });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.getByRole("link", { name: "Patient intake", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Start with a conversation." }),
  ).toBeVisible();
  await page.screenshot({
    path: "/tmp/dhaaga-integration-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () =>
        Math.max(
          document.documentElement.scrollWidth,
          document.body.scrollWidth,
        ) <= window.innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("link", { name: "Clinician queue", exact: true })
    .click();
  failQueue = true;
  await page.getByRole("button", { name: "Refresh", exact: false }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Backend temporarily unavailable",
  );
});


test("socket opens after login, reconnects after interruption, and closes on logout", async ({ page }) => {
  const connections: import("@playwright/test").WebSocketRoute[] = [];
  let clientCloses = 0;
  await page.routeWebSocket("**/api/v1/socket", (socket) => {
    const server = socket.connectToServer();
    connections.push(socket);
    socket.onClose(() => {
      clientCloses++;
      server.close();
    });
  });

  await page.goto("/#/kiosk");
  await expect(page).toHaveURL(/#\/login$/);
  expect(connections).toHaveLength(0);
  await page.getByLabel("Email", { exact: true }).fill("doctor@demo.test");
  await page.getByLabel("Password", { exact: true }).fill("Dhaaga-demo-2026!");
  await page.getByRole("button", { name: "Sign in to workspace" }).click();
  await expect(page).toHaveURL(/#\/kiosk$/);
  await page.getByRole("link", { name: "Clinician queue", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Clinic queue", exact: true })).toBeVisible();
  await expect.poll(() => connections.length).toBe(1);
  await connections[0]?.close({ code: 1012, reason: "Test connection restart" });
  await expect.poll(() => connections.length).toBe(2);
  await page.getByRole("button", { name: "Refresh", exact: false }).click();
  await expect(page.getByRole("heading", { name: "Clinic queue", exact: true })).toBeVisible();
  const beforeLogout = clientCloses;
  await page.getByRole("button", { name: "Sign out", exact: false }).click();
  await expect(page).toHaveURL(/#\/login$/);
  await expect.poll(() => clientCloses).toBeGreaterThan(beforeLogout);
  expect(connections).toHaveLength(2);
});
