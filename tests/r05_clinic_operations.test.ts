import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ClinicalReceipt } from "../packages/shared/clinical-receipt";
import type { HqFinance, HqStock } from "../packages/shared/hq-command";
import { clinicalDay } from "../backend/src/modules/dispensing/prescription-review";
import {
  clinicPostedStock, clinicRevenueDays, clinicRevenueTrend,
} from "../frontend/website/src/features/clinic-operations/telemetry";
import { phase4Fixture } from "./phase4-fixture";
import { r05Catalog, r05Hq as hq, r05Pharmacy as pharmacy, signR05Prescription } from "./r05-fixture";

let fixture: Awaited<ReturnType<typeof phase4Fixture>>;
beforeEach(async () => { fixture = await phase4Fixture(); });
afterEach(() => {
  vi.useRealTimers();
  fixture.db.close();
});

const bindings = { PLATFORM_SUPER_ADMINS: "" };
const token = async (user: string, org?: string) => (await fixture.login(user, org)).token;
const read = (path: string, token: string) => fixture.request(path, { token, bindings });
const post = (path: string, token: string, body: object, idempotencyKey?: string) =>
  fixture.request(path, { token, method: "POST", body, idempotencyKey, bindings });
const finance = async (staff: string, query = "period=today") => {
  const reply = await read(`${hq}/finance?${query}`, staff);
  expect(reply.status).toBe(200);
  return (await reply.json()) as HqFinance;
};

function addBatch(id: string, quantity: number, expiry: string, options: { clinic?: string; reserved?: number; sku?: string } = {}) {
  fixture.db.raw.prepare(`INSERT INTO inventory_batches
    (org_id,id,sku_id,clinic_id,batch_no,expiry,qty_units,reserved_units,price_paise,cost_paise)
    VALUES('demo',?,?,?,?,?,?,?,245,101)`)
    .run(id, options.sku ?? r05Catalog.id, options.clinic ?? "north", id, expiry, quantity, options.reserved ?? 0);
}

const checkout = (cashier: string, prescriptionId: string, units = 7, key?: string) =>
  post(`${pharmacy}/checkout`, cashier, { prescriptionId, expectedTotalPaise: units * 245, cashReceived: true, taxMode: "intra" }, key);

it("reconciles the same two-batch cash sale for fresh cashier, manager and HQ with one atomic dispense", async () => {
  const [admin, doctor, cashier] = await Promise.all([token("admin"), token("doctor"), token("cashier")]);
  expect((await post(`${pharmacy}/catalog`, admin, r05Catalog)).status).toBe(201);
  addBatch("SYN-R05-FIRST", 5, "2099-11-01");
  addBatch("SYN-R05-SECOND", 8, "2099-12-31");
  const rx = await signR05Prescription(post, doctor, r05Catalog.id);
  const key = crypto.randomUUID();
  const checkouts = await Promise.all([checkout(cashier, rx, 7, key), checkout(cashier, rx, 7, key)]);
  expect(checkouts.map(reply => reply.status).sort()).toEqual([200, 201]);
  const sale = (await checkouts[0]!.json()) as { id: string; totalPaise: number };
  expect(await checkouts[1]!.json()).toEqual(sale);
  expect((await checkout(cashier, rx)).status).toBe(404);
  const [freshCashier, manager, freshHq, east, foreign] = await Promise.all([
    token("cashier"), token("clinic-admin"), token("admin"), token("east-cashier"), token("admin", "other-org"),
  ]);
  const day = clinicalDay();
  const posReceipt = `${pharmacy}/receipts/${sale.id}`;
  const branchReceipt = `${hq}/finance/branches/north/receipts/${sale.id}`;
  const fromPos = await read(`${posReceipt}?day=${day}`, freshCashier);
  expect(fromPos.status).toBe(200);
  const { method, amountPaise, ...receipt } = (await fromPos.json()) as ClinicalReceipt & { method: string; amountPaise: number };
  expect([method, amountPaise]).toEqual(["cash", 1715]);
  expect(receipt).toMatchObject({
    id: sale.id, businessDay: day, clinicId: "north", totalPaise: 1715, netPaise: 1634, taxPaise: 81,
    cgstPaise: 41, sgstPaise: 40, igstPaise: 0,
    payments: [{ method: "cash", amountPaise: 1715 }],
    lines: [
      { batchNo: "SYN-R05-FIRST", units: 5, unitPricePaise: 245, totalPaise: 1225 },
      { batchNo: "SYN-R05-SECOND", units: 2, unitPricePaise: 245, totalPaise: 490 },
    ],
  });
  expect(receipt).not.toHaveProperty("patientName");
  for (const staff of [manager, freshHq]) {
    const reply = await read(`${branchReceipt}?day=${day}`, staff);
    expect(reply.status).toBe(200);
    expect(await reply.json()).toEqual({ ...receipt, grossPaise: 1715 });
    const report = await finance(staff, "clinic=north&period=today");
    expect(report).toMatchObject({
      grossPaise: 1715, revenuePaise: 1634, cogsPaise: 707, operatingProfitPaise: 927,
      debitPaise: 2422, creditPaise: 2422, saleCount: 1, selectedSaleCount: 1, unreconciledSales: 0,
      paymentSummary: [{ method: "cash", amountPaise: 1715, saleCount: 1 }],
      sales: [{ id: sale.id, businessDay: day, taxPaise: 81 }],
    });
  }

  expect((await read(`${posReceipt}?day=2000-01-01`, freshCashier)).status).toBe(404);
  expect((await read(`${branchReceipt}?day=2000-01-01`, manager)).status).toBe(404);
  expect((await read(`${posReceipt}?day=invalid`, freshCashier)).status).toBe(400);
  expect((await read(posReceipt, east)).status).toBe(404);
  expect((await read(branchReceipt, foreign)).status).toBe(404);
  expect((await read(branchReceipt, freshCashier)).status).toBe(403);
  expect((await read(`${hq}/finance?clinic=east`, manager)).status).toBe(404);
  expect((await read(`${hq}/finance`, freshCashier)).status).toBe(403);
  expect(await finance(manager, `period=week&payment=cash&service=PHARMACY&receipt=${sale.id.slice(0, 8).toUpperCase()}`)).toMatchObject({
    selectedGrossPaise: 1715, selectedSaleCount: 1, sales: [{ id: sale.id }],
  });
  for (const filter of ["payment=upi", "service=CONSULTATION", "receipt=missing"]) {
    expect(await finance(manager, `period=week&${filter}`)).toMatchObject({
      grossPaise: 1715, selectedGrossPaise: 0, selectedSaleCount: 0, sales: [],
    });
  }
  expect(fixture.db.raw.prepare("SELECT qty_units FROM inventory_batches WHERE org_id='demo' ORDER BY expiry").all())
    .toEqual([{ qty_units: 0 }, { qty_units: 6 }]);
});

it("plots persisted IST ledger dates over 7 and 30 days and handles zero and missing baselines", async () => {
  const [admin, doctor, cashier] = await Promise.all([token("admin"), token("doctor"), token("cashier")]);
  expect((await post(`${pharmacy}/catalog`, admin, r05Catalog)).status).toBe(201);
  addBatch("SYN-R05-HISTORY", 9, "2099-12-31");
  const start = Date.now();
  vi.useFakeTimers({ toFake: ["Date"] });
  const sales = [];
  for (const [offset, units] of [[0, 1], [18, 2], [21, 3]] as const) {
    vi.setSystemTime(start + offset * 86_400_000);
    const activeDoctor = offset ? await token("doctor") : doctor;
    const activeCashier = offset ? await token("cashier") : cashier;
    const rx = await signR05Prescription(post, activeDoctor, r05Catalog.id, units);
    const reply = await checkout(activeCashier, rx, units);
    expect(reply.status).toBe(201);
    sales.push({ date: clinicalDay(), grossPaise: units * 245, saleCount: 1 });
  }
  const manager = await token("clinic-admin");
  const [week, month] = await Promise.all([finance(manager, "period=week"), finance(manager, "period=month")]);
  expect(week.daily).toEqual(sales.slice(1));
  expect(month.daily).toEqual(sales);
  for (const [report, duration, amount, count] of [[week, 7, 1225, 2], [month, 30, 1470, 3]] as const) {
    const series = clinicRevenueDays(report, duration);
    expect(series).toHaveLength(duration);
    expect(series.reduce((total, day) => total + day.grossPaise, 0)).toBe(amount);
    expect(series.reduce((total, day) => total + day.visits, 0)).toBe(count);
    expect(report.paymentSummary).toEqual([{ method: "cash", amountPaise: amount, saleCount: count }]);
    expect(series.at(-1)?.grossPaise).toBe(735);
  }
  expect(clinicRevenueTrend(735, [{ grossPaise: 0 }, { grossPaise: 735 }]))
    .toEqual({ percent: "No prior revenue baseline", positive: false, hasBaseline: false });
  expect(clinicRevenueTrend(undefined, [])).toMatchObject({ percent: "Baseline unavailable" });
  expect(clinicRevenueTrend(200, [{ grossPaise: 100 }, { grossPaise: 200 }])).toMatchObject({ percent: "+100.0%" });
});

it("distinguishes configured shortage and FEFO expiry from empty branches and missing attendance events", async () => {
  const [admin, manager, cashier] = await Promise.all([token("admin"), token("clinic-admin"), token("cashier")]);
  expect((await post(`${pharmacy}/catalog`, admin, r05Catalog)).status).toBe(201);
  const relative = (offset: number) => {
    const date = new Date(`${clinicalDay()}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + offset);
    return date.toISOString().slice(0, 10);
  };
  expect(await (await read(`${hq}/stock?clinic=east`, admin)).json()).toMatchObject({ items: [], batches: [] });
  addBatch("expired", 40, relative(-1));
  addBatch("today", 3, relative(0), { reserved: 1 });
  addBatch("day-30", 2, relative(30), { reserved: 2 });
  addBatch("day-31", 2, relative(31));
  addBatch("foreign-clinic", 50, relative(2), { clinic: "east" });
  const response = await read(`${hq}/stock`, manager);
  expect(response.status).toBe(200);
  const stock = await response.json() as HqStock;
  expect(stock.batches.map(batch => batch.id)).toEqual(["expired", "today", "day-30", "day-31"]);
  const dashboard = clinicPostedStock(stock);
  expect(dashboard.skuCount).toBe(1);
  expect(dashboard.criticalStock).toMatchObject([{ eligibleUnits: 4, threshold: 10 }]);
  expect(dashboard.nearExpiryBatches.map(batch => [batch.batchNo, batch.daysRemaining])).toEqual([
    ["expired", -1], ["today", 0], ["day-30", 30],
  ]);
  expect(clinicPostedStock().skuCount).toBe(0);
  expect((await read(`${hq}/stock?clinic=east`, manager)).status).toBe(404);
  expect((await read(`${hq}/stock?clinic=north`, cashier)).status).toBe(403);

  const roster = "/clinical/command/roster/north";
  const shift = await post(`${roster}/shifts`, manager, {
    name: "Synthetic shift", start_time: "00:00", end_time: "23:59", grace_minutes: 0, late_cutoff_minutes: 0,
  });
  expect(shift.status).toBe(201);
  const { id } = await shift.json() as { id: string };
  const assigned = await fixture.request(`${roster}/staff/doctor/shift`, {
    token: manager, method: "PUT", body: { shiftId: id }, bindings,
  });
  expect(assigned.status).toBe(200);
  expect(await (await read(`${hq}/branches/north/duty`, manager)).json()).toEqual({
    status: "unavailable", onDuty: null, reason: "attendance-events-unconfigured",
  });
  expect((await read(`${hq}/branches/east/duty`, manager)).status).toBe(404);
  expect((await read(`${hq}/branches/north/duty`, cashier)).status).toBe(403);
});

it("keeps the closed ledger and on-hand inventory unchanged on a refused checkout", async () => {
  const [admin, cashier, doctor, manager] = await Promise.all([
    token("admin"), token("cashier"), token("doctor"), token("clinic-admin"),
  ]);
  expect((await post(`${pharmacy}/catalog`, admin, r05Catalog)).status).toBe(201);
  addBatch("lock-lot", 13, "2099-12-31");
  const rx = await signR05Prescription(post, doctor, r05Catalog.id);
  fixture.db.raw.prepare("INSERT INTO accounting_settings(org_id,lock_date) VALUES('demo',?)").run(clinicalDay());
  expect((await checkout(cashier, rx)).status).toBe(409);
  expect(await finance(manager)).toMatchObject({
    grossPaise: 0, saleCount: 0, paymentSummary: [], journalCount: 0, unreconciledSales: 0,
  });
  expect(fixture.db.raw.prepare("SELECT qty_units,reserved_units FROM inventory_batches WHERE id='lock-lot'").get())
    .toEqual({ qty_units: 13, reserved_units: 0 });
});
