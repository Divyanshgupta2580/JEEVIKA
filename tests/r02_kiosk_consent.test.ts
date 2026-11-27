import { afterEach, beforeEach, expect, it } from "vitest";
import { phase4Fixture } from "./phase4-fixture";
import { kioskGuidance } from "../packages/shared/kiosk-guidance";
import { kioskPrompts } from "../packages/shared/kiosk-copy";
import { consentVersion, demoPatientIdentity, patientLanguages } from "../packages/shared/patient-experience";

const base = {
  locale: "en", ageGroup: "adult", intent: "intake", complaint: "fever",
  answers: { chestPain: "no", breathless: "no", fainting: "no", fever: "no", cough: "no", fatigue: "no", thirst: "no" },
  consent: { care: true, pharmacy: false, remote: false, research: false, guardian: false },
};
let fixture: Awaited<ReturnType<typeof phase4Fixture>>;
beforeEach(async () => { fixture = await phase4Fixture(); });
afterEach(() => fixture.db.close());

function intake(data = base, key = crypto.randomUUID()) {
  return fixture.request("/kiosk/intake", { method: "POST", body: data, idempotencyKey: key });
}

it("persists every adult optional-consent combination and issues distinct clinic tokens", async () => {
  const tokens = new Set<string>();
  for (const [pharmacy, remote, research] of Array.from({ length: 8 }, (_, mask) =>
    [(mask & 1) !== 0, (mask & 2) !== 0, (mask & 4) !== 0] as const)) {
    const consent = { ...base.consent, pharmacy, remote, research };
    const response = await intake({ ...base, consent });
    expect(response.status).toBe(201);
    const receipt = await response.json() as { receiptId: string; token: string };
    expect(receipt).toMatchObject({ triage: "routine", consent, consentVersion });
    const saved = fixture.db.raw.prepare("SELECT consent_json FROM kiosk_intakes WHERE receipt_id=?").get(receipt.receiptId);
    expect(saved).toEqual({ consent_json: JSON.stringify(consent) });
    tokens.add(receipt.token);
  }
  expect(tokens.size).toBe(8);
});

it("requires guardian consent for minors, stores no refused routine visit, and always permits anonymous urgent help", async () => {
  expect((await intake({ ...base, ageGroup: "minor" })).status).toBe(403);
  expect((await intake({ ...base, consent: { ...base.consent, care: false } })).status).toBe(403);
  expect(fixture.db.raw.prepare("SELECT COUNT(*) AS count FROM kiosk_intakes").get()).toEqual({ count: 0 });
  const urgent = await intake({ ...base, ageGroup: "minor", intent: "urgent-help", consent: { ...base.consent, care: false, research: true } });
  expect(urgent.status).toBe(201);
  expect(await urgent.json()).toMatchObject({ triage: "emergency", token: expect.stringMatching(/^EMERG-/), consent: { ...base.consent, care: false } });
  const red = await intake({ ...base, ageGroup: "minor", complaint: "chest", consent: { ...base.consent, care: false } });
  expect(red.status).toBe(201);
  const guardian = await intake({ ...base, ageGroup: "minor", consent: { ...base.consent, guardian: true } });
  expect(guardian.status).toBe(201);
  expect(await guardian.json()).toMatchObject({ consent: { guardian: true } });
});

it("puts the same care-only receipt in the correct clinic queue once through concurrent retries", async () => {
  const key = crypto.randomUUID();
  const responses = await Promise.all([intake(base, key), intake(base, key)]);
  expect(responses.map(x => x.status).sort()).toEqual([200, 201]);
  const [first, second] = await Promise.all(responses.map(x => x.json()));
  expect(first).toEqual(second);
  const doctor = await fixture.login("doctor");
  const queue = await fixture.request("/encounters", { token: doctor.token });
  expect(await queue.json()).toMatchObject({ encounters: [expect.objectContaining({ tokenNumber: (first as { token: string }).token })] });
  const east = await fixture.login("east-doctor");
  expect(await (await fixture.request("/encounters", { token: east.token })).json()).toEqual({ encounters: [] });
  expect((await intake({ ...base, complaint: "cough" }, key)).status).toBe(409);
});

it("denies declined research, preserves consent provenance, and records scoped optional revocations once", async () => {
  const doctor = await fixture.login("doctor");
  const east = await fixture.login("east-doctor");
  const careOnly = await intake();
  const granted = await intake({ ...base, consent: { ...base.consent, research: true, pharmacy: true, remote: true } });
  const receipt1 = await careOnly.json() as { receiptId: string };
  const receipt2 = await granted.json() as { receiptId: string };
  const byReceipt = (receipt: string) => fixture.db.raw.prepare("SELECT encounter_id,consent_json FROM kiosk_intakes WHERE receipt_id=?")
    .get(receipt) as { encounter_id: string; consent_json: string };
  const first = byReceipt(receipt1.receiptId);
  const second = byReceipt(receipt2.receiptId);
  const create = (id:string) => fixture.request("/cbc/reports", {
    token: doctor.token, method: "POST", body: { encounterId: id, processingConsent: true, researchConsent: true },
  });
  expect((await create(first.encounter_id)).status).toBe(403);
  const report = await create(second.encounter_id);
  expect(report.status).toBe(201);
  const result = await report.json() as { id: string };
  const withdraw = (token: string, purpose:string) => fixture.request(`/encounters/${second.encounter_id}/revoke/${purpose}`, { token, method: "POST" });
  expect((await withdraw(east.token, "research")).status).toBe(404);
  expect((await withdraw(doctor.token, "research")).status).toBe(200);
  expect((await withdraw(doctor.token, "research")).status).toBe(200);
  expect((await create(second.encounter_id)).status).toBe(403);
  expect((await fixture.request(`/cbc/reports/${result.id}/predict`, {
    token: doctor.token, method: "POST", body: { revision: 1 },
  })).status).toBe(403);
  expect(await (await fixture.request(`/cbc/reports/${result.id}`, { token: doctor.token })).json()).toMatchObject({ researchConsent: false });
  expect((await withdraw(doctor.token, "pharmacy")).status).toBe(200);
  expect((await withdraw(doctor.token, "remote")).status).toBe(200);
  expect(byReceipt(receipt2.receiptId)).toEqual(second);
  expect(fixture.db.raw.prepare("SELECT COUNT(*) AS count FROM kiosk_consent_withdrawals").get()).toEqual({ count: 3 });
});

it("pairs every supported locale with its translated stages and guidance", () => {
  expect(Object.keys(kioskGuidance)).toEqual(Object.keys(patientLanguages));
  for (const [locale, guide] of Object.entries(kioskGuidance)) {
    expect(guide.every(Boolean)).toBe(true);
    if (locale !== "en") expect(guide[0]).not.toBe(kioskGuidance.en[0]);
  }
  expect(new Set(Object.values(kioskPrompts).map(copy => copy[0])).size).toBe(9);
});

it("hides an existing prescription from pharmacy immediately on scoped withdrawal", async () => {
  const admin = await fixture.login("admin");
  const doctor = await fixture.login("doctor");
  const cashier = await fixture.login("cashier");
  const created = await intake({ ...base, consent: { ...base.consent, pharmacy: true } });
  expect(created.status).toBe(201);
  const receipt = await created.json() as { receiptId: string };
  const encounter = fixture.db.raw.prepare("SELECT encounter_id FROM kiosk_intakes WHERE receipt_id=?").get(receipt.receiptId) as { encounter_id: string };
  const post = (path: string, token: string, body: object, bindings = {}) =>
    fixture.request(path, { token, method: "POST", body, bindings });
  expect((await post("/clinical/pharmacy/catalog", admin.token, {
    id: "r02-test-sku", brand: "Synthetic", salt: "Synthetic", strengthMg: 1,
    form: "tablet", nti: false, scheduleH: false, gstBps: 0,
  }, { PLATFORM_SUPER_ADMINS: "" })).status).toBe(201);
  expect((await post(`/encounters/${encounter.encounter_id}/review`, doctor.token, { note: "Synthetic reviewed note" })).status).toBe(200);
  const draft = {
    encounterId: encounter.encounter_id, note: "Synthetic order", allergies: [],
    allergiesReviewed: true, pharmacyConsentConfirmed: true,
    lines: [{ skuId: "r02-test-sku", units: 1, courseEnd: "2099-12-01", directions: "Synthetic directions", allowEquivalent: false }],
  };
  const signed = await post("/clinical/pharmacy/prescriptions", doctor.token, draft);
  expect(signed.status).toBe(201);
  const { id } = await signed.json() as { id: string };
  const quote = () => fixture.request(`/clinical/pharmacy/inflow/${id}/quote`, { token: cashier.token });
  expect((await quote()).status).toBe(200);
  expect((await post(`/encounters/${encounter.encounter_id}/revoke/pharmacy`, doctor.token, {})).status).toBe(200);
  expect((await quote()).status).toBe(404);
  expect(await (await fixture.request("/clinical/pharmacy/inflow", { token: cashier.token })).json()).toEqual({ prescriptions: [] });
  expect((await post("/clinical/pharmacy/prescriptions", doctor.token, draft)).status).toBe(404);
  expect(fixture.db.raw.prepare("SELECT COUNT(*) AS count FROM signed_prescriptions").get()).toEqual({ count: 1 });
});

it("removes a withdrawn remote-follow-up item while retaining the patient check-in", async () => {
  const doctor = await fixture.login("doctor");
  const nurse = await fixture.login("nurse");
  const post = (path: string, body: object, token?: string) => fixture.request(path, { method: "POST", token, body });
  async function verify(purpose: "home" | "kiosk") {
    const start = await post("/auth/patient/otp/start", { purpose, method: "mobile", identifier: demoPatientIdentity.mobile });
    expect(start.status).toBe(201);
    const { id, demoCode } = await start.json() as { id: string; demoCode: string };
    const result = await post("/auth/patient/otp/verify", { purpose, id, code: demoCode });
    expect(result.status).toBe(200);
    return result.json() as Promise<{ verifiedIdentityId: string; token: string }>;
  }
  const { verifiedIdentityId } = await verify("kiosk");
  const created = await post("/kiosk/intake", { ...base, verifiedIdentityId, consent: { ...base.consent, remote: true } });
  expect(created.status).toBe(201);
  const receipt = await created.json() as { receiptId: string };
  const encounter = fixture.db.raw.prepare("SELECT encounter_id FROM kiosk_intakes WHERE receipt_id=?").get(receipt.receiptId) as { encounter_id: string };
  const bed = await post("/clinical/ipd/locations", { room: "Synthetic ward", label: "R02 bed" }, nurse.token);
  expect(bed.status).toBe(201);
  const { id: locationId } = await bed.json() as { id: string };
  const admission = await post("/clinical/ipd/admissions", {
    locationId, encounterId: encounter.encounter_id, doctorId: "doctor", reason: "Synthetic observation",
  }, nurse.token);
  expect(admission.status).toBe(201);
  const { id: admissionId } = await admission.json() as { id: string };
  expect((await post(`/clinical/ipd/admissions/${admissionId}/discharge`, {}, nurse.token)).status).toBe(200);
  const patient = await verify("home");
  expect((await post("/home/companion/check-in", { recovery: "worse", medication: "taken", distress: false }, patient.token)).status).toBe(201);
  const queuePath = "/clinical/nurse-calls";
  const list = async () => (await fixture.request(queuePath, { token: nurse.token })).json();
  const queued = await list() as { items: Array<{ admissionId: string; day: string }> };
  expect(queued.items[0]?.admissionId).toBe(admissionId);
  expect((await post(`/encounters/${encounter.encounter_id}/revoke/remote`, {}, doctor.token)).status).toBe(200);
  expect(await list()).toEqual({ items: [] });
  expect((await post(`${queuePath}/outcomes`, {
    admissionId, day: queued.items[0]?.day, outcome: "opd-requested",
  }, nurse.token)).status).toBe(409);
  expect(fixture.db.raw.prepare("SELECT COUNT(*) AS count FROM patient_check_ins").get()).toEqual({ count: 1 });
});
