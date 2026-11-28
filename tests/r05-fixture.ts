import assert from "node:assert/strict";

export const r05Pharmacy = "/clinical/pharmacy";
export const r05Hq = "/clinical/command/hq";
export type R05Post = (path: string, token: string, payload: object, key?: string) =>
  Promise<{ status: number; json(): Promise<unknown> }>;

export async function signR05Prescription(post: R05Post, doctor: string, skuId: string, units = 7) {
  const intake = await post("/encounters", doctor, {
    patient: { name: "Synthetic R05 patient", birthDate: "1990-01-01", gender: "female", language: "en-IN" },
    chiefComplaint: "Synthetic follow-up",
    answers: { chestPain: "no", breathless: "no", fainting: "no" },
    careConsent: true,
    synthetic: true,
  });
  assert.equal(intake.status, 201, "R05 encounter");
  const { id: encounterId } = (await intake.json()) as { id: string };
  assert.equal((await post(`/encounters/${encounterId}/review`, doctor, { note: "Synthetic clinician review" })).status, 200);
  const draft = {
    encounterId,
    note: "Synthetic prescription",
    allergiesReviewed: true,
    pharmacyConsentConfirmed: true,
    allergies: [],
    lines: [{ skuId, units, courseEnd: "2099-10-01", directions: "Synthetic directions", allowEquivalent: false }],
  };
  const quote = await post(`${r05Pharmacy}/prescriptions/quote`, doctor, draft);
  assert.equal(quote.status, 200, "R05 signed stock quote");
  const { checkedAt, approval } = (await quote.json()) as { checkedAt: string; approval: string };
  const signed = await post(`${r05Pharmacy}/prescriptions`, doctor, { draft, checkedAt, approval });
  assert.equal(signed.status, 201, "R05 clinician signature");
  return ((await signed.json()) as { id: string }).id;
}

export const r05Catalog = {
  id: "synthetic-r05",
  brand: "Synthetic R05 Tablet",
  salt: "Synthetic R05 salt",
  strengthMg: 20,
  form: "tablet",
  nti: false,
  scheduleH: false,
  gstBps: 500,
};
