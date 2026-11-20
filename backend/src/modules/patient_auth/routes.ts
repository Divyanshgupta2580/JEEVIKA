import { Hono } from "hono";
import type { Env } from "../../context";
import { passwordHash, tokenHash, equalHash } from "../../security";
import { tenantDb } from "../../db/tenant";
import { issuePatientSession, revokePatientSession, validatePatientSession } from "../../patient-session";
import {
  patientSignupSchema,
  patientLoginSchema,
  patientProfileUpdateSchema,
  patientPreferencesSchema,
  ayurvedicProfileSchema,
} from "./contracts";
import { patientStore, savePatientToStore, type PatientRecord } from "../../index";

export const patientAuthRouter = new Hono<{ Bindings: Env }>();

// In-memory credential and session caches for seamless multi-tenant local/dev/test execution
interface InMemoryCredential {
  id: string;
  orgId: string;
  patientId: string;
  phoneNumber: string;
  phoneHash: string;
  email?: string;
  passwordSalt: string;
  passwordHash: string;
}

const memoryCredentials = new Map<string, InMemoryCredential>(); // Key: orgId:phoneHash or orgId:email
const memoryPreferences = new Map<string, any>(); // Key: patientId
const memoryAyurveda = new Map<string, any>(); // Key: patientId

function getOrgId(c: any): string {
  return c.req.header("X-Tenant-Id") ?? c.req.header("X-Org-Id") ?? "org_default";
}

// POST /api/v1/auth/patient/signup
patientAuthRouter.post("/signup", async (c) => {
  const orgId = getOrgId(c);
  const rawBody = await c.req.json().catch(() => ({}));
  const parseResult = patientSignupSchema.safeParse(rawBody);

  if (!parseResult.success) {
    return c.json(
      {
        success: false,
        error: "Validation failed",
        issues: parseResult.error.issues,
      },
      400
    );
  }

  const input = parseResult.data;
  const cleanPhone = input.phone.replace(/[\s\-\(\)]/g, "");
  const pHash = await tokenHash(cleanPhone);

  // Check if phone already registered in memory or D1
  const existingCred = memoryCredentials.get(`${orgId}:${pHash}`);
  if (existingCred) {
    return c.json({ success: false, error: "A patient account with this phone number already exists" }, 409);
  }

  const patientId = `pat-${crypto.randomUUID().slice(0, 8)}`;
  const salt = crypto.randomUUID();
  const hash = await passwordHash(input.password, salt);
  const credId = `cred-${crypto.randomUUID().slice(0, 8)}`;

  // Save in memory cache
  const credRecord: InMemoryCredential = {
    id: credId,
    orgId,
    patientId,
    phoneNumber: cleanPhone,
    phoneHash: pHash,
    email: input.email ?? undefined,
    passwordSalt: salt,
    passwordHash: hash,
  };
  memoryCredentials.set(`${orgId}:${pHash}`, credRecord);
  if (input.email) {
    memoryCredentials.set(`${orgId}:${input.email.toLowerCase()}`, credRecord);
  }

  // Create patient record
  const patientData: PatientRecord = {
    id: patientId,
    orgId,
    name: input.name,
    phone: cleanPhone,
    phoneHash: pHash,
    dob: input.dob,
    gender: input.sex,
    preferredLang: input.preferredLang,
    abhaNumber: input.abhaNumber || undefined,
    bloodGroup: input.bloodGroup || undefined,
    emergencyContact: input.emergencyContact || undefined,
    address: input.address || undefined,
    allergies: [],
    chronicConditions: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  savePatientToStore(patientData);

  // Default Preferences
  const defaultPrefs = {
    id: `pref-${patientId}`,
    orgId,
    patientId,
    primaryFocus: "longevity",
    primaryModules: ["prescriptions", "vitalis", "her", "yoga"],
    themeMode: "light",
    colorAccent: "botanical_teal",
    language: input.preferredLang,
    notificationsEnabled: true,
    medicineRemindersEnabled: true,
    cycleRemindersEnabled: true,
    vitalsDriftAlertsEnabled: true,
    biometricLoginEnabled: false,
    reminderMorningTime: "08:00",
    reminderAfternoonTime: "13:00",
    reminderNightTime: "20:30",
  };
  memoryPreferences.set(`${orgId}:${patientId}`, defaultPrefs);

  // Persist to D1 if available
  if (c.env?.DB) {
    try {
      const tDb = tenantDb(c.env.DB as any, { orgId });
      await tDb.patients.create({
        id: patientId,
        name: input.name,
        phoneHash: pHash,
        abhaNumber: input.abhaNumber || null,
        dob: input.dob,
        sex: input.sex,
        preferredLang: input.preferredLang,
      });

      await tDb.patientAuth.createCredentials({
        id: credId,
        patientId,
        phoneNumber: cleanPhone,
        phoneHash: pHash,
        email: input.email || null,
        passwordSalt: salt,
        passwordHash: hash,
      });

      await tDb.patientPreferences.upsert({
        id: defaultPrefs.id,
        patientId,
        primaryFocus: defaultPrefs.primaryFocus,
        primaryModulesJson: JSON.stringify(defaultPrefs.primaryModules),
        themeMode: defaultPrefs.themeMode,
        colorAccent: defaultPrefs.colorAccent,
        language: defaultPrefs.language,
      });
    } catch (e) {
      console.warn("D1 persistence skipped or failed during signup:", e);
    }
  }

  const session = await issuePatientSession(c.env, orgId, patientId);
  if (!session) return c.json({ success: false, error: "Patient session unavailable" }, 503);

  return c.json(
    {
      success: true,
      ...session,
      patient: patientData,
      preferences: defaultPrefs,
      onboardingComplete: false,
    },
    201
  );
});

// POST /api/v1/auth/patient/login
patientAuthRouter.post("/login", async (c) => {
  const orgId = getOrgId(c);
  const rawBody = await c.req.json().catch(() => ({}));
  const parseResult = patientLoginSchema.safeParse(rawBody);

  if (!parseResult.success) {
    return c.json({ success: false, error: "Identifier and password required" }, 400);
  }

  const { identifier, password } = parseResult.data;
  const cleanId = identifier.replace(/[\s\-\(\)]/g, "");
  const pHash = await tokenHash(cleanId);

  // Search credentials in memory or D1
  let cred =
    memoryCredentials.get(`${orgId}:${pHash}`) ||
    memoryCredentials.get(`${orgId}:${cleanId.toLowerCase()}`) ||
    memoryCredentials.get(`${orgId}:${identifier.toLowerCase()}`);

  if (!cred && c.env?.DB) {
    try {
      const tDb = tenantDb(c.env.DB as any, { orgId });
      const d1Cred =
        (await tDb.patientAuth.findCredentialsByPhoneHash(pHash)) ||
        (await tDb.patientAuth.findCredentialsByEmail(identifier.toLowerCase()));
      if (d1Cred) {
        cred = {
          id: d1Cred.id,
          orgId: d1Cred.org_id,
          patientId: d1Cred.patient_id,
          phoneNumber: d1Cred.phone_number,
          phoneHash: d1Cred.phone_hash,
          email: d1Cred.email || undefined,
          passwordSalt: d1Cred.password_salt,
          passwordHash: d1Cred.password_hash,
        };
      }
    } catch (_) {}
  }

  if (!cred) {
    if (password !== "demo" || (c.env && !["development", "test"].includes(c.env.ENVIRONMENT)))
      return c.json({ success: false, error: "Invalid phone number, email, or password" }, 401);
    // If not found as mobile registered, check if this is the demo patient pat-048291 (Ramesh) or pat-048292 (Priya)
    if (cleanId === "pat-048291" || cleanId === "9876543210" || cleanId.includes("048291")) {
      const demoPatient = patientStore.get("pat-048291");
      if (demoPatient) {
        const session = await issuePatientSession(c.env, orgId, "pat-048291", true);
        if (!session) return c.json({ success: false, error: "Patient session unavailable" }, 503);
        return c.json({
          success: true,
          ...session,
          patient: demoPatient,
          preferences: memoryPreferences.get(`${orgId}:${"pat-048291"}`) || {
            primaryFocus: "longevity",
            primaryModules: ["prescriptions", "vitalis", "her", "yoga"],
            themeMode: "light",
            language: "hi",
          },
          onboardingComplete: true,
        });
      }
    }

    if (
      cleanId === "pat-048292" ||
      cleanId === "9811122334" ||
      cleanId === "9123456780" ||
      cleanId.includes("048292") ||
      cleanId.toLowerCase().includes("priya")
    ) {
      const demoPatient = patientStore.get("pat-048292") || patientStore.get("91-5910-2941-8402") || patientStore.get("9811122334");
      if (demoPatient) {
        const session = await issuePatientSession(c.env, orgId, demoPatient.id, true);
        if (!session) return c.json({ success: false, error: "Patient session unavailable" }, 503);
        return c.json({
          success: true,
          ...session,
          patient: demoPatient,
          preferences: memoryPreferences.get(`${orgId}:${demoPatient.id}`) || {
            primaryFocus: "digestive_wellness",
            primaryModules: ["prescriptions", "vitalis", "her", "yoga"],
            themeMode: "light",
            language: "hi",
          },
          onboardingComplete: true,
        });
      }
    }
    return c.json({ success: false, error: "Invalid phone number, email, or password" }, 401);
  }

  // Validate password
  const computedHash = await passwordHash(password, cred.passwordSalt);
  if (!equalHash(computedHash, cred.passwordHash)) {
    return c.json({ success: false, error: "Invalid phone number, email, or password" }, 401);
  }

  // Get patient profile
  let patient = patientStore.get(cred.patientId);
  if (!patient && c.env?.DB) {
    try {
      const tDb = tenantDb(c.env.DB as any, { orgId });
      const d1p = await tDb.patients.findById(cred.patientId);
      if (d1p) {
        patient = {
          id: d1p.id,
          name: d1p.name || "Jeevika Patient",
          phone: cred.phoneNumber,
          phoneHash: d1p.phone_hash,
          dob: d1p.dob || "1990-01-01",
          sex: d1p.sex || "OTHER",
          preferredLang: d1p.preferred_lang || "hi",
          bloodGroup: d1p.blood_group || null,
          emergencyContact: d1p.emergency_contact || null,
          address: d1p.address || null,
          allergies: [],
          chronicConditions: [],
          createdAt: d1p.created_at,
        };
        savePatientToStore(patient);
      }
    } catch (_) {}
  }

  const session = await issuePatientSession(c.env, orgId, cred.patientId);
  if (!session) return c.json({ success: false, error: "Patient session unavailable" }, 503);
  if (c.env?.DB) {
    try {
      await tenantDb(c.env.DB as unknown as D1Database, { orgId }).patientAuth.updateLastLogin(cred.patientId);
    } catch (_) {}
  }

  const prefs = memoryPreferences.get(`${orgId}:${cred.patientId}`) || {
    primaryFocus: "longevity",
    primaryModules: ["prescriptions", "vitalis", "her", "yoga"],
    themeMode: "light",
    language: patient?.preferredLang || "hi",
  };

  const ayurveda = memoryAyurveda.get(`${orgId}:${cred.patientId}`) || null;

  return c.json({
    success: true,
    ...session,
    patient,
    preferences: prefs,
    ayurveda,
    onboardingComplete: !!ayurveda,
  });
});

// POST /api/v1/auth/patient/logout
patientAuthRouter.post("/logout", async (c) => {
  const authorization = c.req.header("Authorization") ?? "";
  if (authorization.startsWith("Bearer ")) {
    try {
      await revokePatientSession(c.env, authorization.slice(7));
    } catch {
      return c.json({ success: false, error: "Patient session could not be revoked" }, 503);
    }
  }
  return c.json({ success: true, message: "Logged out successfully" });
});

// GET /api/v1/auth/patient/me
patientAuthRouter.get("/me", async (c) => {
  const authorization = c.req.header("Authorization") ?? "";
  const session = authorization.startsWith("Bearer ")
    ? await validatePatientSession(c.env, authorization.slice(7))
    : null;
  if (!session) return c.json({ success: false, error: "Session invalid or expired" }, 401);

  const record = patientStore.get(session.patientId);
  const patient = record?.orgId === session.orgId ? record : undefined;
  const prefs = memoryPreferences.get(`${session.orgId}:${session.patientId}`) || {
    primaryFocus: "longevity",
    primaryModules: ["prescriptions", "vitalis", "her", "yoga"],
    themeMode: "light",
    language: "hi",
  };
  const ayurveda = memoryAyurveda.get(`${session.orgId}:${session.patientId}`) || null;

  return c.json({
    success: true,
    patientId: session.patientId,
    expiresAt: session.expiresAt,
    patient,
    preferences: prefs,
    ayurveda,
    onboardingComplete: !!ayurveda,
  });
});

// Patient Personalization & Customization Routes
export const patientProfileRouter = new Hono<{
  Bindings: Env;
  Variables: { patientOrgId: string };
}>();
patientProfileRouter.use("/:id/*", async (c, next) => {
  const authorization = c.req.header("Authorization") ?? "";
  const session = authorization.startsWith("Bearer ")
    ? await validatePatientSession(c.env, authorization.slice(7))
    : null;
  if (!session) return c.json({ success: false, error: "Session invalid or expired" }, 401);
  if (c.req.param("id") !== session.patientId)
    return c.json({ success: false, error: "Patient access denied" }, 403);
  c.set("patientOrgId", session.orgId);
  await next();
});

// GET /api/v1/patient/:id/profile
patientProfileRouter.get("/:id/profile", async (c) => {
  const patientId = c.req.param("id");
  let patient = patientStore.get(patientId);
  if (!patient || patient.orgId !== c.get("patientOrgId")) return c.json({ success: false, error: "Patient not found" }, 404);
  return c.json({ success: true, patient });
});

// PUT /api/v1/patient/:id/profile
patientProfileRouter.put("/:id/profile", async (c) => {
  const patientId = c.req.param("id");
  const rawBody = await c.req.json().catch(() => ({}));
  const parseResult = patientProfileUpdateSchema.safeParse(rawBody);

  if (!parseResult.success) {
    return c.json({ success: false, error: "Invalid profile data", issues: parseResult.error.issues }, 400);
  }

  const input = parseResult.data;
  let patient = patientStore.get(patientId);
  if (patient && patient.orgId !== c.get("patientOrgId")) {
    return c.json({ success: false, error: "Patient not found" }, 404);
  }
  if (patient) {
    const updated = {
      ...patient,
      name: input.name ?? patient.name,
      dob: input.dob ?? patient.dob,
      sex: input.sex ?? patient.sex,
      bloodGroup: input.bloodGroup ?? patient.bloodGroup,
      address: input.address ?? patient.address,
      emergencyContact: input.emergencyContact ?? patient.emergencyContact,
      allergies: input.allergies ?? patient.allergies,
      chronicConditions: input.chronicConditions ?? patient.chronicConditions,
      preferredLang: input.preferredLang ?? patient.preferredLang,
    };
    savePatientToStore(updated);
    patient = updated;
  }

  return c.json({ success: true, patient });
});

// GET /api/v1/patient/:id/preferences
patientProfileRouter.get("/:id/preferences", async (c) => {
  const patientId = c.req.param("id");
  const prefs = memoryPreferences.get(`${c.get("patientOrgId")}:${patientId}`) || {
    primaryFocus: "longevity",
    primaryModules: ["prescriptions", "vitalis", "her", "yoga"],
    themeMode: "light",
    colorAccent: "botanical_teal",
    language: "hi",
    notificationsEnabled: true,
    medicineRemindersEnabled: true,
    cycleRemindersEnabled: true,
    vitalsDriftAlertsEnabled: true,
    biometricLoginEnabled: false,
    reminderMorningTime: "08:00",
    reminderAfternoonTime: "13:00",
    reminderNightTime: "20:30",
  };
  return c.json({ success: true, preferences: prefs });
});

// PUT /api/v1/patient/:id/preferences
patientProfileRouter.put("/:id/preferences", async (c) => {
  const patientId = c.req.param("id");
  const rawBody = await c.req.json().catch(() => ({}));
  const parseResult = patientPreferencesSchema.safeParse(rawBody);

  if (!parseResult.success) {
    return c.json({ success: false, error: "Invalid preferences data", issues: parseResult.error.issues }, 400);
  }

  const existing = memoryPreferences.get(`${c.get("patientOrgId")}:${patientId}`) || {};
  const updated = { ...existing, ...parseResult.data, patientId };
  memoryPreferences.set(`${c.get("patientOrgId")}:${patientId}`, updated);

  if (c.env?.DB) {
    try {
      const orgId = c.get("patientOrgId");
      const tDb = tenantDb(c.env.DB as any, { orgId });
      await tDb.patientPreferences.upsert({
        id: `pref-${patientId}`,
        patientId,
        primaryFocus: updated.primaryFocus,
        primaryModulesJson: JSON.stringify(updated.primaryModules),
        themeMode: updated.themeMode,
        colorAccent: updated.colorAccent,
        language: updated.language,
        notificationsEnabled: updated.notificationsEnabled ? 1 : 0,
        medicineRemindersEnabled: updated.medicineRemindersEnabled ? 1 : 0,
        reminderMorningTime: updated.reminderMorningTime,
        reminderAfternoonTime: updated.reminderAfternoonTime,
        reminderNightTime: updated.reminderNightTime,
      });
    } catch (_) {}
  }

  return c.json({ success: true, preferences: updated });
});

// GET /api/v1/patient/:id/ayurveda
patientProfileRouter.get("/:id/ayurveda", async (c) => {
  const patientId = c.req.param("id");
  const ayurveda = memoryAyurveda.get(`${c.get("patientOrgId")}:${patientId}`) || null;
  return c.json({ success: true, ayurveda });
});

// PUT /api/v1/patient/:id/ayurveda
patientProfileRouter.put("/:id/ayurveda", async (c) => {
  const patientId = c.req.param("id");
  const rawBody = await c.req.json().catch(() => ({}));
  const parseResult = ayurvedicProfileSchema.safeParse(rawBody);

  if (!parseResult.success) {
    return c.json({ success: false, error: "Invalid Ayurvedic profile data", issues: parseResult.error.issues }, 400);
  }

  const data = parseResult.data;
  const updated = {
    ...data,
    patientId,
    assessedAt: new Date().toISOString(),
  };
  memoryAyurveda.set(`${c.get("patientOrgId")}:${patientId}`, updated);

  if (c.env?.DB) {
    try {
      const orgId = c.get("patientOrgId");
      const tDb = tenantDb(c.env.DB as any, { orgId });
      await tDb.patientAyurveda.upsert({
        id: `ayur-${patientId}`,
        patientId,
        primaryDosha: data.primaryDosha,
        secondaryDosha: data.secondaryDosha,
        prakritiSummary: data.prakritiSummary,
        vikritiAggravation: data.vikritiAggravation,
        agniType: data.agniType,
        koshthaType: data.koshthaType,
        dietaryGuidelinesJson: JSON.stringify(data.dietaryGuidelines),
        yogaRecommendationsJson: JSON.stringify(data.yogaRecommendations),
      });
    } catch (_) {}
  }

  return c.json({ success: true, ayurveda: updated });
});
