import { afterAll, beforeAll, expect, it } from "vitest";
import { tenantDb } from "../backend/src/database";
import { ayushNoteSchema, dashavidha } from "../packages/shared/ayush";
import { phase4Fixture } from "./phase4-fixture";

let fixture: Awaited<ReturnType<typeof phase4Fixture>>;
let doctor: string;
let eastDoctor: string;
let foreignDoctor: string;
let nurse: string;
let admin: string;

const note = ayushNoteSchema.parse({
  examination: Object.fromEntries(
    Object.keys(dashavidha).map((field) => [
      field,
      "Documented practitioner observation",
    ]),
  ),
  dosha: { vata: 30, pitta: 40, kapha: 30 },
  agni: "Samagni",
  namasteCode: "",
  tm2Code: "",
  concurrentMedicines: ["Medication from reviewed history"],
  formulations: [
    {
      name: "Practitioner-entered formulation",
      dose: "",
      anupana: "",
      duration: "",
    },
  ],
  plan: "Practitioner follow-up notes.",
});

beforeAll(async () => {
  fixture = await phase4Fixture();
  const sessions = await Promise.all([
    fixture.login("doctor"),
    fixture.login("east-doctor"),
    fixture.login("doctor", "other-org"),
    fixture.login("nurse"),
    fixture.login("admin"),
  ] as const);
  [doctor, eastDoctor, foreignDoctor, nurse, admin] = [
    sessions[0].token,
    sessions[1].token,
    sessions[2].token,
    sessions[3].token,
    sessions[4].token,
  ];
});
afterAll(() => fixture.db.close());

it("keeps case notes doctor-only and scopes eligible encounters by clinic, tenant and active care consent", async () => {
  const created = await fixture.request("/encounters", {
    token: doctor,
    method: "POST",
    body: {
      patient: {
        name: "Synthetic AYUSH case",
        birthDate: "1974-03-15",
        gender: "female",
        language: "hi-IN",
      },
      chiefComplaint:
        "Synthetic routine presentation for encounter documentation",
      answers: {
        chestPain: "no",
        breathless: "no",
        fainting: "no",
        fever: "yes",
      },
      careConsent: true,
      synthetic: true,
    },
  });
  expect(created.status).toBe(201);
  const { id } = (await created.json()) as { id: string };
  const path = `/ayush/cases/${id}`;
  expect((await fixture.request(path, { token: doctor })).status).toBe(404);
  expect(
    (
      await fixture.request(`/encounters/${id}/review`, {
        token: doctor,
        method: "POST",
        body: { note: "Reviewed synthetic encounter." },
      })
    ).status,
  ).toBe(200);

  for (const token of [nurse, admin]) {
    expect((await fixture.request(path, { token })).status).toBe(403);
    expect(
      (
        await fixture.request(path, {
          token,
          method: "PUT",
          body: { version: 0, note },
        })
      ).status,
    ).toBe(403);
  }
  expect((await fixture.request(path)).status).toBe(401);
  for (const token of [eastDoctor, foreignDoctor]) {
    expect((await fixture.request(path, { token })).status).toBe(404);
    expect(
      (
        await fixture.request(path, {
          token,
          method: "PUT",
          body: { version: 0, note },
        })
      ).status,
    ).toBe(404);
  }
  expect(
    await (await fixture.request(path, { token: doctor })).json(),
  ).toMatchObject({ note: null, version: 0, prescriptions: [] });
  const db = tenantDb({ db: fixture.db, orgId: "demo" });
  const prescriptionId = crypto.randomUUID();
  await db.batch([
    db.statement(
      "INSERT INTO encounter_permissions (org_id, encounter_id, purpose, granted_at, actor_id) VALUES (:org, ?, 'pharmacy', ?, 'doctor')",
      id,
      new Date().toISOString(),
    ),
    db.statement(
      "INSERT INTO sku (org_id, id, brand, salt, strength_mg, form, nti, schedule_h, gst_bps) VALUES (:org, 'fixture-sku', 'Fixture Brand', 'warfarin', 1, 'tablet', 1, 1, 0)",
    ),
    db.statement(
      "INSERT INTO signed_prescriptions (org_id, id, encounter_id, clinic_id, signed_by, signed_at, signature_hash, note, allergies_json) VALUES (:org, ?, ?, 'north', 'doctor', ?, 'fixture-signature', '', '[]')",
      prescriptionId,
      id,
      new Date().toISOString(),
    ),
    db.statement(
      "INSERT INTO prescription_lines (org_id, id, prescription_id, sku_id, units, course_end, directions, allow_equivalent) VALUES (:org, 'fixture-line', ?, 'fixture-sku', 3, '2099-01-01', 'Fixture directions', 0)",
      prescriptionId,
    ),
  ]);
  expect(
    await (await fixture.request(path, { token: doctor })).json(),
  ).toMatchObject({
    prescriptions: [
      {
        name: "Fixture Brand",
        salt: "warfarin",
        units: 3,
        directions: "Fixture directions",
      },
    ],
  });

  expect(
    (
      await fixture.request(path, {
        token: doctor,
        method: "PUT",
        body: { version: 0, note: { ...note, agni: "Invalid" } },
      })
    ).status,
  ).toBe(400);

  const save = (version: number) =>
    fixture.request(path, {
      token: doctor,
      method: "PUT",
      body: { version, note },
    });
  expect((await save(0)).status).toBe(200);
  const concurrent = await Promise.all([save(1), save(1)]);
  expect(concurrent.map((response) => response.status).sort()).toEqual([
    200, 409,
  ]);
  expect(
    await (await fixture.request(path, { token: doctor })).json(),
  ).toMatchObject({ version: 2, note });

  expect(
    (
      await fixture.request(`/encounters/${id}/revoke`, {
        token: doctor,
        method: "POST",
      })
    ).status,
  ).toBe(200);
  expect((await fixture.request(path, { token: doctor })).status).toBe(404);
  expect((await save(2)).status).toBe(404);
});
