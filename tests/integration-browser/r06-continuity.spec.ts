import { expect, test } from "@playwright/test";
import { DatabaseSync } from "node:sqlite";
import { resolve } from "node:path";
import {
  r06Dispense, r06Home, r06NurseCalls, r06Patient, r06Post, r06Readings, r06Refills,
  r06ReviewedVisit, r06Staff, r06Stock, type R06Request,
} from "../r06-fixture";

test("confirms a device reading and hands off authorized follow-up, refill and wellness records", async ({ page, browser }) => {
  test.setTimeout(60_000);
  const makePage = () => browser.newPage({ baseURL: test.info().project.use.baseURL });
  const [cashierPage, nursePage, doctorPage] = await Promise.all([makePage(), makePage(), makePage()]);
  const dateInIndia = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" });
  const request: R06Request = async (path, options = {}) => {
    const reply = await page.request.fetch(`/api/v1${path}`, {
      method: options.method ?? "GET",
      data: options.body,
      headers: {
        "Idempotency-Key": crypto.randomUUID(),
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
    });
    return { status: reply.status(), json: () => reply.json() };
  };
  try {
    const [doctor, cashier, nurse, admin, east] = await Promise.all([
      r06Staff(request, "doctor"), r06Staff(request, "cashier"),
      r06Staff(request, "nurse"), r06Staff(request, "admin"), r06Staff(request, "east-cashier"),
    ]);
    const visit = await r06ReviewedVisit(request, doctor.token);
    await r06Stock(request, admin.token, cashier.token);
    await r06Dispense(request, doctor.token, cashier.token, visit.id);
    const patient = await r06Patient(request, "home");
    await doctorPage.addInitScript(session => localStorage.setItem("cf_auth_session", JSON.stringify(session)), doctor);
    await doctorPage.bringToFront();
    await doctorPage.goto("/erp.html#/app/doctor/queue");
    await doctorPage.getByText("Synthetic patient", { exact: true }).first().click();
    await doctorPage.getByRole("button", { name: /Open Prescriptions/ }).click();
    await doctorPage.getByText("Recovery and refill approvals", { exact: true }).click();
    await doctorPage.getByLabel("Recovery through (IST)").fill("2099-10-01");
    await doctorPage.getByRole("button", { name: "Approve recovery outreach" }).click();
    await expect(doctorPage.getByText(/Recovery plan approved through/)).toBeVisible();
    await doctorPage.getByLabel("Accept requests through (IST)").fill("2099-09-30");
    await doctorPage.getByLabel("Refill course ends (IST)").fill("2099-10-01");
    await doctorPage.getByLabel(/I reviewed the patient and authorize/).check();
    await doctorPage.getByRole("button", { name: "Approve one refill" }).click();
    await expect(doctorPage.getByText(/One refill approved through/)).toBeVisible();
    const dbPath = test.info().config.webServer?.env?.INTEGRATION_DB;
    expect(dbPath).toMatch(/^\.local\/integration-e2e-\d+\.sqlite$/);
    // The browser supplies today's reading. Seed the preceding dated records only in the disposable fixture.
    const db = new DatabaseSync(resolve(dbPath!));
    try {
      expect(db.prepare("SELECT synthetic FROM patients WHERE org_id='demo' AND id=?").get(visit.patientId)).toEqual({ synthetic: 1 });
      const now = Date.now();
      db.prepare("UPDATE recovery_plans SET approved_at=? WHERE org_id='demo' AND encounter_id=?")
        .run(new Date(now - 15 * 86_400_000).toISOString(), visit.id);
      for (const [index, systolic] of r06Readings.slice(0, -1).entries()) {
        const stamp = new Date(now - (13 - index) * 86_400_000);
        db.prepare("INSERT INTO patient_check_ins(org_id,patient_id,day,created_at,observations_json) VALUES('demo',?,?,?,?)")
          .run(visit.patientId, dateInIndia.format(stamp), stamp.toISOString(), JSON.stringify({
            systolic, diastolic: 78, recovery: "same", medication: "taken", distress: false,
          }));
      }
    } finally {
      db.close();
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(token => sessionStorage.setItem("jeevika_patient_session_v1", token), patient.token);
    await page.bringToFront();
    await page.goto("/erp.html#/app/home/thread");
    await expect(page.getByRole("heading", { name: "Medicine dispensed", exact: true })).toHaveCount(1);
    await page.getByRole("link", { name: "Check-In", exact: true }).click();
    await page.getByLabel("How are you feeling today?").selectOption("same");
    await page.getByLabel("Did you take your scheduled medicines?").selectOption("taken");
    await page.getByLabel("Do you need urgent help right now?").selectOption("no");
    await expect(page.getByLabel("Take or upload a JPG or PNG")).toBeVisible();
    const image = await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = 720;
      canvas.height = 240;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Chromium canvas unavailable");
      context.fillStyle = "white";
      context.fillRect(0, 0, 720, 240);
      context.fillStyle = "black";
      context.font = "76px Arial";
      context.fillText("136 / 78", 40, 140);
      return canvas.toDataURL("image/png").split(",")[1] ?? "";
    });
    await page.getByLabel("Take or upload a JPG or PNG").setInputFiles({
      name: "synthetic-device.png", mimeType: "image/png", buffer: Buffer.from(image, "base64"),
    });
    await expect(page.getByLabel("Review extracted device text")).toHaveValue(/136\s*[/|]\s*78/, { timeout: 20_000 });
    await expect(page.getByLabel("Systolic (mmHg)")).toHaveValue("");
    await page.getByRole("button", { name: "Use reviewed blood pressure values" }).click();
    await expect(page.getByLabel("Systolic (mmHg)")).toHaveValue("136");
    await page.getByRole("button", { name: "Save check-in" }).click();
    await expect(page.getByText("Check-in saved.", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Drift", exact: true }).click();
    await expect(page.getByText("A change was detected", { exact: true })).toBeVisible();

    await nursePage.addInitScript(session => localStorage.setItem("cf_auth_session", JSON.stringify(session)), nurse);
    await nursePage.bringToFront();
    await nursePage.goto("/erp.html#/app/nurse-calls");
    const queue = nursePage.getByText("Approved OPD recovery review", { exact: true });
    await expect(queue).toHaveCount(1);
    const minutes = nursePage.getByRole("slider", { name: "Available call minutes" });
    await minutes.click({ position: { x: 3, y: 5 } });
    await expect(minutes).toHaveValue("0");
    await expect(nursePage.getByText("Beyond call budget", { exact: true })).toBeVisible();
    await nursePage.getByRole("button", { name: "Acknowledge task" }).click();
    await expect(nursePage.getByText("Acknowledged", { exact: true })).toBeVisible();
    await nursePage.getByRole("button", { name: "OPD review requested" }).click();
    await expect(nursePage.getByRole("heading", { name: "No outreach items" })).toBeVisible();
    expect((await request(r06NurseCalls, { token: cashier.token })).status).toBe(403);

    await page.bringToFront();
    await page.goto("/erp.html#/app/home/refill");
    await page.getByRole("button", { name: "Request refill", exact: true }).click();
    await expect(page.getByText("Awaiting pharmacy review", { exact: true })).toBeVisible();
    expect(await (await request(r06Refills, { token: east.token })).json()).toEqual({ items: [] });
    await cashierPage.addInitScript(session => localStorage.setItem("cf_auth_session", JSON.stringify(session)), cashier);
    await cashierPage.bringToFront();
    await cashierPage.goto("/erp.html#/app/pos");
    await cashierPage.getByRole("button", { name: "Confirm stock hold" }).click();
    await expect(cashierPage.getByText(/Stock held until/)).toBeVisible();
    await page.bringToFront();
    await page.reload();
    await expect(page.getByText(/Stock held until/)).toBeVisible();
    await page.getByRole("button", { name: "Cancel refill request" }).click();
    await expect(page.getByText("Request closed", { exact: true })).toBeVisible();

    await r06Post(request, `${r06Home}/her/consent`, { granted: true }, patient.token, 200);
    await r06Post(request, `${r06Home}/her`, {
      date: dateInIndia.format(new Date()), flow: "light", pain: 2, mood: "Synthetic", periodStarted: false,
    }, patient.token);
    await page.goto("/erp.html#/app/home/her");
    await page.getByText("Share HER summary", { exact: true }).click();
    await page.getByLabel("Reviewed clinic visit").selectOption(visit.id);
    await page.getByRole("button", { name: "Share with reviewing clinician" }).click();
    await expect(page.getByText("Summary shared with the reviewing clinician.", { exact: true })).toBeVisible();
    const preview = `/clinical/wellness/${visit.id}`;
    expect(await (await request(preview, { token: doctor.token })).json()).toMatchObject({ summaries: [{ kind: "her" }] });
    await doctorPage.bringToFront();
    await doctorPage.getByText("Patient-shared wellness summaries", { exact: true }).click();
    await doctorPage.getByRole("button", { name: "Refresh shared summaries" }).click();
    await expect(doctorPage.getByRole("heading", { name: "HER tracking summary" })).toBeVisible();
    await page.bringToFront();
    await page.getByRole("button", { name: "Revoke summary access" }).click();
    await expect(page.getByText("Summary access revoked.", { exact: true })).toBeVisible();
    expect(await (await request(preview, { token: doctor.token })).json()).toEqual({ summaries: [] });
    await doctorPage.bringToFront();
    await doctorPage.getByRole("button", { name: "Refresh shared summaries" }).click();
    await expect(doctorPage.getByText("No active patient shares for this visit.")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  } finally {
    await Promise.all([cashierPage.close(), nursePage.close()]);
  }
});
