import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { tenantDb } from "../backend/src/database";
import { demoPatientIdentity } from "../packages/shared/patient-experience";
import { phase4Fixture } from "./phase4-fixture";

let fixture: Awaited<ReturnType<typeof phase4Fixture>>;
let doctor: string;
let nurse: string;
let cashier: string;
let foreignCashier: string;
let eastDoctor: string;
let superAdmin: string;
let clinicAdmin: string;
let statNurse: string;
let eastCashier: string;
const adminBindings = { PLATFORM_SUPER_ADMINS: "" };
const answers = {
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
  [
    doctor,
    nurse,
    cashier,
    foreignCashier,
    eastDoctor,
    superAdmin,
    clinicAdmin,
    statNurse,
    eastCashier,
  ] = await Promise.all([
    fixture.login("doctor"),
    fixture.login("nurse"),
    fixture.login("cashier"),
    fixture.login("cashier", "other-org"),
    fixture.login("east-doctor"),
    fixture.login("admin"),
    fixture.login("clinic-admin"),
    fixture.login("stat-nurse"),
    fixture.login("east-cashier"),
  ]).then((users) => users.map(({ token }) => token));
  await tenantDb({ db: fixture.db, orgId: "demo" })
    .statement(
      `INSERT INTO sku(org_id,id,brand,salt,strength_mg,form,nti,schedule_h,gst_bps)
      VALUES(:org,'synthetic-med','Synthetic tablet','Synthetic salt',10,'tablet',0,0,500)`,
    )
    .run();
});

afterAll(() => fixture?.db.close());

function post(
  path: string,
  token: string,
  body?: unknown,
  idempotencyKey?: string,
) {
  return fixture.request(path, { token, body, idempotencyKey, method: "POST" });
}

async function verifiedPatient(purpose: "home" | "kiosk") {
  const challenge = await post("/auth/patient/otp/start", "", {
    purpose,
    method: "mobile",
    identifier: demoPatientIdentity.mobile,
  });
  expect(challenge.status).toBe(201);
  const { id, demoCode } = (await challenge.json()) as {
    id: string;
    demoCode: string;
  };
  const verified = await post("/auth/patient/otp/verify", "", {
    purpose,
    id,
    code: demoCode,
  });
  expect(verified.status).toBe(200);
  return (await verified.json()) as {
    verifiedIdentityId: string;
    token: string;
  };
}

async function encounter(
  kind: "routine" | "emergency",
  pharmacy = true,
  remote = false,
) {
  const { verifiedIdentityId } = await verifiedPatient("kiosk");
  const intake = await post("/kiosk/intake", "", {
    verifiedIdentityId,
    locale: "en",
    intent: "intake",
    complaint: "fever",
    answers: { ...answers, chestPain: kind === "emergency" ? "yes" : "no" },
    consent: { care: true, pharmacy, remote, research: false, guardian: false },
  });
  expect(intake.status).toBe(201);
  const { token } = (await intake.json()) as { token: string };
  const response = await fixture.request("/encounters", { token: doctor });
  expect(response.status).toBe(200);
  const { encounters } = (await response.json()) as {
    encounters: Array<{ id: string; tokenNumber?: string }>;
  };
  const id = encounters.find((item) => item.tokenNumber === token)?.id;
  expect(id).toBeDefined();
  return id ?? "";
}

async function createLocation(kind: "ipd" | "casualty", label: string) {
  const result = await post(`/clinical/${kind}/locations`, nurse, {
    room: "Synthetic Room",
    label,
  });
  expect(result.status).toBe(201);
  return ((await result.json()) as { id: string }).id;
}

describe("scoped clinical handoffs", () => {
  it("assigns a ward bed, emits one Code Blue, and records only the attending acknowledgement", async () => {
    const encounterId = await encounter("routine", true, true);
    const locationId = await createLocation("ipd", "Ward Bed 1");
    const admission = {
      locationId,
      encounterId,
      doctorId: "doctor",
      reason: "Synthetic observation",
    };
    const admit = () => post("/clinical/ipd/admissions", nurse, admission);
    expect(
      (await post("/clinical/ipd/admissions", cashier, admission)).status,
    ).toBe(403);
    expect(
      (await post("/clinical/ipd/admissions", eastDoctor, admission)).status,
    ).toBe(404);
    const admitted = await admit();
    expect(admitted.status).toBe(201);
    const { id: admissionId } = (await admitted.json()) as { id: string };
    expect((await admit()).status).toBe(409);
    const alarm = () =>
      post(`/clinical/ipd/beds/${locationId}/distress`, nurse, {
        reason: "Synthetic alarm",
      });
    const alerts = await Promise.all([alarm(), alarm()]);
    expect(alerts.map(({ status }) => status).sort()).toEqual([200, 201]);
    const [first, second] = await Promise.all(
      alerts.map((response) => response.json()),
    );
    expect(first).toEqual(second);
    const eventId = (first as { id: string }).id;
    const list = (token: string, bindings = {}) =>
      fixture.request("/clinical/ipd/distress/active", { token, bindings });
    expect((await list(cashier)).status).toBe(403);
    expect((await list(superAdmin)).status).toBe(403);
    expect(await (await list(eastDoctor)).json()).toEqual({ events: [] });
    expect(await (await list(superAdmin, adminBindings)).json()).toMatchObject({
      events: [
        {
          id: eventId,
          attending: 0,
          patientName: null,
          diagnosis: null,
          reason: null,
        },
      ],
    });
    expect(await (await list(clinicAdmin)).json()).toMatchObject({
      events: [
        {
          id: eventId,
          attending: 0,
          patientName: null,
          diagnosis: null,
          reason: null,
        },
      ],
    });
    expect(
      (await fixture.request("/clinical/ipd/board", { token: statNurse }))
        .status,
    ).toBe(403);
    expect(await (await list(doctor)).json()).toMatchObject({
      events: [{ id: eventId, attending: 1, acknowledgedAt: null }],
    });
    const acknowledgement = `/clinical/ipd/distress/${eventId}/acknowledge`;
    expect((await post(acknowledgement, eastDoctor)).status).toBe(404);
    expect((await post(acknowledgement, nurse)).status).toBe(403);
    const acknowledged = await (await post(acknowledgement, doctor)).json();
    expect(acknowledged).toMatchObject({
      acknowledgedAt: expect.any(String),
      latencyMs: expect.any(Number),
    });
    expect(await (await post(acknowledgement, doctor)).json()).toEqual(
      acknowledged,
    );
    const discharge = `/clinical/ipd/admissions/${admissionId}/discharge`;
    expect((await post(discharge, nurse)).status).toBe(409);
    expect(
      (await post(`/clinical/ipd/distress/${eventId}/resolve`, nurse)).status,
    ).toBe(200);
    expect(await (await list(doctor)).json()).toEqual({ events: [] });
    expect((await post(discharge, nurse)).status).toBe(200);
    expect(
      await (
        await fixture.request("/clinical/ipd/board", { token: nurse })
      ).json(),
    ).toMatchObject({
      locations: [{ id: locationId, occupied: 0, state: "cleaning" }],
    });

    const patient = await verifiedPatient("home");
    const checkIn = await post("/home/companion/check-in", patient.token, {
      recovery: "worse",
      medication: "taken",
      distress: false,
    });
    expect(checkIn.status).toBe(201);
    const queuePath = "/clinical/nurse-calls";
    expect((await fixture.request(queuePath, { token: doctor })).status).toBe(
      403,
    );
    const queue = (await (
      await fixture.request(queuePath, { token: nurse })
    ).json()) as {
      items: Array<{ admissionId: string; day: string; priority: string }>;
    };
    expect(queue.items).toHaveLength(1);
    expect(queue.items[0]).toMatchObject({ admissionId, priority: "review" });
    const outcome = {
      admissionId,
      day: queue.items[0]?.day,
      outcome: "opd-requested",
    };
    const record = () => post(`${queuePath}/outcomes`, nurse, outcome);
    expect((await record()).status).toBe(201);
    expect((await record()).status).toBe(409);
    expect(
      await (await fixture.request(queuePath, { token: nurse })).json(),
    ).toEqual({ items: [] });
    expect(
      await (await fixture.request("/encounters", { token: doctor })).json(),
    ).toMatchObject({
      encounters: [
        expect.objectContaining({
          id: encounterId,
          outreachReviewRequested: true,
        }),
      ],
    });
    expect(
      await (
        await fixture.request("/encounters", { token: eastDoctor })
      ).json(),
    ).toEqual({ encounters: [] });
  });

  it("reserves emergency bays for emergency encounters through the authorized triage role", async () => {
    const [emergency, routine, locationId] = [
      await encounter("emergency"),
      await encounter("routine"),
      await createLocation("casualty", "Bay 1"),
    ];
    const admit = (token: string, encounterId: string) =>
      post("/clinical/casualty/admissions", token, {
        encounterId,
        locationId,
        doctorId: "doctor",
        reason: "Synthetic emergency",
      });
    expect((await admit(doctor, emergency)).status).toBe(403);
    expect((await admit(nurse, routine)).status).toBe(404);
    expect((await admit(statNurse, emergency)).status).toBe(201);
    expect(
      await (
        await fixture.request("/clinical/casualty/board", { token: eastDoctor })
      ).json(),
    ).toMatchObject({
      locations: [],
      admissions: [],
    });
  });
});

it("posts received stock, dispenses one signed prescription, and balances the ledger once", async () => {
  const procurement = "/clinical/procurement";
  const pharmacy = "/clinical/pharmacy";
  const order = {
    supplierReference: "Synthetic supplier",
    lines: [
      { skuId: "synthetic-med", units: 20, costPaise: 101, pricePaise: 245 },
    ],
  };
  expect((await post(`${procurement}/orders`, cashier, order)).status).toBe(
    403,
  );
  expect((await post(`${procurement}/orders`, superAdmin, order)).status).toBe(
    403,
  );
  const orderKey = crypto.randomUUID();
  const writeOrder = () =>
    fixture.request(`${procurement}/orders`, {
      token: superAdmin,
      bindings: adminBindings,
      method: "POST",
      body: order,
      idempotencyKey: orderKey,
    });
  const draft = await writeOrder();
  expect(draft.status).toBe(201);
  const { id: orderId } = (await draft.json()) as { id: string };
  const replayedOrder = await writeOrder();
  expect(replayedOrder.status).toBe(200);
  expect(await replayedOrder.json()).toEqual({ id: orderId });
  expect(
    (
      await fixture.request(`${procurement}/orders/${orderId}/issue`, {
        token: superAdmin,
        bindings: adminBindings,
        method: "POST",
      })
    ).status,
  ).toBe(200);
  const pending = (await (
    await fixture.request(`${procurement}/grn`, { token: cashier })
  ).json()) as { lines: Array<{ lineId: string; orderId: string }> };
  expect(pending.lines).toHaveLength(1);
  const grn = {
    orderId,
    lineId: pending.lines[0]?.lineId,
    batchNo: "SYN-6",
    expiry: "2099-12-31",
    received: 20,
    damaged: 2,
    invoice: "SYN-INV-6",
  };
  for (const other of [foreignCashier, eastCashier]) {
    expect((await post(`${procurement}/grn`, other, grn)).status).toBe(404);
  }
  const receiptKey = crypto.randomUUID();
  const receive = () => post(`${procurement}/grn`, cashier, grn, receiptKey);
  const receipts = await Promise.all([receive(), receive()]);
  expect(receipts.map(({ status }) => status).sort()).toEqual([200, 201]);
  expect(await receipts[0]?.json()).toMatchObject({ accepted: 18 });

  const patientEncounter = await encounter("routine");
  const deniedEncounter = await encounter("routine", false);
  for (const id of [patientEncounter, deniedEncounter]) {
    expect(
      (
        await post(`/encounters/${id}/review`, doctor, {
          note: "Synthetic reviewed SOAP",
        })
      ).status,
    ).toBe(200);
  }
  const sign = (token: string, encounterId: string) =>
    post(`${pharmacy}/prescriptions`, token, {
      encounterId,
      note: "Synthetic prescription",
      allergies: [],
      allergiesReviewed: true,
      pharmacyConsentConfirmed: true,
      lines: [
        {
          skuId: "synthetic-med",
          units: 3,
          courseEnd: "2099-10-01",
          directions: "Synthetic directions",
          allowEquivalent: false,
        },
      ],
    });
  expect((await sign(doctor, deniedEncounter)).status).toBe(404);
  expect((await sign(eastDoctor, patientEncounter)).status).toBe(404);
  expect((await sign(cashier, patientEncounter)).status).toBe(403);
  const signed = await sign(doctor, patientEncounter);
  expect(signed.status).toBe(201);
  const { id: prescriptionId } = (await signed.json()) as { id: string };
  const quote = `${pharmacy}/inflow/${prescriptionId}/quote`;
  expect((await fixture.request(quote, { token: doctor })).status).toBe(403);
  expect((await fixture.request(quote, { token: foreignCashier })).status).toBe(
    404,
  );
  expect((await fixture.request(quote, { token: eastCashier })).status).toBe(
    404,
  );
  expect(
    await (await fixture.request(quote, { token: cashier })).json(),
  ).toMatchObject({ complete: true, totalPaise: 735 });
  const key = crypto.randomUUID();
  const sale = {
    prescriptionId,
    expectedTotalPaise: 735,
    cashReceived: true,
    taxMode: "intra",
  };
  expect(
    (
      await post(`${pharmacy}/checkout`, cashier, {
        ...sale,
        expectedTotalPaise: 1,
      })
    ).status,
  ).toBe(409);
  const checkout = () => post(`${pharmacy}/checkout`, cashier, sale, key);
  const sales = await Promise.all([checkout(), checkout()]);
  expect(sales.map(({ status }) => status).sort()).toEqual([200, 201]);
  expect(await sales[0]?.json()).toMatchObject({ totalPaise: 735 });
  expect((await post(`${pharmacy}/checkout`, cashier, sale)).status).toBe(404);
  expect(
    await (
      await fixture.request(`${pharmacy}/inventory`, { token: cashier })
    ).json(),
  ).toMatchObject({
    batches: [{ batchNo: "SYN-6", quantity: 15, reserved: 0 }],
  });
  const owner = await verifiedPatient("home");
  expect(
    await (
      await fixture.request("/home/companion/prescriptions", {
        token: owner.token,
      })
    ).json(),
  ).toMatchObject({
    prescriptions: [
      {
        id: prescriptionId,
        medicine: "Synthetic tablet",
        units: 3,
        dispensed: 1,
      },
    ],
  });
  expect(
    (await fixture.request("/clinical/ledger", { token: cashier })).status,
  ).toBe(403);
  const { entries } = (await (
    await fixture.request("/clinical/ledger", { token: superAdmin })
  ).json()) as {
    entries: Array<{
      referenceType: string;
      debitPaise: number;
      creditPaise: number;
    }>;
  };
  expect(entries).toHaveLength(2);
  expect(entries).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        referenceType: "grn",
        debitPaise: 1818,
        creditPaise: 1818,
      }),
      expect.objectContaining({
        referenceType: "sale",
        debitPaise: 1038,
        creditPaise: 1038,
      }),
    ]),
  );
  const lock = {
    lockDate: new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
    }).format(new Date()),
  };
  expect(
    (
      await fixture.request("/clinical/ledger/lock", {
        token: superAdmin,
        bindings: adminBindings,
        method: "POST",
        body: lock,
      })
    ).status,
  ).toBe(403);
  expect((await post("/clinical/ledger/lock", superAdmin, lock)).status).toBe(
    200,
  );
  expect(
    (
      await post(`${procurement}/grn`, cashier, {
        ...grn,
        received: 2,
        damaged: 0,
      })
    ).status,
  ).toBe(409);
  const afterLock = await (
    await fixture.request(`${pharmacy}/inventory`, { token: cashier })
  ).json();
  expect(afterLock).toMatchObject({
    batches: [{ batchNo: "SYN-6", quantity: 15, reserved: 0 }],
  });
});
