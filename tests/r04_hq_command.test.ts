import { afterEach, beforeEach, expect, it } from "vitest";
import type {
  HqFinance,
  HqFleet,
  HqStock,
  HqTransfer,
} from "../packages/shared/hq-command";
import { demoPassword } from "../backend/local/seed";
import { phase4Fixture } from "./phase4-fixture";

const hq = "/clinical/command/hq";
const pharmacy = "/clinical/pharmacy";
let fixture: Awaited<ReturnType<typeof phase4Fixture>>;
let admin: string;
let foreign: string;
let manager: string;
let cashier: string;
let doctor: string;

beforeEach(async () => {
  fixture = await phase4Fixture();
  [admin, foreign, manager, cashier, doctor] = await Promise.all([
    fixture.login("admin"),
    fixture.login("admin", "other-org"),
    fixture.login("clinic-admin"),
    fixture.login("cashier"),
    fixture.login("doctor"),
  ]).then(([a, b, c, d, e]) => [a.token, b.token, c.token, d.token, e.token]);
});
afterEach(() => fixture.db.close());

const request = (
  path: string,
  token: string,
  method = "GET",
  body?: object,
  idempotencyKey?: string,
) =>
  fixture.request(path, {
    token,
    method,
    body,
    idempotencyKey,
    bindings: { PLATFORM_SUPER_ADMINS: "" },
  });

async function seedStock(expiry = "2099-12-31") {
  const response = await request(`${pharmacy}/catalog`, admin, "POST", {
    id: "synthetic-hq-sku",
    brand: "Synthetic HQ Tablet",
    salt: "Synthetic salt",
    strengthMg: 20,
    form: "tablet",
    nti: false,
    scheduleH: false,
    gstBps: 500,
  });
  expect(response.status).toBe(201);
  fixture.db.raw
    .prepare(`INSERT INTO inventory_batches(org_id,id,sku_id,clinic_id,batch_no,expiry,qty_units,price_paise,cost_paise)
    VALUES('demo','north-lot','synthetic-hq-sku','north','SYN-HQ-LOT',?,13,245,101)`)
    .run(expiry);
}

it("registers an organization and atomically provisions a clinic manager who can sign in", async () => {
  expect(await (await request(`${hq}/fleet`, admin)).json()).toMatchObject({
    organization: null,
  });
  const organization = {
    name: "Synthetic Network",
    slug: "synthetic-network",
    adminEmail: "admin@example.test",
    brandingColor: "#087466",
  };
  expect(
    (await request(`${hq}/organization`, manager, "POST", organization)).status,
  ).toBe(403);
  expect(
    (await request(`${hq}/organization`, admin, "POST", organization)).status,
  ).toBe(201);
  expect(
    (await request(`${hq}/organization`, admin, "POST", organization)).status,
  ).toBe(200);
  const branch = {
    name: "Synthetic Satellite",
    code: "SYN-SAT",
    address: "Synthetic address",
    bedCapacity: 0,
    manager: {
      name: "Synthetic Manager",
      email: "satellite@example.test",
      password: demoPassword,
    },
  };
  const key = crypto.randomUUID();
  const results = await Promise.all([
    request(`${hq}/branches`, admin, "POST", branch, key),
    request(`${hq}/branches`, admin, "POST", branch, key),
  ]);
  expect(results.map(({ status }) => status).sort()).toEqual([200, 201]);
  const { id } = (await results[0]!.json()) as { id: string };
  expect(await results[1]!.json()).toEqual({ id });
  expect(
    (
      await request(
        `${hq}/branches`,
        admin,
        "POST",
        { ...branch, name: "Changed branch" },
        key,
      )
    ).status,
  ).toBe(409);
  expect(
    (
      await request(`${hq}/branches`, admin, "POST", {
        ...branch,
        code: "SYN-NEW",
      })
    ).status,
  ).toBe(409);
  const newSession = await fixture.login("admin");
  const fleet = (await (
    await request(`${hq}/fleet`, newSession.token)
  ).json()) as HqFleet;
  expect(fleet.organization).toMatchObject({ id: "demo", ...organization });
  expect(fleet.clinics.filter((clinic) => clinic.name === branch.name)).toEqual(
    [
      expect.objectContaining({
        id,
        managerEmail: branch.manager.email,
        bedCapacity: 0,
        grossPaise: 0,
        status: "active",
      }),
    ],
  );
  expect((await request(`${hq}/branches/${id}`, foreign)).status).toBe(404);
  const login = await fixture.request("/auth/login", {
    method: "POST",
    body: {
      orgId: "demo",
      email: branch.manager.email,
      password: demoPassword,
    },
  });
  expect(await login.json()).toMatchObject({
    principal: { role: "CLINIC_ADMIN", clinicId: id },
  });
  expect(
    (
      await request(`${hq}/branches/${id}/status`, admin, "PATCH", {
        status: "paused",
      })
    ).status,
  ).toBe(200);
  expect(
    await (await request(`${hq}/branches/${id}`, newSession.token)).json(),
  ).toMatchObject({ clinic: { status: "paused" } });
  expect((await request(`${hq}/branches/east`, manager)).status).toBe(404);
});

it("atomically transfers exact unreserved lots, rejects an incompatible destination and records paired movements", async () => {
  await seedStock();
  const body = {
    sourceClinicId: "north",
    destinationClinicId: "east",
    skuId: "synthetic-hq-sku",
    batchId: "north-lot",
    units: 7,
    reason: "Synthetic replenishment",
  };
  const transfer = (data = body, key?: string, token = admin) =>
    request(`${hq}/transfers`, token, "POST", data, key);
  expect((await transfer(body, undefined, cashier)).status).toBe(403);
  expect((await transfer(body, undefined, foreign)).status).toBe(404);
  fixture.db.raw
    .prepare(
      "INSERT INTO clinics(org_id,id,name) VALUES('other-org','private-branch','Other tenant only')",
    )
    .run();
  expect(
    (await transfer({ ...body, destinationClinicId: "private-branch" })).status,
  ).toBe(404);
  expect(
    (await transfer({ ...body, destinationClinicId: "north" })).status,
  ).toBe(400);
  expect((await transfer({ ...body, units: 14 })).status).toBe(409);
  fixture.db.raw
    .prepare(
      "UPDATE inventory_batches SET reserved_units=8 WHERE id='north-lot'",
    )
    .run();
  expect((await transfer()).status).toBe(409);
  fixture.db.raw
    .prepare(
      "UPDATE inventory_batches SET reserved_units=0 WHERE id='north-lot'",
    )
    .run();
  await request(`${hq}/branches/east/status`, admin, "PATCH", {
    status: "paused",
  });
  expect((await transfer()).status).toBe(409);
  await request(`${hq}/branches/east/status`, admin, "PATCH", {
    status: "active",
  });
  fixture.db.raw.exec(`CREATE TRIGGER fixture_reject_east BEFORE INSERT ON inventory_batches WHEN NEW.clinic_id='east'
    BEGIN SELECT RAISE(ABORT,'fixture destination failure'); END;`);
  expect((await transfer()).status).toBe(409);
  expect(
    fixture.db.raw
      .prepare("SELECT qty_units FROM inventory_batches WHERE id='north-lot'")
      .get(),
  ).toEqual({ qty_units: 13 });
  expect(
    fixture.db.raw
      .prepare("SELECT COUNT(*) AS total FROM command_stock_movements")
      .get(),
  ).toEqual({ total: 0 });
  fixture.db.raw.exec("DROP TRIGGER fixture_reject_east");
  fixture.db.raw
    .prepare(`INSERT INTO inventory_batches(org_id,id,sku_id,clinic_id,batch_no,expiry,qty_units,price_paise,cost_paise)
    VALUES('demo','east-conflict','synthetic-hq-sku','east','SYN-HQ-LOT','2098-12-31',2,245,101)`)
    .run();
  expect((await transfer()).status).toBe(409);
  expect(
    fixture.db.raw
      .prepare("SELECT id,qty_units FROM inventory_batches ORDER BY id")
      .all(),
  ).toEqual([
    { id: "east-conflict", qty_units: 2 },
    { id: "north-lot", qty_units: 13 },
  ]);
  fixture.db.raw
    .prepare("DELETE FROM inventory_batches WHERE id='east-conflict'")
    .run();
  const key = crypto.randomUUID();
  const moved = await Promise.all([transfer(body, key), transfer(body, key)]);
  expect(moved.map(({ status }) => status).sort()).toEqual([200, 201]);
  const result = (await moved[0]!.json()) as HqTransfer;
  expect(await moved[1]!.json()).toEqual(result);
  expect(
    (await transfer({ ...body, reason: "Changed replay payload" }, key)).status,
  ).toBe(409);
  const stock = (await (await request(`${hq}/stock`, admin)).json()) as HqStock;
  expect(stock.batches).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ clinicId: "north", quantity: 6 }),
      expect.objectContaining({
        clinicId: "east",
        id: result.destinationBatchId,
        quantity: 7,
        costPaise: 101,
        pricePaise: 245,
        expiry: "2099-12-31",
      }),
    ]),
  );
  expect(
    await (
      await request(`${hq}/transfers`, (await fixture.login("admin")).token)
    ).json(),
  ).toEqual({ transfers: [result] });
  expect(
    fixture.db.raw
      .prepare(
        "SELECT units FROM command_stock_movements WHERE transfer_id=? ORDER BY units",
      )
      .all(result.id),
  ).toEqual([{ units: -7 }, { units: 7 }]);
  const competition = await Promise.all([
    transfer({ ...body, units: 4 }),
    transfer({ ...body, units: 4 }),
  ]);
  expect(competition.map(({ status }) => status).sort()).toEqual([201, 409]);
  expect(
    fixture.db.raw
      .prepare("SELECT qty_units FROM inventory_batches WHERE id='north-lot'")
      .get(),
  ).toEqual({ qty_units: 2 });
  expect(
    fixture.db.raw
      .prepare("SELECT SUM(qty_units) AS total FROM inventory_batches")
      .get(),
  ).toEqual({ total: 13 });
}, 10_000);

it("reconciles exact journal, expense, clinic and payment totals and exposes verified zero", async () => {
  const empty = await request(`${hq}/finance?period=today`, admin);
  expect(empty.status).toBe(200);
  expect(await empty.json()).toMatchObject({
    grossPaise: 0,
    journalCount: 0,
    lockDate: null,
    segments: [],
  });
  await seedStock();
  const intake = await request("/encounters", doctor, "POST", {
    patient: {
      name: "Synthetic Finance Patient",
      birthDate: "1990-01-01",
      gender: "female",
      language: "en-IN",
    },
    chiefComplaint: "Synthetic routine intake",
    answers: { chestPain: "no", breathless: "no", fainting: "no" },
    careConsent: true,
    synthetic: true,
  });
  expect(intake.status).toBe(201);
  const { id: encounterId } = (await intake.json()) as { id: string };
  expect(
    (
      await request(`/encounters/${encounterId}/review`, doctor, "POST", {
        note: "Synthetic clinician review",
      })
    ).status,
  ).toBe(200);
  const draft = {
    encounterId,
    note: "Synthetic finance draft",
    allergiesReviewed: true,
    pharmacyConsentConfirmed: true,
    allergies: [],
    lines: [
      {
        skuId: "synthetic-hq-sku",
        units: 7,
        courseEnd: "2099-11-30",
        directions: "Synthetic directions",
        allowEquivalent: false,
      },
    ],
  };
  const quote = await request(
    `${pharmacy}/prescriptions/quote`,
    doctor,
    "POST",
    draft,
  );
  expect(quote.status).toBe(200);
  const { checkedAt, approval } = (await quote.json()) as {
    checkedAt: string;
    approval: string;
  };
  const signature = await request(`${pharmacy}/prescriptions`, doctor, "POST", {
    draft,
    checkedAt,
    approval,
  });
  expect(signature.status).toBe(201);
  const { id: prescriptionId } = (await signature.json()) as { id: string };
  expect(
    (
      await request(`${pharmacy}/checkout`, cashier, "POST", {
        prescriptionId,
        expectedTotalPaise: 1715,
        cashReceived: true,
        taxMode: "intra",
      })
    ).status,
  ).toBe(201);
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
  }).format(new Date());
  for (const [clinicId, amount] of [
    ["north", 200],
    [null, 120],
  ] as const) {
    expect(
      (
        await request("/clinical/command/expenses", admin, "POST", {
          clinic_id: clinicId,
          category: "Synthetic rent",
          amount_paise: amount,
          tax_bps: 500,
          description: "",
          expense_type: "ONE_TIME",
          expense_date: day,
        })
      ).status,
    ).toBe(201);
  }
  const finance = (await (
    await request(`${hq}/finance?period=today&group=payment_mode`, admin)
  ).json()) as HqFinance;
  expect(finance).toMatchObject({
    grossPaise: 1715,
    revenuePaise: 1633,
    cogsPaise: 707,
    operatingExpensesPaise: 320,
    operatingProfitPaise: 606,
    debitPaise: 2422,
    creditPaise: 2422,
    centralExpensesPaise: 120,
    journalCount: 1,
    unreconciledSales: 0,
    selectedGrossPaise: 1715,
    segments: [{ name: "cash", paise: 1715 }],
  });
  expect(
    finance.branches.find((branch) => branch.clinicId === "north"),
  ).toMatchObject({ profitPaise: 726, saleCount: 1 });
  expect(
    await (await request(`${hq}/finance?clinic=east`, admin)).json(),
  ).toMatchObject({ grossPaise: 0, selectedGrossPaise: 0 });
  expect(
    await (await request(`${hq}/finance?payment=upi`, admin)).json(),
  ).toMatchObject({ selectedGrossPaise: 0, segments: [] });
  expect(
    await (
      await request(`${hq}/finance?service=CONSULTATION&group=sale_type`, admin)
    ).json(),
  ).toMatchObject({ selectedGrossPaise: 0 });
  expect((await request(`${hq}/finance?clinic=east`, manager)).status).toBe(
    404,
  );
  expect((await request(`${hq}/finance`, cashier)).status).toBe(403);
});
