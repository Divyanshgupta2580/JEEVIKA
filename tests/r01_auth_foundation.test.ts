import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LocalDatabase } from "../backend/local/database";
import { migrateLocal, migrationScripts } from "../backend/local/migrate";
import { demoPassword, seedDemo } from "../backend/local/seed";
import type { Env } from "../backend/src/context";
import { app } from "../backend/src/index";
import { tokenHash } from "../backend/src/security";
import { landingRoute } from "../frontend/website/src/lib/rbac";
import { loginResponseSchema } from "../packages/shared/integration";

const account = {
  name: "Synthetic database test",
  phone: "000000000013",
  email: "patient@example.test",
  password: "SyntheticAccount123!",
  dob: "1990-01-01",
};
const replacement = "SyntheticReplacement123!";
let db: LocalDatabase;
let env: Env;

beforeEach(() => {
  db = new LocalDatabase();
  migrateLocal(db);
  env = { DB: db, ENVIRONMENT: "test" };
});
afterEach(() => db.close());

function request(path: string, body?: object, token?: string, overrides: Partial<Env> = {}, method?: string) {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return app.request(`http://127.0.0.1/api/v1${path}`, {
    method: method ?? (body ? "POST" : "GET"), headers, body: body ? JSON.stringify(body) : undefined,
  }, { ...env, ...overrides });
}

async function signup() {
  const response = await request("/auth/patient/signup", account);
  expect(response.status).toBe(201);
  return response.json<{ token: string; patient: { id: string } }>();
}

function counts() {
  return db.raw.prepare(`SELECT (SELECT COUNT(*) FROM patients) AS patients,
    (SELECT COUNT(*) FROM patient_credentials) AS credentials,
    (SELECT COUNT(*) FROM patient_app_preferences) AS preferences,
    (SELECT COUNT(*) FROM patient_sessions) AS sessions`).get();
}

describe("R01 canonical schema", () => {
  it("matches fresh manifest and standalone schema and preserves an existing patient on repeat", () => {
    const configured = new LocalDatabase();
    try {
      const scripts = migrationScripts();
      for (const sql of scripts.slice(0, -1)) configured.raw.exec(sql);
      configured.raw.exec(`INSERT INTO patients(org_id,id,name,birth_date,gender,language,synthetic)
        VALUES ('demo','prior','Synthetic existing record','1990-01-01','other','en-IN',1)`);
      configured.raw.exec(scripts.at(-1)!);
      expect(configured.raw.prepare("SELECT id FROM patients WHERE org_id='demo' AND id='prior'").get()).toEqual({ id: "prior" });
      const schema = (fixture: LocalDatabase) => fixture.raw.prepare(`SELECT type,name,sql FROM sqlite_schema
        WHERE sql IS NOT NULL AND name NOT IN ('standalone_schema_migrations') ORDER BY type,name`).all();
      // Local seeds add rows only. The schema statements produce the same catalogue.
      expect(schema(configured)).toEqual(schema(db));
      migrateLocal(db);
      expect(db.raw.prepare("PRAGMA integrity_check").get()).toEqual({ integrity_check: "ok" });
      expect(db.raw.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
      expect(configured.raw.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
    } finally {
      configured.close();
    }
  });
});

describe("R01 durable patient account", () => {
  it("rolls back patient, credentials and preferences if the session write fails", async () => {
    db.raw.exec(`CREATE TRIGGER test_abort_session BEFORE INSERT ON patient_sessions
      BEGIN SELECT RAISE(ABORT,'synthetic session write failure'); END;`);
    const result = await request("/auth/patient/signup", account);
    expect(result.status).toBe(503);
    expect(await result.json()).not.toHaveProperty("token");
    expect(counts()).toEqual({ patients: 0, credentials: 0, preferences: 0, sessions: 0 });
    expect((await request("/auth/patient/login", { identifier: account.phone, password: account.password })).status).toBe(401);
  });

  it("commits concurrent duplicate signup exactly once and persists preference changes through relogin", async () => {
    const replies = await Promise.all([request("/auth/patient/signup", account), request("/auth/patient/signup", account)]);
    expect(replies.map((reply) => reply.status).sort()).toEqual([201, 409]);
    expect(counts()).toEqual({ patients: 1, credentials: 1, preferences: 1, sessions: 1 });
    const { token, patient } = await replies.find((reply) => reply.status === 201)!.json<{ token: string; patient: { id: string } }>();
    expect((await request(`/patient/${patient.id}/preferences`, { themeMode: "dark" }, token, {}, "PUT")).status).toBe(200);
    expect((await request("/patient/different-id/profile", undefined, token)).status).toBe(403);
    const fresh = await request("/auth/patient/login", { identifier: account.email, password: account.password });
    expect(fresh.status).toBe(200);
    expect(await fresh.json()).toMatchObject({ patient: { id: patient.id }, preferences: { themeMode: "dark" } });
  });

  it("keeps production self-registration closed", async () => {
    expect((await request("/auth/patient/signup", account, undefined, { ENVIRONMENT: "production", DEMO_MODE: "true" })).status).toBe(503);
    expect(counts()).toEqual({ patients: 0, credentials: 0, preferences: 0, sessions: 0 });
  });
});

describe("R01 verified recovery", () => {
  const kind = "patient";
  const recoveryRequest = { account: kind, orgId: "org_default", email: account.email };
  let delivered: string[];

  function bindProvider() {
    delivered = [];
    env.PASSWORD_RECOVERY = {
      async fetch(outbound) {
        const data = await outbound.json() as { token: string; email: string };
        expect(data.email).toBe(account.email);
        delivered.push(data.token);
        return new Response(null, { status: 204 });
      },
    };
  }

  function verifyEmail(accountId: string, scope = kind, org = "org_default") {
    db.raw.prepare(`INSERT INTO account_recovery_channels(org_id,account_kind,account_id,email,verified_at)
      VALUES (?,?,?,?,?)`).run(org, scope, accountId, account.email, new Date().toISOString());
  }

  const ask = (email = account.email) => request("/auth/password-reset/request", { ...recoveryRequest, email });
  const confirm = (token: string, orgId = "org_default") =>
    request("/auth/password-reset/confirm", { account: kind, orgId, token, password: replacement });

  it("reports unconfigured recovery unavailable and never delivers to an unverified address", async () => {
    expect((await ask()).status).toBe(503);
    await signup();
    bindProvider();
    expect((await ask()).status).toBe(202);
    expect(delivered).toHaveLength(0);
  });

  it("uses hashed single-use reset tokens, ignores unknown addresses and revokes prior sessions", async () => {
    bindProvider();
    const session = await signup();
    verifyEmail(session.patient.id);
    const sent = await ask();
    const unknown = await ask("unknown@example.test");
    expect(sent.status).toBe(unknown.status);
    expect(await sent.json()).toEqual(await unknown.json());
    const token = delivered[0]!;
    expect(delivered).toHaveLength(1);
    expect(db.raw.prepare("SELECT token_hash FROM account_recovery_tokens").get()).toEqual({ token_hash: await tokenHash(token) });
    expect((await confirm(token, "other-org")).status).toBe(400);
    const raced = await Promise.all([confirm(token), confirm(token)]);
    expect(raced.map((result) => result.status).sort()).toEqual([200, 400]);
    expect((await request("/auth/patient/me", undefined, session.token)).status).toBe(401);
    expect((await request("/auth/patient/login", { identifier: account.phone, password: account.password })).status).toBe(401);
    expect((await request("/auth/patient/login", { identifier: account.phone, password: replacement })).status).toBe(200);
  });

  it("rejects expired reset tokens and caps sends per verified address", async () => {
    bindProvider();
    const session = await signup();
    verifyEmail(session.patient.id);
    for (let i = 0; i < 4; i++) expect((await ask()).status).toBe(202);
    expect(delivered).toHaveLength(3);
    db.raw.prepare("UPDATE account_recovery_tokens SET expires_at=?").run("2000-01-01T00:00:00.000Z");
    expect((await confirm(delivered[0]!)).status).toBe(400);
    expect((await request("/auth/patient/me", undefined, session.token)).status).toBe(200);
  });

  it("recovers a verified staff account without retaining its prior session", async () => {
    bindProvider();
    await seedDemo(db);
    verifyEmail("doctor", "staff", "demo");
    const staff = { orgId: "demo", email: "doctor@demo.test", password: demoPassword };
    const started = await request("/auth/login", staff);
    const session = loginResponseSchema.parse(await started.json());
    expect((await request("/auth/password-reset/request", { orgId: "demo", account: "staff", email: account.email })).status).toBe(202);
    expect((await request("/auth/password-reset/confirm", { orgId: "demo", account: "staff", token: delivered[0], password: replacement })).status).toBe(200);
    expect((await request("/auth/me", undefined, session.token)).status).toBe(401);
    expect((await request("/auth/login", { ...staff, password: replacement })).status).toBe(200);
  });
});

describe("R01 canonical staff principals", () => {
  it("authenticates the eight staff roles and enforces narrow read/write permissions", async () => {
    await seedDemo(db);
    env.ORGANIZATION_OWNERS = "demo/admin";
    env.PLATFORM_SUPER_ADMINS = "other-org/admin";
    const cases = [
      ["demo", "admin", "OWNER", "/app/command"], ["other-org", "admin", "SUPER_ADMIN", "/app/command"],
      ["demo", "doctor", "DOCTOR", "/app/doctor"], ["demo", "nurse", "NURSE", "/app/ipd"],
      ["demo", "clinic-admin", "CLINIC_ADMIN", "/app/command"], ["demo", "stat-nurse", "STAT_NURSE", "/app/casualty/triage"],
      ["demo", "cashier", "CASHIER", "/app/pos"], ["other-org", "admin", "HOSPITAL_ADMIN", "/app/command"],
    ] as const;
    for (const [orgId, username, role, home] of cases) {
      const bindings = role === "HOSPITAL_ADMIN" ? { PLATFORM_SUPER_ADMINS: "" } : {};
      const result = await request("/auth/login", { orgId, email: `${username}@demo.test`, password: demoPassword }, undefined, bindings);
      expect(result.status).toBe(200);
      const { principal, token } = loginResponseSchema.parse(await result.json());
      expect(principal.role).toBe(role);
      expect(landingRoute(role)).toBe(home);
      expect((await request("/clinical/nurse-calls", undefined, token, bindings)).status).toBe(role === "NURSE" ? 200 : 403);
      if (role === "OWNER") {
        expect((await request("/clinical/ledger", undefined, token, bindings)).status).toBe(200);
        expect((await request("/clinical/ledger/lock", {}, token, bindings)).status).toBe(403);
      }
    }
  });
});
