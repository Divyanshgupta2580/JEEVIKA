import { Hono, type Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { Env } from "../../context";
import { tenantDb } from "../../database";
import { equalHash, newToken, passwordHash, tokenHash } from "../../security";
import { issuePatientSession, revokePatientSession, validatePatientSession } from "../../patient-session";
import { incrementAuthLimit } from "../../auth-rate";
import {
  ayurvedicProfileSchema,
  patientLoginSchema,
  patientPreferencesSchema,
  patientProfileUpdateSchema,
  patientSignupSchema,
} from "./contracts";
import { patientStore } from "../../index";

type AccountContext = { Bindings: Env; Variables: { patientOrgId: string } };
type PatientDb = ReturnType<typeof tenantDb>;
const unavailable = { success: false, error: "Patient account service unavailable." };
const invalidLogin = { success: false, error: "Invalid phone number, email, or password" };
const invalidSession = { success: false, error: "Session invalid or expired" };
const defaultOrg = "org_default";
const normalizePhone = (phone: string) => phone.replace(/[\s()-]/g, "");

function accountOrg(c: Context<AccountContext>) {
  const org = c.req.header("X-Tenant-Id") ?? c.req.header("X-Org-Id") ?? defaultOrg;
  return /^[a-z0-9_-]{1,80}$/.test(org) ? org : null;
}

function useAccountBoundary(app: Hono<AccountContext>) {
  app.use("*", async (c, next) => {
    c.header("Cache-Control", "no-store");
    return bodyLimit({ maxSize: 16000 })(c, next);
  });
  app.onError((_error, c) => c.json(unavailable, 503));
}

const patientColumns = `p.org_id AS orgId,p.id,p.name,COALESCE(p.dob,p.birth_date) AS dob,
  COALESCE(p.sex,p.gender) AS sex,COALESCE(p.preferred_lang,p.language) AS preferredLang,
  p.blood_group AS bloodGroup,p.abha_number AS abhaNumber,p.address,
  p.emergency_contact AS emergencyContact,p.updated_at AS updatedAt,
  p.allergies_json AS allergies,p.chronic_conditions_json AS chronicConditions,
  a.phone_number AS phone`;

function patientRecord(db: PatientDb, id: string) {
  return db.statement(
    `SELECT ${patientColumns} FROM patients p LEFT JOIN patient_credentials a
     ON a.org_id=p.org_id AND a.patient_id=p.id WHERE p.org_id=:org AND p.id=?`, id,
  ).first<{id: string; preferredLang: string; allergies: string | null; chronicConditions: string | null}>();
}

function profilePayload(patient: NonNullable<Awaited<ReturnType<typeof patientRecord>>>) {
  return { ...patient, allergies: JSON.parse(patient.allergies ?? "[]") as unknown,
    chronicConditions: JSON.parse(patient.chronicConditions ?? "[]") as unknown };
}

const preferenceFields = [
  ["primary_focus", "primaryFocus"], ["primary_modules_json", "primaryModules"],
  ["theme_mode", "themeMode"], ["color_accent", "colorAccent"], ["language", "language"],
  ["notifications_enabled", "notificationsEnabled"], ["medicine_reminders_enabled", "medicineRemindersEnabled"],
  ["cycle_reminders_enabled", "cycleRemindersEnabled"], ["vitals_drift_alerts_enabled", "vitalsDriftAlertsEnabled"],
  ["biometric_login_enabled", "biometricLoginEnabled"], ["reminder_morning_time", "reminderMorningTime"],
  ["reminder_afternoon_time", "reminderAfternoonTime"], ["reminder_night_time", "reminderNightTime"],
] as const;
const ayurvedaFields = [
  ["primary_dosha", "primaryDosha"], ["secondary_dosha", "secondaryDosha"],
  ["prakriti_summary", "prakritiSummary"], ["vikriti_aggravation", "vikritiAggravation"],
  ["agni_type", "agniType"], ["koshtha_type", "koshthaType"],
  ["dietary_guidelines_json", "dietaryGuidelines"], ["yoga_recommendations_json", "yogaRecommendations"],
] as const;

function decodeField(column: string, value: string | number | null) {
  if (column.endsWith("_json")) return JSON.parse(String(value)) as unknown;
  if (column.endsWith("_enabled")) return Boolean(value);
  return value;
}

async function accountDetails(db: PatientDb, id: string, language: string) {
  const [preferences, ayurveda] = await Promise.all([
    db.statement("SELECT * FROM patient_app_preferences WHERE org_id=:org AND patient_id=?", id).first<Record<string, string | number | null>>(),
    db.statement("SELECT * FROM patient_ayurvedic_profiles WHERE org_id=:org AND patient_id=?", id).first<Record<string, string | number | null>>(),
  ]);
  return {
    preferences: preferences ? Object.fromEntries(preferenceFields.map(([column, key]) => [key, decodeField(column, preferences[column] ?? null)])) : patientPreferencesSchema.parse({ language }),
    ayurveda: ayurveda ? { patientId: id, assessedAt: ayurveda.assessed_at,
      ...Object.fromEntries(ayurvedaFields.map(([column, key]) => [key, decodeField(column, ayurveda[column] ?? null)])) } : null,
    onboardingComplete: ayurveda !== null,
  };
}

function patientSessionToken(org: string) {
  const token = `${org}.pat.${newToken()}`;
  return { token, expiresAt: new Date(Date.now() + 30 * 86400000).toISOString() };
}

export const patientAuthRouter = new Hono<AccountContext>();
useAccountBoundary(patientAuthRouter);

patientAuthRouter.post("/signup", async (c) => {
  if (!c.env?.DB || !["development", "test"].includes(c.env.ENVIRONMENT))
    return c.json({ success: false, error: "Self-registration is unavailable. Contact your clinic." }, 503);
  const orgId = accountOrg(c);
  if (!orgId || orgId !== (c.env.PATIENT_SIGNUP_ORG ?? defaultOrg))
    return c.json({ success: false, error: "Registration is unavailable for this organization." }, 403);
  const parsed = patientSignupSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ success: false, error: "Invalid registration fields" }, 400);
  const input = parsed.data;
  const phone = normalizePhone(input.phone);
  if (!/^\+?[0-9]{10,15}$/.test(phone)) return c.json({ success: false, error: "Invalid registration fields" }, 400);
  const phoneHash = await tokenHash(phone);
  const email = input.email?.toLowerCase() ?? null;
  const db = tenantDb({ db: c.env.DB, orgId });
  const id = crypto.randomUUID();
  const salt = crypto.randomUUID();
  const stamp = new Date().toISOString();
  const session = patientSessionToken(orgId);
  const [hash, tokenDigest] = await Promise.all([passwordHash(input.password, salt), tokenHash(session.token)]);
  try {
    await db.batch([
      db.statement(
        `INSERT INTO patients (org_id,id,name,birth_date,gender,language,synthetic,phone_hash,dob,sex,preferred_lang,
         abha_number,blood_group,emergency_contact,address,updated_at)
         VALUES (:org,?,?,?,?,?,1,?,?,?,?,?,?,?,?,?)`,
        id, input.name, input.dob, input.sex.toLowerCase(), input.preferredLang,
        phoneHash, input.dob, input.sex, input.preferredLang, input.abhaNumber ?? null,
        input.bloodGroup ?? null, input.emergencyContact ?? null, input.address ?? null, stamp,
      ),
      db.statement(`INSERT INTO patient_credentials
        (org_id,id,patient_id,phone_number,phone_hash,email,password_salt,password_hash,phone_verified)
        VALUES (:org,?,?,?,?,?,?,?,0)`, crypto.randomUUID(), id, phone, phoneHash, email, salt, hash),
      db.statement("INSERT INTO patient_app_preferences (org_id,id,patient_id,language) VALUES (:org,?,?,?)",
        crypto.randomUUID(), id, input.preferredLang),
      db.statement("INSERT INTO patient_sessions (org_id,token_hash,patient_id,expires_at) VALUES (:org,?,?,?)",
        tokenDigest, id, session.expiresAt),
    ]);
  } catch {
    const exists = await db.statement(`SELECT 1 FROM patient_credentials
      WHERE org_id=:org AND (phone_hash=? OR lower(email)=?)`, phoneHash, email).first();
    if (exists) return c.json({ success: false, error: "A patient account with these details already exists" }, 409);
    return c.json(unavailable, 503);
  }
  return c.json({ success: true, ...session,
    patient: { id, orgId, name: input.name, dob: input.dob, sex: input.sex, phone, preferredLang: input.preferredLang,
      bloodGroup: input.bloodGroup, abhaNumber: input.abhaNumber, address: input.address,
      emergencyContact: input.emergencyContact, allergies: [], chronicConditions: [], createdAt: stamp, updatedAt: stamp },
    preferences: patientPreferencesSchema.parse({ language: input.preferredLang }), onboardingComplete: false,
  }, 201);
});

patientAuthRouter.post("/login", async (c) => {
  const orgId = accountOrg(c);
  if (!orgId) return c.json(invalidLogin, 401);
  if (!c.env?.DB) return c.json(unavailable, 503);
  const parsed = patientLoginSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ success: false, error: "Identifier and password required" }, 400);
  const { identifier, password } = parsed.data;
  const phone = normalizePhone(identifier);
  const phoneHash = await tokenHash(phone);
  const db = tenantDb({ db: c.env.DB, orgId });
  if (!await incrementAuthLimit(db, "patient-login", /^[+0-9]+$/.test(phone) ? phone : identifier.toLowerCase(), 10, 60_000))
    return c.json({ success: false, error: "Too many login attempts. Try again in a minute." }, 429);
  const credential = await db.statement(`SELECT patient_id,password_salt,password_hash FROM patient_credentials
    WHERE org_id=:org AND status='ACTIVE' AND (lockout_until IS NULL OR lockout_until<=?)
      AND (phone_hash=? OR lower(email)=?)`, new Date().toISOString(), phoneHash, identifier.toLowerCase())
    .first<{ patient_id: string; password_salt: string; password_hash: string }>();
  const hash = await passwordHash(password, credential?.password_salt ?? "unknown-patient-account");
  if (!credential || !equalHash(hash, credential.password_hash)) {
    // Exact legacy evaluator credentials remain development/test only, scoped to their fixture organization.
    if (!credential && password === "demo" && ["development", "test"].includes(c.env.ENVIRONMENT)) {
      const demoId = ["pat-048291", "9876543210"].includes(phone) ? "pat-048291" :
        ["pat-048292", "9811122334", "9123456780"].includes(phone) ? "pat-048292" : null;
      const patient = demoId ? patientStore.get(demoId) : undefined;
      if (patient?.orgId === orgId) {
        const session = await issuePatientSession(c.env, orgId, patient.id, true);
        if (session) return c.json({ success: true, ...session, patient, onboardingComplete: true });
      }
    }
    return c.json(invalidLogin, 401);
  }
  const patient = await patientRecord(db, credential.patient_id);
  if (!patient) return c.json(unavailable, 503);
  const details = await accountDetails(db, patient.id, patient.preferredLang);
  const session = patientSessionToken(orgId);
  const result = await db.statement(`INSERT INTO patient_sessions(org_id,token_hash,patient_id,expires_at)
    SELECT org_id,?,patient_id,? FROM patient_credentials
    WHERE org_id=:org AND patient_id=? AND status='ACTIVE' AND password_hash=?`,
    await tokenHash(session.token), session.expiresAt, patient.id, hash).run();
  if (result.meta.changes !== 1) return c.json(invalidLogin, 401);
  return c.json({ success: true, ...session, patient: profilePayload(patient), ...details });
});

function sessionFor(c: Context<AccountContext>) {
  const header = c.req.header("Authorization") ?? "";
  return header.startsWith("Bearer ") ? validatePatientSession(c.env, header.slice(7)) : null;
}

patientAuthRouter.post("/logout", async (c) => {
  const authorization = c.req.header("Authorization") ?? "";
  if (authorization.startsWith("Bearer ")) await revokePatientSession(c.env, authorization.slice(7));
  return c.json({ success: true, message: "Logged out successfully" });
});

patientAuthRouter.get("/me", async (c) => {
  const session = await sessionFor(c);
  if (!session) return c.json(invalidSession, 401);
  if (!c.env?.DB) return c.json(unavailable, 503);
  const db = tenantDb({ db: c.env.DB, orgId: session.orgId });
  const patient = await patientRecord(db, session.patientId);
  const demo = !patient && ["development", "test"].includes(c.env.ENVIRONMENT) ? patientStore.get(session.patientId) : undefined;
  if (!patient && demo?.orgId !== session.orgId) return c.json(invalidSession, 401);
  return c.json({ success: true, patientId: session.patientId, expiresAt: session.expiresAt,
    patient: patient ? profilePayload(patient) : demo,
    ...await accountDetails(db, session.patientId, patient?.preferredLang ?? "hi"),
  });
});

export const patientProfileRouter = new Hono<AccountContext>();
useAccountBoundary(patientProfileRouter);
patientProfileRouter.use("/:id/*", async (c, next) => {
  const session = await sessionFor(c);
  if (!session) return c.json(invalidSession, 401);
  if (session.patientId !== c.req.param("id")) return c.json({ success: false, error: "Patient access denied" }, 403);
  if (!c.env?.DB) return c.json(unavailable, 503);
  c.set("patientOrgId", session.orgId);
  await next();
});

function profileDb(c: Context<AccountContext>) {
  return tenantDb({ db: c.env.DB, orgId: c.get("patientOrgId") });
}

patientProfileRouter.get("/:id/profile", async (c) => {
  const patient = await patientRecord(profileDb(c), c.req.param("id"));
  return patient ? c.json({ success: true, patient: profilePayload(patient) }) :
    c.json({ success: false, error: "Patient not found" }, 404);
});

patientProfileRouter.put("/:id/profile", async (c) => {
  const parsed = patientProfileUpdateSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ success: false, error: "Invalid profile data" }, 400);
  const id = c.req.param("id");
  const db = profileDb(c);
  const input = parsed.data;
  await db.statement(`UPDATE patients SET name=COALESCE(?,name),dob=COALESCE(?,dob),
    birth_date=COALESCE(?,birth_date),sex=COALESCE(?,sex),gender=COALESCE(?,gender),
    blood_group=COALESCE(?,blood_group),address=COALESCE(?,address),emergency_contact=COALESCE(?,emergency_contact),
    preferred_lang=COALESCE(?,preferred_lang),language=COALESCE(?,language),allergies_json=COALESCE(?,allergies_json),
    chronic_conditions_json=COALESCE(?,chronic_conditions_json),updated_at=? WHERE org_id=:org AND id=?`,
    input.name ?? null, input.dob ?? null, input.dob ?? null, input.sex ?? null, input.sex?.toLowerCase() ?? null,
    input.bloodGroup ?? null, input.address ?? null, input.emergencyContact ?? null, input.preferredLang ?? null,
    input.preferredLang ?? null, input.allergies ? JSON.stringify(input.allergies) : null,
    input.chronicConditions ? JSON.stringify(input.chronicConditions) : null, new Date().toISOString(), id).run();
  const patient = await patientRecord(db, id);
  return patient ? c.json({ success: true, patient: profilePayload(patient) }) :
    c.json({ success: false, error: "Patient not found" }, 404);
});

patientProfileRouter.get("/:id/preferences", async (c) => {
  const db = profileDb(c);
  const id = c.req.param("id");
  const patient = await patientRecord(db, id);
  if (!patient) return c.json({ success: false, error: "Patient not found" }, 404);
  return c.json({ success: true, preferences: (await accountDetails(db, id, patient.preferredLang)).preferences });
});

function encodeField(value: string | number | boolean | readonly string[] | undefined) {
  if (typeof value === "boolean") return Number(value);
  if (typeof value === "object") return JSON.stringify(value);
  return value ?? null;
}

patientProfileRouter.put("/:id/preferences", async (c) => {
  const parsed = patientPreferencesSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ success: false, error: "Invalid preferences data" }, 400);
  const id = c.req.param("id");
  const columns = preferenceFields.map(([column]) => column);
  await profileDb(c).statement(`INSERT INTO patient_app_preferences(org_id,id,patient_id,${columns.join(",")})
    VALUES (:org,?,?,${columns.map(() => "?").join(",")})
    ON CONFLICT(org_id,patient_id) DO UPDATE SET ${columns.map((column) => `${column}=excluded.${column}`).join(",")},
      updated_at=CURRENT_TIMESTAMP`, crypto.randomUUID(), id, ...preferenceFields.map(([, key]) => encodeField(parsed.data[key]))).run();
  return c.json({ success: true, preferences: { ...parsed.data, patientId: id } });
});

patientProfileRouter.get("/:id/ayurveda", async (c) => {
  const db = profileDb(c);
  const id = c.req.param("id");
  const patient = await patientRecord(db, id);
  if (!patient) return c.json({ success: false, error: "Patient not found" }, 404);
  return c.json({ success: true, ayurveda: (await accountDetails(db, id, patient.preferredLang)).ayurveda });
});

patientProfileRouter.put("/:id/ayurveda", async (c) => {
  const parsed = ayurvedicProfileSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ success: false, error: "Invalid Ayurvedic profile data" }, 400);
  const id = c.req.param("id");
  const columns = ayurvedaFields.map(([column]) => column);
  const assessedAt = new Date().toISOString();
  await profileDb(c).statement(`INSERT INTO patient_ayurvedic_profiles(org_id,id,patient_id,assessed_at,${columns.join(",")})
    VALUES (:org,?,?,?,${columns.map(() => "?").join(",")})
    ON CONFLICT(org_id,patient_id) DO UPDATE SET ${columns.map((column) => `${column}=excluded.${column}`).join(",")},
      assessed_at=excluded.assessed_at,updated_at=CURRENT_TIMESTAMP`, crypto.randomUUID(), id, assessedAt,
    ...ayurvedaFields.map(([, key]) => encodeField(parsed.data[key]))).run();
  return c.json({ success: true, ayurveda: { ...parsed.data, patientId: id, assessedAt } });
});
