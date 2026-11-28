import { afterEach, beforeEach, expect, it } from "vitest";
import type { PrescriptionDraft } from "../packages/shared/operations";
import { phase4Fixture } from "./phase4-fixture";

const pharmacy = "/clinical/pharmacy";
const courseEnd = "2099-06-10";
const eligibleExpiry = "2099-07-01";
let fixture: Awaited<ReturnType<typeof phase4Fixture>>;
let doctor: string;
let cashier: string;
let east: string;
let eastCashier: string;
let admin: string;

beforeEach(async () => {
  fixture = await phase4Fixture();
  [doctor, cashier, east, eastCashier, admin] = (await Promise.all(
    ["doctor", "cashier", "east-doctor", "east-cashier", "admin"].map(
      async (user) => (await fixture.login(user)).token,
    ),
  )) as [string, string, string, string, string];
});

afterEach(() => fixture.db.raw.close());

const post = (
  path: string,
  token: string,
  body: object,
  idempotencyKey?: string,
) =>
  fixture.request(path, {
    token,
    method: "POST",
    body,
    idempotencyKey,
    bindings: { PLATFORM_SUPER_ADMINS: "" },
  });
const read = (path: string, token: string) => fixture.request(path, { token });

async function sku(id: string, extra: object = {}) {
  expect(
    (
      await post(`${pharmacy}/catalog`, admin, {
        id,
        brand: id,
        salt: "synthetic salt",
        strengthMg: 20,
        form: "tablet",
        nti: false,
        scheduleH: false,
        gstBps: 500,
        ...extra,
      })
    ).status,
  ).toBe(201);
}

function batch(
  skuId: string,
  id: string,
  units: number,
  pricePaise: number,
  expiry = eligibleExpiry,
) {
  fixture.db.raw
    .prepare(`INSERT INTO inventory_batches(org_id,id,sku_id,clinic_id,batch_no,expiry,qty_units,price_paise,cost_paise)
    VALUES('demo',?,?,'north',?,?,?,?,75)`)
    .run(id, skuId, id, expiry, units, pricePaise);
}

async function encounter(extra: object = {}) {
  const response = await post("/encounters", doctor, {
    patient: {
      name: "Synthetic R03",
      birthDate: "1990-01-01",
      gender: "female",
      language: "en-IN",
    },
    chiefComplaint: "Synthetic follow-up",
    answers: { chestPain: "no", breathless: "no", fainting: "no" },
    careConsent: true,
    synthetic: true,
    ...extra,
  });
  expect(response.status).toBe(201);
  return response.json() as Promise<{ id: string; patientId: string }>;
}

const review = (encounterId: string, body: object = {}) =>
  post(`/encounters/${encounterId}/review`, doctor, {
    note: "Synthetic clinician review",
    ...body,
  });
const order = (
  encounterId: string,
  skuId: string,
  units = 7,
): PrescriptionDraft => ({
  encounterId,
  note: "Synthetic prescription order",
  allergies: [],
  allergiesReviewed: true,
  pharmacyConsentConfirmed: true,
  lines: [
    {
      skuId,
      units,
      courseEnd,
      directions: "Preserve these exact synthetic directions",
      allowEquivalent: false,
    },
  ],
});
const quote = (draft: PrescriptionDraft, token = doctor) =>
  post(`${pharmacy}/prescriptions/quote`, token, draft);
const sign = (
  draft: PrescriptionDraft,
  check: { approval: string; checkedAt: string },
) => post(`${pharmacy}/prescriptions`, doctor, { draft, ...check });
async function approval(draft: PrescriptionDraft) {
  const response = await quote(draft);
  expect(response.status).toBe(200);
  const { checkedAt, approval } = (await response.json()) as {
    checkedAt: string;
    approval: string;
  };
  expect(approval).toMatch(/^[a-f0-9]{64}$/);
  return { checkedAt, approval };
}

it("binds the exact reviewed draft and clinic to a signed handoff and dispenses 5+2 exactly once", async () => {
  await sku("synthetic-original");
  await sku("synthetic-equivalent");
  await sku("synthetic-nti", { nti: true });
  await sku("synthetic-wrong-strength", { strengthMg: 40 });
  batch("synthetic-equivalent", "early", 5, 150);
  batch("synthetic-equivalent", "later", 8, 150, "2099-08-01");
  batch("synthetic-original", "original", 9, 200);
  batch("synthetic-equivalent", "course-invalid", 9, 50, "2099-06-15");
  const { id } = await encounter();
  const draft = order(id, "synthetic-original");
  expect((await quote(draft)).status).toBe(404);
  expect((await review(id)).status).toBe(200);
  expect((await quote(draft, east)).status).toBe(404);
  expect((await quote(draft, cashier)).status).toBe(403);
  expect((await post(`${pharmacy}/prescriptions`, doctor, draft)).status).toBe(
    400,
  );

  for (const substitute of ["synthetic-nti", "synthetic-wrong-strength"]) {
    draft.lines[0]!.approvedSubstituteSkuId = substitute;
    expect((await quote(draft)).status).toBe(400);
  }
  draft.lines[0]!.approvedSubstituteSkuId = "synthetic-equivalent";
  const response = await quote(draft);
  expect(response.status).toBe(200);
  const { checkedAt, approval } = (await response.clone().json()) as {
    checkedAt: string;
    approval: string;
  };
  expect(await response.json()).toMatchObject({
    lines: [
      {
        finalSku: { id: "synthetic-equivalent" },
        units: 7,
        eligibleUnits: 13,
        quotedTotalPaise: 1050,
        originalTotalPaise: 1400,
      },
    ],
  });
  const edited = { ...draft, lines: [{ ...draft.lines[0]!, units: 6 }] };
  expect((await sign(edited, { checkedAt, approval })).status).toBe(409);
  const changedSubstitution = {
    ...draft,
    lines: [{ ...draft.lines[0]!, approvedSubstituteSkuId: undefined }],
  };
  expect(
    (await sign(changedSubstitution, { checkedAt, approval })).status,
  ).toBe(409);

  const signed = await sign(draft, { checkedAt, approval });
  expect(signed.status).toBe(201);
  const { id: prescriptionId } = (await signed.json()) as { id: string };
  expect((await sign(draft, { checkedAt, approval })).status).toBe(409);
  expect(
    await (
      await read(`${pharmacy}/prescriptions/encounter/${id}`, doctor)
    ).json(),
  ).toMatchObject({
    id: prescriptionId,
    lines: [
      {
        brand: "synthetic-equivalent",
        units: 7,
        courseEnd,
        directions: draft.lines[0]!.directions,
      },
    ],
  });
  expect(
    (await read(`${pharmacy}/inflow/${prescriptionId}/quote`, eastCashier))
      .status,
  ).toBe(404);
  const till = await read(
    `${pharmacy}/inflow/${prescriptionId}/quote`,
    cashier,
  );
  expect(await till.json()).toMatchObject({
    complete: true,
    totalPaise: 1050,
    allocation: [
      { batchId: "early", units: 5 },
      { batchId: "later", units: 2 },
    ],
  });
  const payload = {
    prescriptionId,
    expectedTotalPaise: 1050,
    cashReceived: true,
    taxMode: "intra",
  };
  expect((await post(`${pharmacy}/checkout`, doctor, payload)).status).toBe(
    403,
  );
  const key = crypto.randomUUID();
  const sales = await Promise.all([
    post(`${pharmacy}/checkout`, cashier, payload, key),
    post(`${pharmacy}/checkout`, cashier, payload, key),
  ]);
  expect(sales.map(({ status }) => status).sort()).toEqual([200, 201]);
  const receipt = (await sales[0]!.json()) as { id: string };
  expect(await sales[1]!.json()).toEqual(receipt);
  expect(
    (await read(`${pharmacy}/receipts/${receipt.id}`, eastCashier)).status,
  ).toBe(404);
  expect(
    await (await read(`${pharmacy}/receipts/${receipt.id}`, cashier)).json(),
  ).toMatchObject({
    prescriptionId,
    method: "cash",
    totalPaise: 1050,
    amountPaise: 1050,
  });
  expect(
    fixture.db.raw
      .prepare(
        "SELECT SUM(qty_units) AS remaining FROM inventory_batches WHERE id IN ('early','later')",
      )
      .get(),
  ).toEqual({ remaining: 6 });
  expect(
    fixture.db.raw.prepare("SELECT COUNT(*) AS count FROM sales").get(),
  ).toEqual({ count: 1 });
  const nextDoctor = await fixture.login("doctor");
  expect(
    await (await read(`/encounters/${id}`, nextDoctor.token)).json(),
  ).toMatchObject({ prescriptionStatus: "dispensed" });
});

it("requires documented unavailable stock, revalidates checkout and never waives recorded allergy", async () => {
  await sku("synthetic-short");
  batch("synthetic-short", "expired-batch", 50, 150, "2000-01-01");
  batch("synthetic-short", "too-close", 20, 150, "2099-06-15");
  const { id, patientId } = await encounter();
  expect((await review(id)).status).toBe(200);
  const draft = order(id, "synthetic-short");
  expect(await (await quote(draft)).json()).toMatchObject({
    approval: null,
    lines: [
      { units: 7, eligibleUnits: 0, quotedTotalPaise: null, blocked: false },
    ],
  });
  draft.unavailableReason =
    "Synthetic clinical indication recorded despite unavailable stock.";
  const checked = await approval(draft);
  fixture.db.raw
    .prepare(
      "UPDATE patients SET allergies_json=? WHERE org_id='demo' AND id=?",
    )
    .run(JSON.stringify([" Synthetic Salt "]), patientId);
  expect(await (await quote(draft)).json()).toMatchObject({
    approval: null,
    lines: [
      {
        eligibleUnits: 0,
        blocked: true,
        reason: expect.stringMatching(/allergy/i),
      },
    ],
  });
  expect((await sign(draft, checked)).status).toBe(409);
  fixture.db.raw
    .prepare(
      "UPDATE patients SET allergies_json='[]' WHERE org_id='demo' AND id=?",
    )
    .run(patientId);
  const signed = await sign(draft, await approval(draft));
  expect(signed.status).toBe(201);
  const { id: prescriptionId } = (await signed.json()) as { id: string };
  const payload = {
    prescriptionId,
    expectedTotalPaise: 1050,
    cashReceived: true,
    taxMode: "intra",
  };
  expect((await post(`${pharmacy}/checkout`, cashier, payload)).status).toBe(
    409,
  );
  batch("synthetic-short", "eligible-later", 7, 150);
  expect(
    await (
      await read(`${pharmacy}/inflow/${prescriptionId}/quote`, cashier)
    ).json(),
  ).toMatchObject({ complete: true });
  expect(
    (
      await review(id, {
        expectedRevision: 1,
        details: { allergies: ["synthetic-short"] },
      })
    ).status,
  ).toBe(200);
  expect(
    await (
      await read(`${pharmacy}/inflow/${prescriptionId}/quote`, cashier)
    ).json(),
  ).toMatchObject({
    complete: false,
    issues: [{ reason: expect.stringMatching(/allergy/i) }],
  });
  expect((await post(`${pharmacy}/checkout`, cashier, payload)).status).toBe(
    409,
  );
  expect(
    (await review(id, { expectedRevision: 2, details: { allergies: [] } }))
      .status,
  ).toBe(200);
  fixture.db.raw
    .prepare(
      "UPDATE inventory_batches SET qty_units=6 WHERE id='eligible-later'",
    )
    .run();
  expect((await post(`${pharmacy}/checkout`, cashier, payload)).status).toBe(
    409,
  );
  expect(
    fixture.db.raw.prepare("SELECT COUNT(*) AS count FROM sales").get(),
  ).toEqual({ count: 0 });
});

it("restores an incomplete clinician draft after relogin and rejects a stale editor", async () => {
  const { id } = await encounter();
  const path = `${pharmacy}/prescriptions/draft/${id}`;
  expect(await (await read(path, doctor)).json()).toBeNull();
  expect((await read(path, east)).status).toBe(404);
  expect((await read(path, cashier)).status).toBe(403);
  const put = (token: string, body: object) =>
    fixture.request(path, { token, method: "PUT", body });
  const draft = {
    revision: 0,
    plan: [
      {
        drug: "Synthetic draft",
        dosage: "20 mg",
        frequency: "Recorded frequency",
        duration: "",
        availableInClinic: false,
        directions: "Preserve the clinician's complete directions",
      },
    ],
    review: { note: "Incomplete order notes", allergies: "Synthetic allergy" },
  };
  const saved = await put(doctor, draft);
  expect(saved.status).toBe(200);
  const expected = { ...draft, revision: 1 };
  expect(await saved.json()).toEqual(expected);
  const session = await fixture.login("doctor");
  expect(await (await read(path, session.token)).json()).toEqual(expected);
  expect((await put(session.token, draft)).status).toBe(409);
  expect((await post(`/encounters/${id}/revoke`, doctor, {})).status).toBe(200);
  expect((await read(path, session.token)).status).toBe(404);
});

it("writes off authorized stock exactly once and balances the loss against inventory", async () => {
  await sku("synthetic-writeoff");
  batch("synthetic-writeoff", "writeoff-lot", 13, 150);
  const manager = (await fixture.login("clinic-admin")).token;
  const eastManager = (await fixture.login("admin", "other-org")).token;
  const path = `${pharmacy}/inventory/batches/writeoff-lot/writeoffs`;
  const data = {
    units: 5,
    expectedQuantity: 13,
    reason: "Synthetic damaged stock",
  };
  expect((await post(path, cashier, data)).status).toBe(403);
  expect((await post(path, eastManager, data)).status).toBe(404);
  expect((await post(path, manager, { ...data, units: 14 })).status).toBe(409);
  const key = crypto.randomUUID();
  const changes = await Promise.all([
    post(path, manager, data, key),
    post(path, manager, data, key),
  ]);
  expect(changes.map(({ status }) => status).sort()).toEqual([200, 201]);
  const [first, second] = await Promise.all(
    changes.map((change) => change.json()),
  );
  expect(first).toEqual(second);
  expect(first).toMatchObject({ units: 5, remaining: 8, costPaise: 375 });
  expect(
    (await post(path, manager, { ...data, reason: "Changed reason" }, key))
      .status,
  ).toBe(409);
  expect((await post(path, manager, data)).status).toBe(409);
  expect(
    await (
      await read(path, (await fixture.login("clinic-admin")).token)
    ).json(),
  ).toMatchObject({
    entries: [
      {
        batchId: "writeoff-lot",
        actorId: "clinic-admin",
        units: 5,
        reason: data.reason,
      },
    ],
  });
  const quantity = fixture.db.raw.prepare(
    "SELECT qty_units FROM inventory_batches WHERE id='writeoff-lot'",
  );
  expect(quantity.get()).toEqual({ qty_units: 8 });
  expect(
    fixture.db.raw
      .prepare(`SELECT SUM(debit_paise) AS debits,SUM(credit_paise) AS credits
    FROM journal_lines l JOIN journals j ON j.org_id=l.org_id AND j.id=l.journal_id
    WHERE j.ref_type='stock-writeoff' AND j.status='posted'`)
      .get(),
  ).toEqual({ debits: 375, credits: 375 });
  fixture.db.raw
    .prepare(
      "INSERT INTO accounting_settings(org_id,lock_date) VALUES('demo','2099-12-31')",
    )
    .run();
  expect(
    (await post(path, manager, { ...data, expectedQuantity: 8 })).status,
  ).toBe(409);
  expect(quantity.get()).toEqual({ qty_units: 8 });
  expect(
    fixture.db.raw
      .prepare("SELECT COUNT(*) AS count FROM clinical_stock_writeoffs")
      .get(),
  ).toEqual({ count: 1 });
});

it("keeps immutable clinical revisions, rejects stale approval, and prevents two prescriptions overselling stock", async () => {
  await sku("synthetic-shared");
  batch("synthetic-shared", "shared", 7, 150);
  const [first, second] = await Promise.all([encounter(), encounter()]);
  const details = {
    icd11: {
      code: "SYNTHETIC",
      system: "ICD-11 MMS",
      provenance: "clinician-entered",
    },
    guideline: {
      reference: "Synthetic guideline, fixture version",
      provenance: "clinician-entered",
    },
    history: "Synthetic history belonging to the first encounter",
    vitals: { pulse: 78 },
  };
  expect((await review(first.id, { details })).status).toBe(200);
  expect((await review(second.id)).status).toBe(200);
  const firstOrder = order(first.id, "synthetic-shared");
  const stale = await approval(firstOrder);
  expect(
    (
      await review(first.id, {
        expectedRevision: 1,
        note: "Second synthetic clinical review.",
      })
    ).status,
  ).toBe(200);
  expect((await review(first.id, { expectedRevision: 1 })).status).toBe(409);
  expect((await sign(firstOrder, stale)).status).toBe(409);
  expect(
    await (await read(`/encounters/${first.id}`, doctor)).json(),
  ).toMatchObject({
    clinicalReview: { ...details, revision: 2 },
  });
  expect(
    await (await read(`/encounters/${second.id}`, doctor)).json(),
  ).toMatchObject({ clinicalReview: { revision: 1 } });
  expect(() =>
    fixture.db.raw
      .prepare(
        "UPDATE clinical_reviews SET note='changed' WHERE encounter_id=?",
      )
      .run(first.id),
  ).toThrow(/CLINICAL_REVIEW_IMMUTABLE/);
  const ids = [];
  for (const draft of [firstOrder, order(second.id, "synthetic-shared")]) {
    const signed = await sign(draft, await approval(draft));
    expect(signed.status).toBe(201);
    ids.push(((await signed.json()) as { id: string }).id);
  }
  const sold = await Promise.all(
    ids.map((prescriptionId) =>
      post(`${pharmacy}/checkout`, cashier, {
        prescriptionId,
        expectedTotalPaise: 1050,
        cashReceived: true,
        taxMode: "intra",
      }),
    ),
  );
  expect(sold.map(({ status }) => status).sort()).toEqual([201, 409]);
  expect(
    fixture.db.raw
      .prepare(
        "SELECT qty_units, reserved_units FROM inventory_batches WHERE id='shared'",
      )
      .get(),
  ).toEqual({ qty_units: 0, reserved_units: 0 });
});
