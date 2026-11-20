import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { LocalDatabase } from "../backend/local/database";
import { migrateLocal } from "../backend/local/migrate";
import { demoPassword, seedDemo } from "../backend/local/seed";
import {
  authorizeDataSocket,
  dataProtocol,
  dataSocketPath,
  deliverDataSocketMessage,
} from "../backend/src/data-socket";
import { tenantDb } from "../backend/src/database";
import { ClinicHub } from "../backend/src/do/ClinicHub";
import { app } from "../backend/src/index";
import { readFileSync } from "node:fs";
import { tokenHash } from "../backend/src/security";
import { encounterSchema, loginResponseSchema } from "../packages/shared/integration";

const db = new LocalDatabase();
const env = { DB: db, ENVIRONMENT: "test" };
const base = "https://clinical.example";
const dispatch = (request: Request, bindings = env) => app.fetch(request, bindings);
const json = (body: unknown) => JSON.stringify(body);

beforeAll(async () => {
  migrateLocal(db);
  await seedDemo(db);
});

afterAll(() => db.close());

async function rest(token: string | undefined, path: string, method = "GET", body?: unknown) {
  return dispatch(new Request(new URL(`/api/v1${path}`, base), {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "Content-Type": "application/json",
      "Idempotency-Key": crypto.randomUUID(),
    },
    body: body === undefined ? undefined : json(body),
  }));
}

async function login(role: string, orgId = "demo") {
  const response = await rest(undefined, "/auth/login", "POST", {
    orgId, email: `${role}@demo.test`, password: demoPassword,
  });
  expect(response.status).toBe(200);
  return loginResponseSchema.parse(await response.json()).token;
}

function upgrade(token?: string, origin?: string) {
  const request = new Request(new URL(dataSocketPath, base), {
    headers: {
      Upgrade: "websocket",
      "Sec-WebSocket-Protocol": token ? `${dataProtocol}, session.${token}` : dataProtocol,
      ...(origin ? { Origin: origin } : {}),
    },
  });
  return authorizeDataSocket(request, env, dispatch);
}

type Handler = NonNullable<Awaited<ReturnType<typeof upgrade>>>;

async function connect(token: string): Promise<Handler> {
  const handle = await upgrade(token, base);
  if (!handle) throw new Error("Expected a verified socket session");
  return handle;
}

async function event(handle: Handler, path: string, method = "GET", body?: unknown) {
  const reply = await handle(json({ id: "test", path, method, body, key: crypto.randomUUID() }));
  if (typeof reply.frame !== "string") throw new Error("Expected a JSON reply");
  return { ...JSON.parse(reply.frame), endSession: reply.endSession };
}

describe("WebSocket authorization parity", () => {
  it("authenticates the upgrade and shares clinical REST's origin policy", async () => {
    const token = await login("doctor");
    expect(await upgrade()).toBeNull();
    expect(await upgrade("mock-jwt-token")).toBeNull();
    expect(await upgrade(token, "https://ayuseva.pages.dev")).toBeNull();
    expect(await upgrade(token, base)).toBeTypeOf("function");
    expect(await upgrade(token, "http://localhost:5174")).toBeTypeOf("function");
  });

  it("preserves role checks and isolates encounter and CBC IDs by clinic and tenant", async () => {
    const doctor = await login("doctor");
    const intake = await rest(doctor, "/encounters", "POST", {
      patient: { name: "Synthetic socket patient", birthDate: "1990-01-01", gender: "female", language: "en-IN" },
      chiefComplaint: "Synthetic parity fixture",
      answers: { chestPain: "no", breathless: "no", fainting: "no" },
      careConsent: true,
      synthetic: true,
    });
    expect(intake.status).toBe(201);
    const encounter = encounterSchema.parse(await intake.json());
    const path = `/encounters/${encounter.id}`;
    const who = await connect(doctor);
    const report = await event(who, "/cbc/reports", "POST", {
      encounterId: encounter.id, processingConsent: true, researchConsent: false,
    });
    expect(report.status).toBe(201);
    const reportPath = `/cbc/reports/${report.body.id}`;
    expect((await event(who, reportPath)).status).toBe(200);

    for (const [user, org, expected] of [["nurse", "demo", 200], ["cashier", "demo", 403], ["east-doctor", "demo", 404], ["doctor", "other-org", 404]] as const) {
      const token = await login(user, org);
      const handle = await connect(token);
      expect((await rest(token, path)).status).toBe(expected);
      expect((await event(handle, path)).status).toBe(expected);
      const cbcStatus = user === "nurse" || user === "cashier" ? 403 : 404;
      expect((await rest(token, reportPath)).status).toBe(cbcStatus);
      expect((await event(handle, reportPath)).status).toBe(cbcStatus);
      if (user === "nurse") {
        expect((await event(handle, `${path}/review`, "POST", { note: "Synthetic review attempted" })).status).toBe(403);
      }
    }

    expect((await event(who, `${path}/revoke`, "POST")).status).toBe(200);
    expect((await event(who, reportPath)).status).toBe(404);
  });

  it("limits patient scope to the verified owner and ends an active connection after durable revocation", async () => {
    const response = await rest(undefined, "/auth/patient/signup", "POST", {
      name: "Synthetic session patient", phone: "+919876543221", password: "SyntheticFixture123!",
      dob: "1990-01-01", sex: "FEMALE",
    });
    expect(response.status).toBe(201);
    const session = await response.json() as { token: string; patient: { id: string } };
    const tokenDigest = await tokenHash(session.token);
    const row = db.raw.prepare("SELECT org_id,patient_id FROM patient_sessions WHERE token_hash = ?").get(tokenDigest);
    expect(row).toEqual({ org_id: "org_default", patient_id: session.patient.id });
    const ownPath = `/patient/${session.patient.id}/preferences`;
    const handle = await connect(session.token);
    expect((await event(handle, ownPath)).status).toBe(200);
    expect((await event(handle, "/patient/patient-two/preferences")).status).toBe(403);
    expect((await event(handle, "/encounters")).status).toBe(403);
    expect((await rest(session.token, "/auth/patient/logout", "POST")).status).toBe(200);
    expect((await event(handle, ownPath))).toMatchObject({ status: 401, endSession: true });
  });

  it("preserves a patient session when upgrading a database that already ran 0006", async () => {
    const legacy = new LocalDatabase();
    try {
      legacy.raw.exec(readFileSync("backend/migrations/0001_intake.sql", "utf8"));
      legacy.raw.exec(readFileSync("backend/migrations/0006_patient_auth_and_preferences.sql", "utf8"));
      legacy.raw.exec("PRAGMA foreign_keys = OFF");
      legacy.raw.exec(`
        INSERT INTO patients (org_id,id,name,birth_date,gender,language,synthetic)
        VALUES ('demo','legacy-patient','Synthetic patient','1990-01-01','female','en-IN',1);
        INSERT INTO patient_sessions (org_id,token_hash,patient_id,expires_at)
        VALUES ('demo','fixture-digest','legacy-patient','2099-01-01T00:00:00.000Z');
      `);
      legacy.raw.exec("PRAGMA foreign_keys = ON");
      migrateLocal(legacy);
      migrateLocal(legacy);
      expect(legacy.raw.prepare("SELECT patient_id FROM patient_sessions WHERE token_hash = 'fixture-digest'").get())
        .toEqual({ patient_id: "legacy-patient" });
      expect(legacy.raw.prepare("PRAGMA foreign_key_check(patient_sessions)").all()).toEqual([]);
      expect(() => legacy.raw.exec(`
        INSERT INTO patient_sessions (org_id,token_hash,patient_id,expires_at)
        VALUES ('other-org','different-digest','legacy-patient','2099-01-01T00:00:00.000Z')
      `)).toThrow(/FOREIGN KEY/);
    } finally {
      legacy.close();
    }
  });

  it("rejects expired staff and rechecks staff roles during active connections", async () => {
    const token = await login("admin");
    const handle = await connect(token);
    const tenant = tenantDb({ db, orgId: "demo" });
    await tenant.statement("UPDATE users SET role='CASHIER' WHERE org_id=:org AND id='admin'").run();
    try {
      expect((await event(handle, "/encounters")).status).toBe(403);
      await tenant.statement(
        "UPDATE sessions SET expires_at=? WHERE org_id=:org AND token_hash=?",
        "2000-01-01T00:00:00.000Z", await tokenHash(token),
      ).run();
      expect(await upgrade(token)).toBeNull();
      expect((await event(handle, "/cbc/capabilities"))).toMatchObject({ status: 401, endSession: true });
    } finally {
      await tenant.statement("UPDATE users SET role='HOSPITAL_ADMIN' WHERE org_id=:org AND id='admin'").run();
    }
  });

  it("returns structured errors for invalid frames and keeps room upgrades closed", async () => {
    const handle = await connect(await login("doctor"));
    const send = vi.fn();
    const close = vi.fn();
    const socket = { readyState: 1, send, close };
    await deliverDataSocketMessage(handle, () => "not JSON", socket);
    expect(JSON.parse(send.mock.calls[0]?.[0])).toMatchObject({
      id: null, status: 400, body: { error: { code: "HTTP_400" } },
    });
    await deliverDataSocketMessage(handle, () => json({
      id: "spoof", path: "/encounters", method: "GET", role: "HOSPITAL_ADMIN",
    }), socket);
    expect(JSON.parse(send.mock.calls[1]?.[0])).toMatchObject({ id: "spoof", status: 400 });
    expect((await event(handle, "/encounters")).status).toBe(200);
    expect(close).not.toHaveBeenCalled();
    const hub = new ClinicHub();
    expect((await hub.fetch(new Request(base, { headers: { Upgrade: "websocket" } }))).status).toBe(403);
  });
});
