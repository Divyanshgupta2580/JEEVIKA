import { afterAll, beforeAll, expect, it } from "vitest";
import { tenantDb } from "../backend/src/database";
import { app } from "../backend/src/index";
import { issuePatientSession } from "../backend/src/patient-session";
import { phase4Fixture } from "./phase4-fixture";

let fixture: Awaited<ReturnType<typeof phase4Fixture>>;
let doctor: string;
let nurse: string;
let statNurse: string;
let cashier: string;
let clinicAdmin: string;
let superAdmin: string;
let hospitalAdmin: string;
let eastDoctor: string;
let otherDoctor: string;
let eastCashier: string;
let otherCashier: string;
const production = { ENVIRONMENT: "production" };

beforeAll(async () => {
  fixture = await phase4Fixture();
  [
    doctor,
    nurse,
    statNurse,
    cashier,
    clinicAdmin,
    superAdmin,
    hospitalAdmin,
    eastDoctor,
    otherDoctor,
    eastCashier,
    otherCashier,
  ] = await Promise.all([
    fixture.login("doctor"),
    fixture.login("nurse"),
    fixture.login("stat-nurse"),
    fixture.login("cashier"),
    fixture.login("clinic-admin"),
    fixture.login("admin"),
    fixture.login("admin", "other-org"),
    fixture.login("east-doctor"),
    fixture.login("doctor", "other-org"),
    fixture.login("east-cashier"),
    fixture.login("cashier", "other-org"),
  ]).then((accounts) => accounts.map(({ token }) => token));
});
afterAll(() => fixture.db.close());

function post(path: string, token: string, body: unknown) {
  return fixture.request(path, { token, method: "POST", body });
}

async function encounter(token: string, name: string, emergency = false) {
  const response = await post("/encounters", token, {
    patient: {
      name,
      birthDate: "1980-01-01",
      gender: "other",
      language: "en-IN",
    },
    chiefComplaint: `Synthetic case ${name}`,
    answers: {
      chestPain: emergency ? "yes" : "no",
      breathless: "no",
      fainting: "no",
    },
    careConsent: true,
    synthetic: true,
  });
  expect(response.status).toBe(201);
  return (await response.json()) as { id: string; patientId: string };
}

it("requires canonical credentials for legacy clinical reads and writes, including when bindings are absent", async () => {
  for (const [method, path] of [
    ["GET", "/intake/queue"],
    ["GET", "/intake/encounter/example"],
    ["GET", "/intake/example"],
    ["POST", "/intake/encounter"],
    ["PATCH", "/intake/encounter/example"],
    ["POST", "/intake/example/status"],
    ["GET", "/patients"],
    ["GET", "/patients/example"],
    ["POST", "/patients"],
    ["PUT", "/patients/example"],
    ["GET", "/prescriptions"],
    ["GET", "/prescriptions/example"],
    ["GET", "/prescriptions/patient/example"],
    ["POST", "/prescriptions"],
    ["PUT", "/prescriptions/example/adherence"],
  ] as const) {
    expect(
      (await app.request(`/api/v1${path}`, { method })).status,
      `unbound ${method} ${path}`,
    ).toBe(401);
    expect(
      (await fixture.request(path, { method, bindings: production })).status,
      `production ${method} ${path}`,
    ).toBe(401);
  }
  expect((await fixture.request("/kiosk/capabilities")).status).toBe(200);
  expect((await fixture.request("/auth/patient/otp/capabilities")).status).toBe(
    200,
  );
});

it("serves the authorized clinic's actual queue and patient directory without fallback, and enforces patient ownership", async () => {
  const inClinic = await encounter(doctor, "Local patient");
  const elsewhere = await encounter(eastDoctor, "Other clinic patient");
  const foreign = await encounter(otherDoctor, "Other organization patient");
  const read = (path: string, token: string) =>
    fixture.request(path, { token, bindings: production });
  const local = await read("/intake/queue?status=WAITING", doctor);
  expect(local.status).toBe(200);
  expect(await local.json()).toMatchObject({
    queue: [{ id: inClinic.id, patient_id: inClinic.patientId }],
  });
  expect((await read("/intake/queue?clinicId=east", doctor)).status).toBe(403);
  expect((await read("/intake/queue?org_id=other-org", doctor)).status).toBe(
    403,
  );
  expect((await read("/intake/queue", cashier)).status).toBe(403);
  expect((await read(`/intake/encounter/${elsewhere.id}`, doctor)).status).toBe(
    404,
  );

  expect(await (await read("/patients", doctor)).json()).toMatchObject({
    count: 1,
    patients: [{ id: inClinic.patientId }],
  });
  expect((await read(`/patients/${elsewhere.patientId}`, doctor)).status).toBe(
    404,
  );
  expect((await read(`/patients/${foreign.patientId}`, doctor)).status).toBe(
    404,
  );
  expect((await read(`/patients/${inClinic.patientId}`, cashier)).status).toBe(
    403,
  );

  const owner = await issuePatientSession(
    { DB: fixture.db, ...production },
    "demo",
    inClinic.patientId,
    false,
    true,
  );
  const other = await issuePatientSession(
    { DB: fixture.db, ...production },
    "other-org",
    foreign.patientId,
    false,
    true,
  );
  expect(owner).not.toBeNull();
  expect(other).not.toBeNull();
  if (!owner || !other) throw new Error("Patient sessions unavailable");
  expect(
    await (await read(`/patients/${inClinic.patientId}`, owner.token)).json(),
  ).toMatchObject({ patient: { id: inClinic.patientId } });
  expect((await read("/patients", owner.token)).status).toBe(403);
  expect(
    (await read(`/patients/${inClinic.patientId}`, other.token)).status,
  ).toBe(404);
  expect(
    (await read(`/patients/${elsewhere.patientId}`, owner.token)).status,
  ).toBe(404);

  const review = await post(`/encounters/${inClinic.id}/review`, doctor, {
    note: "Clinician review",
  });
  expect(review.status).toBe(200);
  const sku = `test-${crypto.randomUUID()}`;
  await tenantDb({ db: fixture.db, orgId: "demo" })
    .statement(
      "INSERT INTO sku(org_id,id,brand,salt,strength_mg,form,nti,schedule_h,gst_bps) VALUES(:org,?,'Synthetic item','Synthetic salt',1,'tablet',0,0,0)",
      sku,
    )
    .run();
  const signed = await post("/clinical/pharmacy/prescriptions", doctor, {
    encounterId: inClinic.id,
    note: "Synthetic Rx",
    allergies: [],
    allergiesReviewed: true,
    pharmacyConsentConfirmed: true,
    lines: [
      {
        skuId: sku,
        units: 1,
        courseEnd: "2099-01-01",
        directions: "Synthetic only",
        allowEquivalent: false,
      },
    ],
  });
  expect(signed.status).toBe(201);
  const { id: rx } = (await signed.json()) as { id: string };
  expect(
    await (await read(`/prescriptions/${rx}`, owner.token)).json(),
  ).toMatchObject({ rxId: rx, medicines: [{ units: 1 }] });
  expect(
    await (
      await read(`/prescriptions/patient/${inClinic.patientId}`, owner.token)
    ).json(),
  ).toMatchObject({ rxId: rx });
  expect(
    (await read(`/prescriptions/${crypto.randomUUID()}`, owner.token)).status,
  ).toBe(404);
  expect((await read(`/prescriptions/${rx}`, other.token)).status).toBe(404);
  expect((await read(`/prescriptions/${rx}`, eastCashier)).status).toBe(404);
  expect((await read(`/prescriptions/${rx}`, otherCashier)).status).toBe(404);
  expect((await read(`/prescriptions/${rx}`, nurse)).status).toBe(403);
  expect(await (await read("/prescriptions", cashier)).json()).toMatchObject({
    prescriptions: [{ rxId: rx }],
  });

  expect(
    (
      await fixture.request(`/encounters/${inClinic.id}/revoke`, {
        method: "POST",
        token: doctor,
      })
    ).status,
  ).toBe(200);
  expect((await read(`/patients/${inClinic.patientId}`, doctor)).status).toBe(
    404,
  );
  expect((await read(`/prescriptions/${rx}`, owner.token)).status).toBe(404);
});

it("permits authorized command operations and enforces roster scope and audit privilege on the server", async () => {
  const prefix = "/clinical/command";
  for (const token of [doctor, nurse, statNurse, cashier]) {
    for (const route of [
      "/expenses",
      "/equipment",
      "/roster/north",
      "/audit",
    ]) {
      expect(
        (await fixture.request(`${prefix}${route}`, { token })).status,
      ).toBe(403);
    }
  }
  for (const route of ["/expenses", "/equipment", "/roster/north"]) {
    expect(
      (await fixture.request(`${prefix}${route}`, { token: superAdmin }))
        .status,
    ).toBe(403);
  }
  for (const route of ["/expenses", "/equipment", "/roster/north", "/audit"]) {
    expect(
      (await fixture.request(`${prefix}${route}`, { token: hospitalAdmin }))
        .status,
    ).toBe(200);
  }
  expect(
    await (
      await fixture.request(`${prefix}/audit`, { token: hospitalAdmin })
    ).json(),
  ).toMatchObject({ logs: [], verificationAvailable: false });
  expect(
    (await fixture.request("/platform/audit/verify", { token: hospitalAdmin }))
      .status,
  ).toBe(403);
  expect(
    (await fixture.request("/platform/audit/verify", { token: superAdmin }))
      .status,
  ).toBe(501);
  expect(
    (await fixture.request(`${prefix}/expenses`, { token: clinicAdmin }))
      .status,
  ).toBe(403);
  for (const clinic of ["east", "all"]) {
    expect(
      (
        await fixture.request(`${prefix}/roster/${clinic}`, {
          token: clinicAdmin,
        })
      ).status,
    ).toBe(403);
    expect(
      (await post(`${prefix}/roster/${clinic}/shifts`, clinicAdmin, {})).status,
    ).toBe(403);
  }
  const shift = await post(`${prefix}/roster/north/shifts`, clinicAdmin, {
    name: "Synthetic shift",
    start_time: "09:00",
    end_time: "16:00",
    grace_minutes: 5,
    late_cutoff_minutes: 10,
  });
  expect(shift.status).toBe(201);
  const { id } = (await shift.json()) as { id: string };
  expect(
    await (
      await fixture.request(`${prefix}/roster/north`, { token: clinicAdmin })
    ).json(),
  ).toMatchObject({
    shifts: [{ id, clinic_id: "north" }],
    staff: expect.arrayContaining([
      expect.objectContaining({ id: "doctor", clinic_id: "north" }),
    ]),
  });
  const assign = (user: string) =>
    fixture.request(`${prefix}/roster/north/staff/${user}/shift`, {
      token: clinicAdmin,
      method: "PUT",
      body: { shiftId: id },
    });
  expect((await assign("east-doctor")).status).toBe(404);
  expect((await assign("doctor")).status).toBe(200);
  expect(
    await (
      await fixture.request(`${prefix}/roster/north`, { token: hospitalAdmin })
    ).json(),
  ).toMatchObject({ shifts: [] });
  const exp = await post(`${prefix}/expenses`, hospitalAdmin, {
    clinic_id: "north",
    category: "Synthetic expense",
    amount_paise: 333,
    tax_bps: 500,
    description: "",
    expense_type: "ONE_TIME",
    expense_date: "2026-01-01",
  });
  expect(exp.status).toBe(201);
  expect(
    await (
      await fixture.request(`${prefix}/expenses`, { token: hospitalAdmin })
    ).json(),
  ).toMatchObject({ items: [{ amount_paise: 350, tax_paise: 17 }] });
  const asset = await post(`${prefix}/equipment`, hospitalAdmin, {
    clinic_id: "north",
    name: "Synthetic asset",
    category: "BEDS",
    quantity: 2,
    purchase_cost_paise: 1050,
    purchase_date: "2026-01-01",
  });
  expect(asset.status).toBe(201);
  expect(
    await (
      await fixture.request(`${prefix}/equipment`, { token: hospitalAdmin })
    ).json(),
  ).toMatchObject({ items: [{ purchase_cost_paise: 1050 }] });
});

it("shows a doctor only their waiting referrals and active assignments while preserving nurse workflows", async () => {
  const prefix = "/clinical/casualty";
  const unreferred = await encounter(nurse, "Unreferred emergency", true);
  const referred = await encounter(nurse, "Referred emergency", true);
  const assigned = await encounter(nurse, "Assigned emergency", true);
  const secondDoctor = await createSecondDoctor();
  const board = (token: string) =>
    fixture.request(`${prefix}/board`, { token });
  const refer = (token: string, encounterId: string, doctorId = "doctor") =>
    post(`${prefix}/referrals`, token, { encounterId, doctorId });

  expect((await fixture.request(`${prefix}/board`)).status).toBe(401);
  expect((await board(cashier)).status).toBe(403);
  expect((await refer(doctor, referred.id)).status).toBe(403);
  expect((await refer(statNurse, referred.id, "east-doctor")).status).toBe(404);
  expect(await (await board(doctor)).json()).toMatchObject({
    encounters: [],
    admissions: [],
  });
  expect((await refer(statNurse, referred.id)).status).toBe(201);
  const bay = await post(`${prefix}/locations`, statNurse, {
    room: "Synthetic bay",
    label: "Bay 1",
  });
  expect(bay.status).toBe(201);
  const { id: locationId } = (await bay.json()) as { id: string };
  const assignedElsewhere = await post(`${prefix}/admissions`, statNurse, {
    locationId,
    doctorId: secondDoctor.principal.userId,
    encounterId: assigned.id,
    reason: "Synthetic",
  });
  expect(assignedElsewhere.status).toBe(201);
  expect(await (await board(doctor)).json()).toMatchObject({
    encounters: [{ id: referred.id }],
    admissions: [],
  });
  expect(await (await board(secondDoctor.token)).json()).toMatchObject({
    encounters: [],
    admissions: [{ encounter_id: assigned.id }],
  });
  expect(await (await board(nurse)).json()).toMatchObject({
    encounters: expect.arrayContaining([
      expect.objectContaining({ id: unreferred.id }),
      expect.objectContaining({ id: referred.id }),
    ]),
    admissions: [{ encounter_id: assigned.id }],
  });
  expect(await (await board(statNurse)).json()).toMatchObject({
    admissions: [{ encounter_id: assigned.id }],
  });
  expect(await (await board(eastDoctor)).json()).toMatchObject({
    encounters: [],
    admissions: [],
  });
});

async function createSecondDoctor() {
  const db = tenantDb({ db: fixture.db, orgId: "demo" });
  await db
    .statement(`INSERT INTO users (org_id,id,clinic_id,email,role,password_salt,password_hash)
    SELECT org_id,'second-doctor','north','second-doctor@demo.test','DOCTOR',password_salt,password_hash
    FROM users WHERE org_id=:org AND id='doctor'`)
    .run();
  return fixture.login("second-doctor");
}
