import assert from "node:assert/strict";
import { demoPatientIdentity } from "../packages/shared/patient-experience";
import { demoPassword } from "../backend/local/seed";

export type R06Request = (path: string, options?: { token?: string; method?: string; body?: object }) =>
  Promise<{ status: number; json(): Promise<unknown> }>;

export const r06Sku = {
  id: "synthetic-r06-tablet",
  brand: "Synthetic R06 Tablet",
  salt: "Synthetic R06 salt",
  strengthMg: 20,
  form: "tablet",
  nti: false,
  scheduleH: false,
  gstBps: 500,
};
export const r06Readings = [120, 121, 119, 120, 121, 119, 120, 124, 126, 128, 130, 132, 134, 136];
export const r06Home = "/home/companion";
export const r06Pharmacy = "/clinical/pharmacy";
export const r06Refills = "/clinical/refills";
export const r06NurseCalls = "/clinical/nurse-calls";

export async function r06Post<T>(request: R06Request, path: string, body: object, token?: string, status = 201) {
  const response = await request(path, { token, method: "POST", body });
  assert.equal(response.status, status, path);
  return (await response.json()) as T;
}

export function r06Staff(request: R06Request, handle: string, orgId = "demo") {
  return r06Post<{ token: string }>(request, "/auth/login", {
    orgId, email: `${handle}@demo.test`, password: demoPassword,
  }, undefined, 200);
}

export async function r06Patient(request: R06Request, purpose: "kiosk" | "home") {
  const challenge = await r06Post<{ id: string; demoCode: string }>(request, "/auth/patient/otp/start", {
    method: "mobile", identifier: demoPatientIdentity.mobile, purpose,
  });
  return r06Post<{ token: string; verifiedIdentityId: string }>(request, "/auth/patient/otp/verify", {
    id: challenge.id, code: challenge.demoCode, purpose,
  }, undefined, 200);
}

export async function r06ReviewedVisit(request: R06Request, doctor: string, remote = true) {
  const identity = await r06Patient(request, "kiosk");
  const intake = await r06Post<{ token: string }>(request, "/kiosk/intake", {
    verifiedIdentityId: identity.verifiedIdentityId,
    locale: "en", intent: "intake", complaint: "fever", ageGroup: "adult",
    answers: { chestPain: "no", breathless: "no", fainting: "no", fever: "no", cough: "no", fatigue: "no", thirst: "no" },
    consent: { care: true, pharmacy: true, remote, research: false, guardian: false },
  });
  const queue = await request("/encounters", { token: doctor });
  assert.equal(queue.status, 200);
  const { encounters } = (await queue.json()) as { encounters: { id: string; patientId: string; tokenNumber: string }[] };
  const record = encounters.find(item => item.tokenNumber === intake.token);
  assert.ok(record);
  await r06Post(request, `/encounters/${record.id}/review`, { note: "Synthetic R06 review" }, doctor, 200);
  return record;
}

export async function r06Stock(request: R06Request, admin: string, cashier: string) {
  await r06Post(request, `${r06Pharmacy}/catalog`, r06Sku, admin);
  const order = await r06Post<{ id: string }>(request, "/clinical/procurement/orders", {
    supplierReference: "Synthetic R06 supplier",
    lines: [{ skuId: r06Sku.id, units: 22, costPaise: 101, pricePaise: 245 }],
  }, admin);
  await r06Post(request, `/clinical/procurement/orders/${order.id}/issue`, {}, admin, 200);
  const grn = await request("/clinical/procurement/grn", { token: cashier });
  const { lines } = (await grn.json()) as { lines: { lineId: string; orderId: string }[] };
  const line = lines.find(item => item.orderId === order.id);
  assert.ok(line);
  for (const [batchNo, received, expiry] of [
    ["SYN-R06-A", 5, "2099-11-01"], ["SYN-R06-B", 8, "2099-12-01"], ["SYN-R06-C", 9, "2099-12-31"],
  ] as const) {
    await r06Post(request, "/clinical/procurement/grn", {
      orderId: order.id, lineId: line.lineId, batchNo, expiry, received, damaged: 0, invoice: batchNo,
    }, cashier);
  }
}

export async function r06Dispense(request: R06Request, doctor: string, cashier: string, encounterId: string, units = 7) {
  const draft = {
    encounterId, note: "Synthetic prescription",
    allergiesReviewed: true, pharmacyConsentConfirmed: true, allergies: [],
    lines: [{ skuId: r06Sku.id, units, courseEnd: "2099-10-01", directions: "Synthetic directions", allowEquivalent: false }],
  };
  const { checkedAt, approval } = await r06Post<{ checkedAt: string; approval: string }>(
    request, `${r06Pharmacy}/prescriptions/quote`, draft, doctor, 200,
  );
  const rx = await r06Post<{ id: string }>(request, `${r06Pharmacy}/prescriptions`, { draft, checkedAt, approval }, doctor);
  const sale = await r06Post<{ id: string }>(request, `${r06Pharmacy}/checkout`, {
    prescriptionId: rx.id, expectedTotalPaise: 245 * units, cashReceived: true, taxMode: "intra",
  }, cashier);
  return { rx, sale };
}

export const r06Reading = (systolic?: number) => ({ recovery: "same", medication: "taken", distress: false, systolic });
