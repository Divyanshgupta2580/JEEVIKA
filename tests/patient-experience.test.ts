import { afterAll, beforeAll, expect, it } from "vitest";
import { demoPatientIdentity } from "../packages/shared/patient-experience";
import { phase4Fixture } from "./phase4-fixture";

let fixture: Awaited<ReturnType<typeof phase4Fixture>>;
let patientToken: string;
let clinician: string;
let otherClinic: string;
let otherOrg: string;

const consent = {
  care: true,
  pharmacy: false,
  remote: false,
  research: false,
  guardian: false,
};
const allNo = {
  chestPain: "no",
  breathless: "no",
  fainting: "no",
  fever: "no",
  cough: "no",
  fatigue: "no",
  thirst: "no",
};
beforeAll(async () => {
  fixture = await phase4Fixture();
  const [doctor, east, foreign] = await Promise.all([
    fixture.login("doctor"),
    fixture.login("east-doctor"),
    fixture.login("doctor", "other-org"),
  ]);
  clinician = doctor.token;
  otherClinic = east.token;
  otherOrg = foreign.token;
});
afterAll(() => fixture.db.close());

async function otp(
  purpose: "home" | "kiosk",
  method: "abha" | "mobile" = "mobile",
) {
  const response = await fixture.request("/auth/patient/otp/start", {
    method: "POST",
    body: { purpose, method, identifier: demoPatientIdentity[method] },
  });
  expect(response.status).toBe(201);
  return (await response.json()) as { id: string; demoCode: string };
}

it("requires a one-use, purpose-scoped code and a verified patient bearer token", async () => {
  const challenge = await otp("home");
  const verify = (code: string, purpose: "home" | "kiosk" = "home") =>
    fixture.request("/auth/patient/otp/verify", {
      method: "POST",
      body: { id: challenge.id, code, purpose },
    });
  expect((await verify(challenge.demoCode, "kiosk")).status).toBe(401);
  expect(
    (await verify(challenge.demoCode === "000000" ? "111111" : "000000"))
      .status,
  ).toBe(401);
  const valid = await verify(challenge.demoCode);
  expect(valid.status).toBe(200);
  const identity = (await valid.json()) as {
    token: string;
    simulated: boolean;
  };
  patientToken = identity.token;
  expect(identity.simulated).toBe(true);
  expect((await verify(challenge.demoCode)).status).toBe(401);
  expect(
    (await fixture.request("/auth/patient/me", { token: patientToken })).status,
  ).toBe(200);
  expect((await fixture.request("/home/companion/thread")).status).toBe(401);
  expect(
    (await fixture.request("/home/companion/thread", { token: clinician }))
      .status,
  ).toBe(401);
  expect(
    (
      await fixture.request("/auth/patient/otp/start", {
        method: "POST",
        body: { purpose: "home", method: "abha", identifier: "11111111111111" },
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await fixture.request("/auth/patient/otp/start", {
        method: "POST",
        bindings: { ENVIRONMENT: "production" },
        body: {
          purpose: "home",
          method: "abha",
          identifier: demoPatientIdentity.abha,
        },
      })
    ).status,
  ).toBe(503);
});

it("hands off a sessionless verified intake and keeps the consented document clinic-scoped", async () => {
  const challenge = await otp("kiosk", "abha");
  const verified = await fixture.request("/auth/patient/otp/verify", {
    method: "POST",
    body: { purpose: "kiosk", id: challenge.id, code: challenge.demoCode },
  });
  expect(verified.status).toBe(200);
  const { verifiedIdentityId } = (await verified.json()) as {
    verifiedIdentityId: string;
  };
  const body = {
    locale: "mr",
    intent: "intake",
    consent,
    complaint: "fever",
    answers: allNo,
    verifiedIdentityId,
    documentText: "Synthetic OCR review",
  };
  const key = crypto.randomUUID();
  const request = (payload: typeof body) =>
    fixture.request("/kiosk/intake", {
      method: "POST",
      body: payload,
      idempotencyKey: key,
    });
  const replies = await Promise.all([request(body), request(body)]);
  expect(replies.map((result) => result.status).sort()).toEqual([200, 201]);
  const [first, second] = await Promise.all(
    replies.map((response) => response.json()),
  );
  expect(first).toEqual(second);
  expect(first).toMatchObject({
    token: expect.stringMatching(/^OPD-/),
    receiptId: expect.any(String),
    triage: "routine",
  });
  expect((await request({ ...body, complaint: "other" })).status).toBe(409);
  const found = await (
    await fixture.request("/encounters", { token: clinician })
  ).json();
  expect(found).toMatchObject({
    encounters: expect.arrayContaining([
      expect.objectContaining({
        language: "en-IN",
        tokenNumber: expect.stringMatching(/^OPD-/),
        documentReview: "Synthetic OCR review",
      }),
    ]),
  });
  for (const token of [otherClinic, otherOrg]) {
    const hidden = await (
      await fixture.request("/encounters", { token })
    ).json();
    expect(hidden).toMatchObject({ encounters: [] });
  }
  expect(
    (
      await fixture.request("/kiosk/intake", {
        method: "POST",
        body,
        idempotencyKey: null,
      })
    ).status,
  ).toBe(400);
  const thread = await (
    await fixture.request("/home/companion/thread", { token: patientToken })
  ).json();
  expect(thread).toMatchObject({
    events: expect.arrayContaining([
      expect.objectContaining({ title: "Kiosk intake" }),
    ]),
    nextAction: "check-in",
  });
});

it("immediately issues an emergency token after a positive stomach-pain interceptor response", async () => {
  const incomplete = await fixture.request("/kiosk/intake", {
    method: "POST",
    body: {
      locale: "bn",
      intent: "intake",
      consent,
      complaint: "stomach",
      answers: allNo,
    },
  });
  expect(incomplete.status).toBe(400);
  const emergency = await fixture.request("/kiosk/intake", {
    method: "POST",
    body: {
      locale: "bn",
      intent: "intake",
      consent,
      complaint: "stomach",
      interceptor: { radiation: "yes" },
    },
  });
  expect(emergency.status).toBe(201);
  expect(await emergency.json()).toMatchObject({
    triage: "emergency",
    token: expect.stringMatching(/^EMERG-/),
  });
});

it("persists patient check-ins once per day, shows urgent readings, and honours logout", async () => {
  const token = patientToken;
  const body = {
    recovery: "same",
    medication: "taken",
    distress: false,
    systolic: 181,
    diastolic: 85,
  };
  const save = () =>
    fixture.request("/home/companion/check-in", {
      token,
      method: "POST",
      body,
    });
  const submitted = await save();
  expect(submitted.status).toBe(201);
  expect(await submitted.json()).toMatchObject({ urgent: true });
  expect((await save()).status).toBe(409);
  expect(
    await (await fixture.request("/home/companion/drift", { token })).json(),
  ).toMatchObject({ baseline: null, urgent: true });
  expect(
    await (await fixture.request("/home/companion/thread", { token })).json(),
  ).toMatchObject({ nextAction: null });
  expect(
    (await fixture.request("/auth/patient/logout", { token, method: "POST" }))
      .status,
  ).toBe(200);
  expect(
    (await fixture.request("/home/companion/thread", { token })).status,
  ).toBe(401);
});

it("enforces tracking consent and persists HER cycles and Vitalis observations", async () => {
  const challenge = await otp("home", "abha");
  const verified = await fixture.request("/auth/patient/otp/verify", {
    method: "POST",
    body: { purpose: "home", id: challenge.id, code: challenge.demoCode },
  });
  expect(verified.status).toBe(200);
  const { token } = (await verified.json()) as { token: string };
  const post = (url: string, body: unknown) =>
    fixture.request(`/home/companion/${url}`, { token, method: "POST", body });
  const get = (url: string) =>
    fixture.request(`/home/companion/${url}`, { token });
  const entry = {
    date: "2026-01-01",
    flow: "medium",
    pain: 2,
    mood: "Calm",
    periodStarted: true,
    periodLength: 4,
  };
  const reading = { metric: "resting_heart_rate", value: 66 };
  expect((await post("her", entry)).status).toBe(403);
  expect((await post("vitalis", reading)).status).toBe(403);
  expect((await post("her/consent", { granted: true })).status).toBe(200);
  expect((await post("vitalis/consent", { granted: true })).status).toBe(200);
  expect((await post("her", entry)).status).toBe(201);
  expect((await post("vitalis", reading)).status).toBe(201);
  expect(await (await get("her")).json()).toMatchObject({
    cycle: { lastStart: entry.date, phase: null },
    records: [expect.objectContaining({ mood: "Calm" })],
  });
  expect(await (await get("vitalis")).json()).toMatchObject({
    index: { score: null },
    observations: [
      expect.objectContaining({
        value_numeric: 66,
        source_type: "patient_reported",
      }),
    ],
  });
  expect((await post("her/consent", { granted: false })).status).toBe(200);
  expect((await post("vitalis/consent", { granted: false })).status).toBe(200);
  expect(await (await get("her")).json()).toMatchObject({
    consent: false,
    records: [],
  });
  expect(await (await get("vitalis")).json()).toMatchObject({
    consent: false,
    observations: [],
  });
  expect(
    await (
      await post("yoga", {
        cardiovascularRestriction: false,
        eyePressureRestriction: true,
        spineRestriction: false,
        acuteSymptoms: false,
      })
    ).json(),
  ).toEqual({ restricted: true, items: [] });
});
