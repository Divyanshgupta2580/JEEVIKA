import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { issuePatientSession } from "../backend/src/patient-session";
import { clinicalDay } from "../backend/src/modules/dispensing/prescription-review";
import { dashavidha } from "../packages/shared/ayush";
import { phase4Fixture } from "./phase4-fixture";
import {
  r06Dispense, r06Home, r06NurseCalls, r06Patient, r06Pharmacy, r06Post, r06Reading, r06Readings,
  r06Refills, r06ReviewedVisit, r06Sku, r06Staff, r06Stock,
} from "./r06-fixture";

let fixture: Awaited<ReturnType<typeof phase4Fixture>>;
beforeEach(async () => {
  fixture = await phase4Fixture();
  fixture.db.raw.exec(`INSERT INTO users(org_id,id,clinic_id,email,role,password_salt,password_hash)
     SELECT org_id,'east-nurse','east','east-nurse@demo.test',role,password_salt,password_hash
     FROM users WHERE org_id='demo' AND id='nurse'`);
});
afterEach(() => { vi.useRealTimers(); fixture.db.close(); });

const request: typeof fixture.request = (path, options) =>
  fixture.request(path, { ...options, bindings: { PLATFORM_SUPER_ADMINS: "", ...options?.bindings } });
const read = (path: string, token?: string) => request(path, { token });
const write = (path: string, body: object, token?: string) => request(path, { token, method: "POST", body });
const advance = (start: number, days: number) => vi.setSystemTime(start + days * 86_400_000);
async function authenticated(user: string, org?: string) { return (await r06Staff(request, user, org)).token; }

it("projects one exact posted fulfillment for a fresh patient session and withdraws access", async () => {
  const [doctor, cashier, admin] = await Promise.all([authenticated("doctor"), authenticated("cashier"), authenticated("admin")]);
  const visit = await r06ReviewedVisit(request, doctor);
  await r06Stock(request, admin, cashier);
  const { rx, sale } = await r06Dispense(request, doctor, cashier, visit.id);
  const patient = (await r06Patient(request, "home")).token;
  const events = async (token: string) => ((await (await read(`${r06Home}/thread`, token)).json()) as {
    events: { id: string; title: string; prescriptionId?: string }[];
  }).events;
  for (const session of [patient, (await r06Patient(request, "home")).token]) {
    const entries = await events(session);
    expect(entries.filter(event => event.title === "Medicine dispensed")).toEqual([
      expect.objectContaining({ id: sale.id, prescriptionId: rx.id }),
    ]);
    expect(entries).toEqual(expect.arrayContaining([expect.objectContaining({ id: visit.id }), expect.objectContaining({ id: rx.id })]));
  }
  const otherPatient = await issuePatientSession({ DB: fixture.db, ENVIRONMENT: "test" }, "other-org", visit.patientId, true);
  expect((await events(otherPatient!.token)).filter(event => event.title === "Medicine dispensed")).toEqual([]);
  expect((await write(`/encounters/${visit.id}/revoke/pharmacy`, {}, doctor)).status).toBe(200);
  expect((await events(patient)).some(event => event.title === "Medicine dispensed")).toBe(false);
  expect((await events(patient)).some(event => event.id === rx.id)).toBe(true);
});

it("deduplicates a consented OPD drift episode, denies out-of-scope actors, and closes one acknowledged task", async () => {
  const [doctor, eastDoctor] = await Promise.all([authenticated("doctor"), authenticated("east-doctor")]);
  const visit = await r06ReviewedVisit(request, doctor);
  const noRemote = await r06ReviewedVisit(request, doctor, false);
  const plan = { expiresOn: "2099-10-01", criterion: "sustained-systolic-v1" };
  expect((await write(`/clinical/recovery/${visit.id}`, plan, eastDoctor)).status).toBe(404);
  expect((await write(`/clinical/recovery/${noRemote.id}`, plan, doctor)).status).toBe(404);
  expect((await write(`/clinical/recovery/${visit.id}`, plan, doctor)).status).toBe(201);
  expect((await write(`/clinical/recovery/${visit.id}`, plan, doctor)).status).toBe(200);
  const start = Date.now();
  const patient = (await r06Patient(request, "home")).token;
  vi.useFakeTimers({ toFake: ["Date"] });
  for (const [index, reading] of r06Readings.entries()) {
    advance(start, index + 1);
    expect((await write(`${r06Home}/check-in`, r06Reading(reading), patient)).status).toBe(201);
    if (reading === 130) {
      expect(await (await read(`${r06Home}/drift`, patient)).json()).toMatchObject({ status: "trend-change", alert: true });
      expect(fixture.db.raw.prepare("SELECT COUNT(*) AS n FROM recovery_outreach").get()).toEqual({ n: 0 });
    }
  }
  expect((await write(`${r06Home}/check-in`, r06Reading(150), patient)).status).toBe(409);
  const nurse = await authenticated("nurse");
  const nurseItems = async (token: string) => {
    const reply = await read(r06NurseCalls, token);
    expect(reply.status).toBe(200);
    return await reply.json() as {
      items: { taskId: string; priority: string; kind: string; acknowledgedAt: string | null }[];
    };
  };
  const trends = await Promise.all([read(`${r06Home}/drift`, patient), read(`${r06Home}/drift`, patient)]);
  for (const trend of trends) expect(await trend.json()).toMatchObject({
    readings: Array.from({ length: 14 }, () => expect.any(Object)),
    baseline: 120, alert: true, urgent: false, status: "sustained",
  });
  expect(fixture.db.raw.prepare("SELECT baseline,systolic FROM recovery_outreach").all()).toEqual([{ baseline: 120, systolic: 132 }]);
  const { items } = await nurseItems(nurse);
  expect(items).toEqual([expect.objectContaining({ priority: "review", kind: "opd-recovery", acknowledgedAt: null })]);
  const taskId = items[0]!.taskId;
  for (const fresh of [await authenticated("east-nurse"), await authenticated("nurse", "other-org")]) {
    expect(await nurseItems(fresh)).toEqual({ items: [] });
    expect((await write(`${r06NurseCalls}/tasks/${taskId}/acknowledge`, {}, fresh)).status).toBe(404);
  }
  const payload = { taskId, outcome: "opd-requested" };
  expect((await write(`${r06NurseCalls}/outcomes`, payload, nurse)).status).toBe(409);
  const ack = (token: string) => write(`${r06NurseCalls}/tasks/${taskId}/acknowledge`, {}, token);
  const [first, second] = await Promise.all([ack(nurse), ack(await authenticated("nurse"))]);
  expect([first.status, second.status]).toEqual([200, 200]);
  expect(await first.json()).toEqual(await second.json());
  const freshNurse = await authenticated("nurse");
  const results = await Promise.all([write(`${r06NurseCalls}/outcomes`, payload, nurse), write(`${r06NurseCalls}/outcomes`, payload, freshNurse)]);
  expect(results.map(reply => reply.status).sort()).toEqual([201, 409]);
  expect(await nurseItems(freshNurse)).toEqual({ items: [] });
  expect(await (await read("/encounters", await authenticated("doctor"))).json()).toMatchObject({
    encounters: expect.arrayContaining([expect.objectContaining({ id: visit.id, outreachReviewRequested: true })]),
  });
  advance(start, 15);
  expect((await write(`${r06Home}/check-in`, r06Reading(137), patient)).status).toBe(201);
  expect(await nurseItems(await authenticated("nurse"))).toEqual({ items: [] });
  advance(start, 16);
  expect(await (await write(`${r06Home}/check-in`, r06Reading(180), patient)).json()).toMatchObject({ urgent: true });
  expect(await (await read(`${r06Home}/drift`, patient)).json()).toMatchObject({ urgent: true, alert: false });
});

it("keeps missing readings, cold start, and revoked plans out of OPD outreach", async () => {
  const doctor = await authenticated("doctor");
  const visit = await r06ReviewedVisit(request, doctor);
  const plan = { expiresOn: "2099-10-01", criterion: "sustained-systolic-v1" };
  expect((await write(`/clinical/recovery/${visit.id}`, plan, doctor)).status).toBe(201);
  const patient = (await r06Patient(request, "home")).token;
  const current = Date.now();
  const get = async () => (await read(`${r06Home}/drift`, patient)).json();
  expect(await get()).toMatchObject({ status: "no-readings", alert: false });
  expect((await write(`${r06Home}/check-in`, r06Reading(), patient)).status).toBe(201);
  expect(await get()).toMatchObject({ status: "missing-systolic", alert: false });
  expect((await write(`/encounters/${visit.id}/revoke/remote`, {}, doctor)).status).toBe(200);
  vi.useFakeTimers({ toFake: ["Date"] });
  for (const [index, reading] of r06Readings.entries()) {
    advance(current, index + 1);
    expect((await write(`${r06Home}/check-in`, r06Reading(reading), patient)).status).toBe(201);
    if (!index) expect(await get()).toMatchObject({ status: "learning", alert: false });
  }
  expect(await get()).toMatchObject({ status: "sustained", alert: true });
  expect(await (await read(r06NurseCalls, await authenticated("nurse"))).json()).toEqual({ items: [] });
  expect(fixture.db.raw.prepare("SELECT COUNT(*) AS n FROM recovery_outreach").get()).toEqual({ n: 0 });
});

it("requires durable refill approval, reserves exact FEFO stock atomically, expires it, and forecasts confirmed consented requests", async () => {
  const [doctor, cashier, admin, manager, east, foreign] = await Promise.all([
    authenticated("doctor"), authenticated("cashier"), authenticated("admin"), authenticated("clinic-admin"),
    authenticated("east-cashier"), authenticated("cashier", "other-org"),
  ]);
  const visit = await r06ReviewedVisit(request, doctor);
  await r06Stock(request, admin, cashier);
  await r06Dispense(request, doctor, cashier, visit.id);
  const patient = (await r06Patient(request, "home")).token;
  const list = async (token: string) => (await (await read(`${r06Home}/prescriptions`, token)).json()) as {
    prescriptions: { lineId: string; dispensed: number; refillEligible: number | null; refillStatus: string | null }[];
  };
  const { prescriptions } = await list(patient);
  const line = prescriptions[0]!.lineId;
  const ask = () => write(`${r06Home}/refills`, { lineId: line }, patient);
  const hazard = `/bridge/threadpulse/hazard?sku=${r06Sku.id}`;
  expect(await (await read(hazard, manager)).json()).toEqual({ status: "missing-cohort", forecast: null });
  expect((await read(hazard, cashier)).status).toBe(403);
  expect((await ask()).status).toBe(404);
  const approval = { requestThrough: "2099-09-30", courseEnd: "2099-10-01", confirmedNewReview: true };
  expect((await write(`${r06Refills}/approval/${line}`, approval, await authenticated("east-doctor"))).status).toBe(404);
  expect((await write(`${r06Refills}/approval/${line}`, approval, doctor)).status).toBe(201);
  expect((await list(patient)).prescriptions[0]?.refillEligible).toBe(1);
  const [a, b] = await Promise.all([ask(), ask()]);
  expect([a.status, b.status]).toEqual([200, 200]);
  const refill = await a.json() as { id: string; status: string };
  expect(await b.json()).toEqual(refill);
  expect(refill.status).toBe("requested");
  expect((await list((await r06Patient(request, "home")).token)).prescriptions[0]?.refillStatus).toBe("requested");
  expect(await (await read(hazard, manager)).json()).toMatchObject({
    status: "confirmed-requests", patients: 1, requestedUnits: 7, heldUnits: 0,
    forecast: { pmf: [0, 1], expectedDemand: 1, target: 1 }, collectionProbability: null,
  });
  const hold = (token: string, confirmed = true) => write(`${r06Refills}/${refill.id}/hold`, { confirmed }, token);
  expect((await hold(east)).status).toBe(404);
  expect((await hold(foreign)).status).toBe(404);
  expect((await hold(cashier, false)).status).toBe(400);
  const held = await Promise.all([hold(cashier), hold(cashier)]);
  expect(held.map(reply => reply.status)).toEqual([200, 200]);
  expect(await held[0]!.json()).toEqual(await held[1]!.json());
  const heldLots = `SELECT b.batch_no,h.units FROM refill_hold_lines h JOIN inventory_batches b
    ON b.org_id=h.org_id AND b.id=h.batch_id ORDER BY b.expiry`;
  expect(fixture.db.raw.prepare(heldLots).all()).toEqual([{ batch_no: "SYN-R06-B", units: 6 }, { batch_no: "SYN-R06-C", units: 1 }]);
  expect(fixture.db.raw.prepare("SELECT COUNT(*) AS n FROM sales").get()).toEqual({ n: 1 });
  expect(await (await read(hazard, manager)).json()).toMatchObject({ requestedUnits: 7, heldUnits: 7 });
  const start = Date.now();
  vi.useFakeTimers({ toFake: ["Date"] });
  advance(start, 2);
  expect((await list(patient)).prescriptions[0]?.refillStatus).toBe("released");
  expect((await read(`${r06Pharmacy}/inventory`, await authenticated("cashier"))).status).toBe(200);
  expect(fixture.db.raw.prepare("SELECT SUM(reserved_units) AS units FROM inventory_batches").get()).toEqual({ units: 0 });
  expect(fixture.db.raw.prepare("SELECT status,release_reason FROM refill_requests").get()).toEqual({ status: "released", release_reason: "expired" });
  expect(await (await read(hazard, await authenticated("clinic-admin"))).json()).toEqual({ status: "missing-cohort", forecast: null });
});

it("isolates wellness sharing by clinician and consent, preserves provenance, and guards yoga and Prakriti", async () => {
  const doctor = await authenticated("doctor");
  const { id, patientId } = await r06ReviewedVisit(request, doctor);
  const patient = (await r06Patient(request, "home")).token;
  const share = (kind: string) => write(`${r06Home}/wellness/shares`, { encounterId: id, kind }, patient);
  expect((await share("her")).status).toBe(404);
  const her = { date: clinicalDay(), flow: "light", pain: 3, mood: "Synthetic only", periodStarted: true, periodLength: 4 };
  for (const path of ["her", "vitalis"]) {
    expect((await write(`${r06Home}/${path}/consent`, { granted: true }, patient)).status).toBe(200);
  }
  expect((await write(`${r06Home}/her`, her, patient)).status).toBe(201);
  expect((await write(`${r06Home}/vitalis`, { metric: "resting_heart_rate", value: 66 }, patient)).status).toBe(201);
  const [h, v] = await Promise.all([share("her"), share("vitalis")]);
  expect([h.status, v.status]).toEqual([200, 200]);
  const { id: shareId } = (await h.json()) as { id: string };
  const preview = `/clinical/wellness/${id}`;
  expect(await (await read(preview, doctor)).json()).toMatchObject({
    summaries: [
      { kind: "her", records: [{ day: her.date, pain: 3 }] },
      { kind: "vitalis", records: [{ metric: "Resting heart rate", value: 66, source: "patient_reported", quality: "unverified" }] },
    ],
  });
  expect(await (await read(preview, await authenticated("east-doctor"))).json()).toEqual({ summaries: [] });
  expect((await read(preview, await authenticated("nurse"))).status).toBe(403);
  expect((await write(`${r06Home}/wellness/shares/${shareId}/revoke`, {}, patient)).status).toBe(200);
  expect(await (await read(preview, doctor)).json()).toMatchObject({ summaries: [{ kind: "vitalis" }] });
  await write(`${r06Home}/vitalis/consent`, { granted: false }, patient);
  await write(`${r06Home}/vitalis/consent`, { granted: true }, patient);
  expect(await (await read(preview, doctor)).json()).toEqual({ summaries: [] });
  expect((await request("/her/profile", { bindings: { ENVIRONMENT: "production" } })).status).toBe(503);
  expect((await request("/vitalis/doctor-summary", { bindings: { ENVIRONMENT: "production" } })).status).toBe(503);

  const yoga = { cardiovascularRestriction: false, eyePressureRestriction: false, spineRestriction: false, acuteSymptoms: false };
  const ready = (await (await write(`${r06Home}/yoga`, yoga, patient)).json()) as { restricted: boolean; items: object[] };
  expect(ready.restricted).toBe(false);
  expect(ready.items).toHaveLength(2);
  fixture.db.raw.prepare(`INSERT INTO vitalis_profiles(id,org_id,patient_id,year_of_birth,clinician_restricted_exertion)
    VALUES('r06-vitalis-profile','demo',?,1980,1)`).run(patientId);
  expect(await (await write(`${r06Home}/yoga`, yoga, patient)).json()).toEqual({ restricted: true, items: [] });
  expect(await (await read(`${r06Home}/prakriti`, patient)).json()).toEqual({ assessment: null });
  const examination = Object.fromEntries(Object.keys(dashavidha).map(field => [field, "Synthetic practitioner observation"]));
  const note = { examination, agni: "Samagni", dosha: { vata: 30, pitta: 40, kapha: 30 }, namasteCode: "", tm2Code: "",
    concurrentMedicines: [], formulations: [], plan: "Synthetic notes." };
  expect((await request(`/ayush/cases/${id}`, { token: doctor, method: "PUT", body: { version: 0, note } })).status).toBe(200);
  expect(await (await read(`${r06Home}/prakriti`, patient)).json()).toMatchObject({ assessment: { agni: "Samagni", prakriti: examination.prakriti } });
  expect((await write(`/encounters/${id}/revoke`, {}, doctor)).status).toBe(200);
  expect(await (await read(`${r06Home}/prakriti`, patient)).json()).toEqual({ assessment: null });
});

it("compares two persisted request intents exactly and rolls back a competing short hold", async () => {
  const [doctor, cashier, admin, manager] = await Promise.all([
    authenticated("doctor"), authenticated("cashier"), authenticated("admin"), authenticated("clinic-admin"),
  ]);
  const first = await r06ReviewedVisit(request, doctor);
  const second = await r06Post<{ id: string; patientId: string }>(request, "/encounters", {
    patient: { name: "Synthetic second patient", birthDate: "1988-01-01", gender: "female", language: "en-IN" },
    chiefComplaint: "Synthetic second visit",
    answers: { chestPain: "no", breathless: "no", fainting: "no" },
    careConsent: true, synthetic: true,
  }, doctor);
  await r06Post(request, `/encounters/${second.id}/review`, { note: "Synthetic second visit reviewed." }, doctor, 200);
  // The demo OTP binds to one synthetic profile. Seed the second opted-in intake locally.
  fixture.db.raw.prepare(`INSERT INTO kiosk_intakes(org_id,clinic_id,request_id,request_hash,encounter_id,receipt_id,token_number,
    consent_version,consent_json,created_at) VALUES('demo','north',?,?,?,?,?,'kiosk-consent-v2',?,?)`)
    .run(crypto.randomUUID(), "synthetic", second.id, crypto.randomUUID(), "OPD-SYNTHETIC-2",
      JSON.stringify({ care: true, pharmacy: true, remote: true, research: false, guardian: false }), new Date().toISOString());
  await r06Stock(request, admin, cashier);
  const items = [];
  for (const [visit, token] of [
    [first, (await r06Patient(request, "home")).token],
    [second, (await issuePatientSession({ DB: fixture.db, ENVIRONMENT: "test" }, "demo", second.patientId, false, true))!.token],
  ] as const) {
    await r06Dispense(request, doctor, cashier, visit.id);
    const payload = await (await read(`${r06Home}/prescriptions`, token)).json() as { prescriptions: { lineId: string }[] };
    const lineId = payload.prescriptions[0]!.lineId;
    await r06Post(request, `${r06Refills}/approval/${lineId}`, {
      requestThrough: "2099-09-30", courseEnd: "2099-10-01", confirmedNewReview: true,
    }, doctor);
    items.push(await r06Post<{ id: string }>(request, `${r06Home}/refills`, { lineId }, token, 200));
  }
  const hazard = `/bridge/threadpulse/hazard?sku=${r06Sku.id}`;
  expect(await (await read(hazard, manager)).json()).toMatchObject({
    status: "confirmed-requests", patients: 2, requestedUnits: 14, heldUnits: 0,
    forecast: { pmf: [0, 0, 1], expectedDemand: 2, target: 2 }, collectionProbability: null,
  });
  const stock = () => fixture.db.raw.prepare("SELECT SUM(qty_units) AS onHand,SUM(reserved_units) AS held FROM inventory_batches").get();
  expect(stock()).toEqual({ onHand: 8, held: 0 });
  const results = await Promise.all(items.map(item => write(`${r06Refills}/${item.id}/hold`, { confirmed: true }, cashier)));
  expect(results.map(reply => reply.status).sort()).toEqual([200, 409]);
  expect(stock()).toEqual({ onHand: 8, held: 7 });
  expect(fixture.db.raw.prepare("SELECT SUM(units) AS n FROM refill_hold_lines").get()).toEqual({ n: 7 });
  expect(fixture.db.raw.prepare("SELECT COUNT(*) AS n FROM sales").get()).toEqual({ n: 2 });
  const winningVisit = results[0]!.status === 200 ? first : second;
  expect((await write(`/encounters/${winningVisit.id}/revoke`, {}, doctor)).status).toBe(200);
  expect(stock()).toEqual({ onHand: 8, held: 0 });
  expect(await (await read(hazard, manager)).json()).toMatchObject({ patients: 1, requestedUnits: 7, heldUnits: 0 });
});
