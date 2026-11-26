import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import { driftRadar, sentinel } from "../../../../packages/engine";
import { getClinicalRedFlags } from "../../../../packages/engine/clinicalIntake";
import {
  herCycleDetector,
  herCyclePhaseDetector,
} from "../../../../packages/engine/her/cycle_detector";
import {
  vitalisHealthspanIndex,
  type HealthspanIndexInput,
} from "../../../../packages/engine/vitalis/v1_healthspan_index";
import { herSafetyGate } from "../../../../packages/engine/her/safety_gate";
import { herWellnessRanker } from "../../../../packages/engine/her/wellness_ranker";
import {
  checkInSchema,
  consentVersion,
  demoPatientIdentity,
  interceptorQuestions,
  kioskIntakeSchema,
  needsStemiQuestions,
  patientLanguages,
} from "../../../../packages/shared/patient-experience";
import type { Env } from "../../context";
import { tenantDb } from "../../database";
import {
  issuePatientSession,
  validatePatientSession,
} from "../../patient-session";
import { tokenHash } from "../../security";
import { clinicalOriginAllowed } from "../../staff-session";
import { kioskSpeech } from "./kiosk-speech";

const demoScope = {
  orgId: "demo",
  clinicId: "north",
  patientId: "phase5-synthetic-patient",
};
const isDemo = (env: Env | undefined) =>
  Boolean(
    env?.DB &&
      (["development", "test", "demo"].includes(env.ENVIRONMENT) ||
        env.DEMO_MODE === "true"),
  );
const day = (date = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(date);
const boundedBody = bodyLimit({ maxSize: 16000 });

async function input<T>(request: Request, schema: z.ZodType<T>) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    throw new HTTPException(400, { message: "Check the submitted fields." });
  return parsed.data;
}

const otpStart = z.strictObject({
  method: z.enum(["abha", "mobile"]),
  identifier: z.string().regex(/^\d{10}$|^\d{14}$/),
  purpose: z.enum(["home", "kiosk"]),
});
const otpVerify = z.strictObject({
  id: z.uuid(),
  code: z.string().regex(/^\d{6}$/),
  purpose: z.enum(["home", "kiosk"]),
});

export const patientOtpRouter = new Hono<{ Bindings: Env }>();
patientOtpRouter.use("*", boundedBody);
patientOtpRouter.get("/capabilities", (c) =>
  c.json({
    demoOtp: isDemo(c.env),
    registration: isDemo(c.env) ? "demo-only" : "unavailable",
  }),
);
patientOtpRouter.post("/start", async (c) => {
  if (!isDemo(c.env) || !clinicalOriginAllowed(c.req.raw, c.env))
    throw new HTTPException(503, { message: "OTP provider unavailable." });
  const body = await input(c.req.raw, otpStart);
  if (demoPatientIdentity[body.method] !== body.identifier)
    throw new HTTPException(400, {
      message: "Use the synthetic identifier shown in this demo.",
    });
  const id = crypto.randomUUID();
  const code = Array.from(crypto.getRandomValues(new Uint32Array(6)), (value) =>
    String(value % 10),
  ).join("");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 10 * 60_000).toISOString();
  const db = tenantDb({ db: c.env.DB, orgId: demoScope.orgId });
  const created = await db
    .statement(
      `WITH tenant(org_id) AS (SELECT :org)
     INSERT INTO patient_otp_challenges (org_id,id,purpose,code_hash,expires_at,remaining)
     SELECT tenant.org_id,?,?,?,?,5 FROM tenant WHERE (
       SELECT COUNT(*) FROM patient_otp_challenges p WHERE p.org_id=tenant.org_id AND p.expires_at > ?
     ) < 60 RETURNING id`,
      id,
      body.purpose,
      await tokenHash(`${id}:${code}`),
      expiresAt,
      now.toISOString(),
    )
    .first();
  if (!created)
    throw new HTTPException(429, { message: "Try again in a few minutes." });
  c.header("Cache-Control", "no-store");
  return c.json({ id, expiresAt, demoCode: code }, 201);
});

patientOtpRouter.post("/verify", async (c) => {
  if (!isDemo(c.env) || !clinicalOriginAllowed(c.req.raw, c.env))
    throw new HTTPException(503, { message: "OTP provider unavailable." });
  const body = await input(c.req.raw, otpVerify);
  const now = new Date().toISOString();
  const hash = await tokenHash(`${body.id}:${body.code}`);
  const db = tenantDb({ db: c.env.DB, orgId: demoScope.orgId });
  const verified = await db
    .statement(
      `UPDATE patient_otp_challenges
     SET remaining=remaining-1, verified_at=CASE WHEN code_hash=? THEN ? ELSE NULL END
     WHERE org_id=:org AND id=? AND purpose=? AND remaining>0 AND expires_at>? AND verified_at IS NULL
     RETURNING verified_at`,
      hash,
      now,
      body.id,
      body.purpose,
      now,
    )
    .first<{ verified_at: string | null }>();
  if (!verified?.verified_at)
    throw new HTTPException(401, { message: "Code invalid or expired." });
  c.header("Cache-Control", "no-store");
  if (body.purpose === "kiosk")
    return c.json({ verifiedIdentityId: body.id, simulated: true });
  await provisionDemoPatient(db);
  const session = await issuePatientSession(
    c.env,
    demoScope.orgId,
    demoScope.patientId,
    false,
    true,
  );
  if (!session)
    throw new HTTPException(503, { message: "Patient session unavailable." });
  return c.json({
    ...session,
    patientId: demoScope.patientId,
    simulated: true,
  });
});

async function provisionDemoPatient(db: ReturnType<typeof tenantDb>) {
  await db
    .statement(
      `INSERT INTO patients (org_id,id,name,birth_date,gender,language,synthetic)
    VALUES (:org,?,'Synthetic patient','1980-01-01','other','en-IN',1)
    ON CONFLICT(org_id,id) DO NOTHING`,
      demoScope.patientId,
    )
    .run();
}

export const kioskRouter = new Hono<{ Bindings: Env }>();
kioskRouter.use("*", boundedBody);
kioskRouter.get("/speech/:locale/:prompt", kioskSpeech);
kioskRouter.get("/capabilities", (c) =>
  c.json({ intakeAvailable: isDemo(c.env), simulatedIdentity: isDemo(c.env) }),
);
kioskRouter.post("/intake", async (c) => {
  if (!isDemo(c.env) || !clinicalOriginAllowed(c.req.raw, c.env))
    throw new HTTPException(503, {
      message:
        "Kiosk intake is unavailable. Please contact the reception desk.",
    });
  const key = z.uuid().safeParse(c.req.header("Idempotency-Key"));
  if (!key.success)
    throw new HTTPException(400, { message: "Invalid intake reference." });
  const data = await input(c.req.raw, kioskIntakeSchema);
  const { orgId, clinicId } = demoScope;
  const { consent, complaint, description, verifiedIdentityId } = data;
  const db = tenantDb({ db: c.env.DB, orgId });
  const requestHash = await tokenHash(JSON.stringify(data));
  const find = () =>
    db
      .statement(
        `SELECT request_hash,receipt_id,token_number,created_at FROM kiosk_intakes
     WHERE org_id=:org AND clinic_id=? AND request_id=?`,
        clinicId,
        key.data,
      )
      .first<{
        request_hash: string;
        receipt_id: string;
        token_number: string;
        created_at: string;
      }>();
  const reply = (
    record: NonNullable<Awaited<ReturnType<typeof find>>>,
    status: 200 | 201,
  ) => {
    if (record.request_hash !== requestHash)
      throw new HTTPException(409, {
        message: "This intake reference was already used.",
      });
    c.header("Cache-Control", "no-store");
    const triage = record.token_number.startsWith("EMERG")
      ? "emergency"
      : record.token_number.startsWith("PRIORITY")
        ? "priority"
        : "routine";
    return c.json(
      {
        token: record.token_number,
        receiptId: record.receipt_id,
        createdAt: record.created_at,
        triage,
      },
      status,
    );
  };
  const existing = await find();
  if (existing) return reply(existing, 200);

  const urgentHelp = data.intent === "urgent-help";
  const consented = consent.care && !urgentHelp;
  if (!urgentHelp && !complaint)
    throw new HTTPException(400, {
      message: "Choose the reason for your visit.",
    });
  const flags = getClinicalRedFlags(description);
  const answers = { ...data.answers };
  if (complaint === "chest" || flags.includes("chest_pain"))
    answers.chestPain = "yes";
  if (flags.includes("breathlessness")) answers.breathless = "yes";
  if (flags.includes("fainting")) answers.fainting = "yes";
  const result = sentinel({ answers });
  const stemi = needsStemiQuestions(complaint ?? "", description);
  const positive =
    stemi &&
    interceptorQuestions.some((field) => data.interceptor[field] === "yes");
  const emergency = urgentHelp || positive || result.tier === "emergency";
  if (
    !emergency &&
    stemi &&
    interceptorQuestions.some((field) => data.interceptor[field] === undefined)
  )
    throw new HTTPException(400, {
      message: "Finish the chest safety questions.",
    });
  if (!emergency && result.nextQuestion)
    throw new HTTPException(400, { message: "Finish the symptom questions." });
  const priority =
    [answers.chestPain, answers.breathless, answers.fainting].includes(
      "unsure",
    ) ||
    (stemi &&
      interceptorQuestions.some(
        (field) => data.interceptor[field] === "unsure",
      ));
  const prefix = emergency ? "EMERG-" : priority ? "PRIORITY-" : "OPD-";
  const date = new Date();
  const now = date.toISOString();
  const serviceDate = day(date);
  if (verifiedIdentityId && consented) {
    const proof = await db
      .statement(
        "SELECT id FROM patient_otp_challenges WHERE org_id=:org AND id=? AND purpose='kiosk' AND verified_at IS NOT NULL AND expires_at>?",
        verifiedIdentityId,
        now,
      )
      .first();
    if (!proof)
      throw new HTTPException(403, {
        message:
          "The identity check expired. Verify again or continue as a walk-in.",
      });
    await provisionDemoPatient(db);
  }
  const patientId =
    verifiedIdentityId && consented ? demoScope.patientId : crypto.randomUUID();
  const encounter = crypto.randomUUID();
  const receipt = crypto.randomUUID();
  const summary = consented
    ? String(complaint)
    : emergency
      ? "Anonymous urgent request"
      : "Anonymous walk-in";
  const consentJson = consented
    ? JSON.stringify(consent)
    : JSON.stringify({
        care: false,
        pharmacy: false,
        remote: false,
        research: false,
        guardian: false,
      });
  try {
    await db.batch([
      db.statement(
        `INSERT INTO clinic_token_sequences(org_id,clinic_id,service_date,last_value) VALUES(:org,?,?,1)
        ON CONFLICT(org_id,clinic_id,service_date) DO UPDATE SET last_value=last_value+1`,
        clinicId,
        serviceDate,
      ),
      ...(patientId === demoScope.patientId
        ? []
        : [
            db.statement(
              `INSERT INTO patients (org_id,id,name,birth_date,gender,language,synthetic)
         VALUES (:org,?,'Walk-in patient','','other',?,1)`,
              patientId,
              patientLanguages[data.locale][1],
            ),
          ]),
      db.statement(
        `INSERT INTO encounters
        (org_id,id,patient_id,clinic_id,chief_complaint,answers_json,red_flags_json,status,created_at) VALUES (:org,?,?,?,?,?,?,?,?)`,
        encounter,
        patientId,
        clinicId,
        summary,
        JSON.stringify(consented ? answers : {}),
        JSON.stringify(emergency ? ["kiosk_urgent_intake"] : []),
        emergency ? "emergency" : "waiting",
        now,
      ),
      db.statement(
        `INSERT INTO consents (org_id,patient_id,encounter_id,purpose,granted_at,revoked_at)
        VALUES (:org,?,?,'care',?,?)`,
        patientId,
        encounter,
        now,
        consented ? null : now,
      ),
      db.statement(
        `INSERT INTO kiosk_intakes (org_id,clinic_id,request_id,request_hash,encounter_id,receipt_id,token_number,consent_version,consent_json,identity_id,document_text,complaint_text,created_at)
        SELECT org_id,?,?,?,?,?,? || printf('%03d',last_value),?,?,?,?,?,?
        FROM clinic_token_sequences WHERE org_id=:org AND clinic_id=? AND service_date=?`,
        clinicId,
        key.data,
        requestHash,
        encounter,
        receipt,
        prefix,
        consentVersion,
        consentJson,
        consented ? (verifiedIdentityId ?? null) : null,
        consented ? (data.documentText ?? null) : null,
        consented ? description || null : null,
        now,
        clinicId,
        serviceDate,
      ),
    ]);
  } catch (failure) {
    const winner = await find();
    if (winner) return reply(winner, 200);
    if (
      failure instanceof Error &&
      failure.message.includes("KIOSK_RATE_LIMIT")
    )
      throw new HTTPException(429, {
        message: "Kiosk is busy. Ask reception for help.",
      });
    throw new HTTPException(503, {
      message: "Unable to issue a token. Please contact the reception desk.",
    });
  }
  const committed = await find();
  if (!committed)
    throw new HTTPException(503, { message: "Intake could not be confirmed." });
  return reply(committed, 201);
});

type CompanionContext = {
  Bindings: Env;
  Variables: { patient: { orgId: string; patientId: string } };
};
export const companionRouter = new Hono<CompanionContext>();
companionRouter.use("*", boundedBody, async (c, next) => {
  const header = c.req.header("Authorization");
  const patient = header?.startsWith("Bearer ")
    ? await validatePatientSession(c.env, header.slice(7))
    : null;
  if (!patient || !c.env?.DB)
    throw new HTTPException(401, {
      message: "Sign in as a patient to continue.",
    });
  if (c.req.method !== "GET" && !clinicalOriginAllowed(c.req.raw, c.env))
    throw new HTTPException(403);
  c.set("patient", patient);
  c.header("Cache-Control", "no-store");
  await next();
});

const rxSelect = `SELECT r.id, r.signed_at, s.brand AS medicine, l.units, l.directions, l.course_end,
  EXISTS (SELECT 1 FROM reservations v WHERE v.org_id=r.org_id AND v.prescription_id=r.id AND v.status='dispensed') AS dispensed
  FROM signed_prescriptions r JOIN encounters e ON e.org_id=r.org_id AND e.id=r.encounter_id
  JOIN consents c ON c.org_id=e.org_id AND c.encounter_id=e.id AND c.purpose='care' AND c.revoked_at IS NULL
  JOIN prescription_lines l ON l.org_id=r.org_id AND l.prescription_id=r.id
  JOIN sku s ON s.org_id=r.org_id AND s.id=l.sku_id
  WHERE e.org_id=:org AND e.patient_id=? ORDER BY r.signed_at DESC LIMIT 50`;

companionRouter.get("/thread", async (c) => {
  const { orgId, patientId } = c.get("patient");
  const db = tenantDb({ db: c.env.DB, orgId });
  const [visits, checks, signed] = await Promise.all([
    db
      .statement(
        `SELECT e.id,e.status,e.created_at,e.reviewed_at,k.token_number FROM encounters e
      JOIN consents c ON c.org_id=e.org_id AND c.encounter_id=e.id AND c.purpose='care' AND c.revoked_at IS NULL
      LEFT JOIN kiosk_intakes k ON k.org_id=e.org_id AND k.encounter_id=e.id
      WHERE e.org_id=:org AND e.patient_id=? ORDER BY e.created_at DESC LIMIT 50`,
        patientId,
      )
      .all<{
        id: string;
        created_at: string;
        reviewed_at: string | null;
        token_number: string | null;
      }>(),
    db
      .statement(
        "SELECT day,created_at FROM patient_check_ins WHERE org_id=:org AND patient_id=? ORDER BY day DESC LIMIT 50",
        patientId,
      )
      .all<{ day: string; created_at: string }>(),
    db
      .statement(
        `SELECT DISTINCT r.id,r.signed_at
      FROM signed_prescriptions r JOIN encounters e ON e.org_id=r.org_id AND e.id=r.encounter_id
      JOIN consents c ON c.org_id=e.org_id AND c.encounter_id=e.id AND c.purpose='care' AND c.revoked_at IS NULL
      WHERE e.org_id=:org AND e.patient_id=? ORDER BY r.signed_at DESC LIMIT 50`,
        patientId,
      )
      .all<{ id: string; signed_at: string }>(),
  ]);
  const events = [
    ...visits.results.flatMap((visit) => [
      {
        id: visit.id,
        title: visit.token_number ? "Kiosk intake" : "Clinic intake",
        source: visit.token_number ? "Kiosk" : "Clinic",
        occurredAt: visit.created_at,
      },
      ...(visit.reviewed_at
        ? [
            {
              id: `${visit.id}-review`,
              title: "Consultation reviewed",
              source: "Clinic",
              occurredAt: visit.reviewed_at,
            },
          ]
        : []),
    ]),
    ...checks.results.map((check) => ({
      id: check.day,
      title: "Daily check-in",
      source: "Patient",
      occurredAt: check.created_at,
    })),
    ...signed.results.map((rx) => ({
      id: rx.id,
      title: "Prescription signed",
      source: "Pharmacy record",
      occurredAt: rx.signed_at,
    })),
  ]
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, 80);
  return c.json({
    events,
    nextAction: checks.results.some((check) => check.day === day())
      ? null
      : "check-in",
  });
});

companionRouter.get("/prescriptions", async (c) => {
  const { orgId, patientId } = c.get("patient");
  const { results } = await tenantDb({ db: c.env.DB, orgId })
    .statement(rxSelect, patientId)
    .all();
  return c.json({ prescriptions: results, refillReservationsAvailable: false });
});

companionRouter.post("/check-in", async (c) => {
  const { orgId, patientId } = c.get("patient");
  const record = await input(c.req.raw, checkInSchema);
  const now = new Date();
  const saved = await tenantDb({ db: c.env.DB, orgId })
    .statement(
      `INSERT INTO patient_check_ins (org_id,patient_id,day,created_at,observations_json) VALUES (:org,?,?,?,?)
     ON CONFLICT(org_id,patient_id,day) DO NOTHING RETURNING day`,
      patientId,
      day(now),
      now.toISOString(),
      JSON.stringify(record),
    )
    .first();
  if (!saved)
    throw new HTTPException(409, {
      message: "Today's check-in was already saved.",
    });
  return c.json(
    {
      saved: true,
      urgent:
        record.distress ||
        (record.systolic ?? 0) >= 180 ||
        (record.spo2 ?? 100) <= 90,
    },
    201,
  );
});

companionRouter.get("/drift", async (c) => {
  const { orgId, patientId } = c.get("patient");
  const { results } = await tenantDb({ db: c.env.DB, orgId })
    .statement(
      "SELECT day,observations_json FROM patient_check_ins WHERE org_id=:org AND patient_id=? ORDER BY day DESC LIMIT 60",
      patientId,
    )
    .all<{ day: string; observations_json: string }>();
  const records = results.reverse().map(({ day, observations_json }) => ({
    day,
    reading: checkInSchema.parse(JSON.parse(observations_json)),
  }));
  const startDay = records.length ? Date.parse(records[0]?.day ?? "") : 0;
  const readings = records.flatMap(({ day, reading }) =>
    reading.systolic === undefined ||
    reading.systolic < 60 ||
    reading.systolic > 250
      ? []
      : [
          {
            day: Math.round((Date.parse(day) - startDay) / 86_400_000),
            value: reading.systolic,
          },
        ],
  );
  const latest = records.at(-1)?.reading;
  const urgent = Boolean(
    latest &&
      (latest.distress ||
        (latest.systolic ?? 0) >= 180 ||
        (latest.spo2 ?? 100) <= 90),
  );
  const drift = readings.length >= 7 ? driftRadar({ readings }) : null;
  return c.json({
    readings: records.map(({ day, reading }) => ({
      day,
      systolic: reading.systolic,
      spo2: reading.spo2,
    })),
    baseline: drift?.baseline ?? null,
    alert: drift?.alert ?? false,
    urgent,
  });
});

const confirmedDay = z.iso
  .date()
  .refine((date) => date <= day(), "Use today or an earlier date.");
const herLog = z.strictObject({
  date: confirmedDay,
  flow: z.enum(["none", "light", "medium", "heavy"]),
  pain: z.number().int().min(0).max(10),
  mood: z.string().trim().max(60),
  periodStarted: z.boolean().default(false),
  periodLength: z.number().int().min(2).max(10).optional(),
});

companionRouter.get("/her", async (c) => {
  const { orgId, patientId } = c.get("patient");
  const db = tenantDb({ db: c.env.DB, orgId });
  const consent = await db
    .statement(
      `SELECT granted,revoked_at FROM her_consents WHERE org_id=:org AND patient_id=? AND consent_type='symptom_tracking'
     ORDER BY granted_at DESC,id DESC LIMIT 1`,
      patientId,
    )
    .first<{ granted: number; revoked_at: string | null }>();
  if (!consent?.granted || consent.revoked_at)
    return c.json({ consent: false, records: [], cycle: null });
  const records = await db
    .statement(
      "SELECT id,log_date,pelvic_pain,mood,tags_json FROM her_symptoms WHERE org_id=:org AND patient_id=? ORDER BY log_date DESC,created_at DESC LIMIT 30",
      patientId,
    )
    .all<{
      id: string;
      log_date: string;
      pelvic_pain: number;
      mood: string;
      tags_json: string;
    }>();
  const [cycles, profile] = await Promise.all([
    db
      .statement(
        "SELECT start_date,period_length_days FROM her_cycles WHERE org_id=:org AND patient_id=? ORDER BY start_date DESC LIMIT 12",
        patientId,
      )
      .all<{ start_date: string; period_length_days: number | null }>(),
    db
      .statement(
        "SELECT is_pregnant_or_lactating,hormonal_contraception FROM her_profiles WHERE org_id=:org AND patient_id=?",
        patientId,
      )
      .first<{
        is_pregnant_or_lactating: number;
        hormonal_contraception: number;
      }>(),
  ]);
  const last = cycles.results[0];
  const summary = herCycleDetector({
    dates: cycles.results.map(({ start_date }) => start_date),
    isPregnantOrLactating: Boolean(profile?.is_pregnant_or_lactating),
    hormonalContraception: Boolean(profile?.hormonal_contraception),
  });
  const phase =
    last?.period_length_days &&
    summary.medianLengthDays &&
    summary.status === "ADEQUATE_DATA"
      ? herCyclePhaseDetector({
          lastPeriodStartDate: last.start_date,
          periodLengthDays: last.period_length_days,
          cycleLengthDays: Math.round(summary.medianLengthDays),
          targetDate: day(),
        }).phaseTitle
      : null;
  return c.json({
    consent: true,
    records: records.results.map(({ tags_json, ...record }) => ({
      ...record,
      tags: JSON.parse(tags_json),
    })),
    cycle: {
      lastStart: last?.start_date ?? null,
      phase,
      status: summary.status,
      irregular: summary.hasIrregularity,
    },
  });
});

companionRouter.post("/her/consent", async (c) => {
  const { orgId, patientId } = c.get("patient");
  const { granted } = await input(
    c.req.raw,
    z.strictObject({ granted: z.boolean() }),
  );
  const at = new Date().toISOString();
  await tenantDb({ db: c.env.DB, orgId })
    .statement(
      "INSERT INTO her_consents (org_id,id,patient_id,consent_type,granted,granted_at,revoked_at) VALUES (:org,?,?,'symptom_tracking',?,?,?)",
      crypto.randomUUID(),
      patientId,
      Number(granted),
      at,
      granted ? null : at,
    )
    .run();
  return c.json({ consent: granted });
});

companionRouter.post("/her", async (c) => {
  const { orgId, patientId } = c.get("patient");
  const body = await input(c.req.raw, herLog);
  const db = tenantDb({ db: c.env.DB, orgId });
  const activeConsent = `1=(SELECT CASE WHEN revoked_at IS NULL THEN granted ELSE 0 END
    FROM her_consents h WHERE h.org_id=tenant.org_id AND h.patient_id=? AND h.consent_type='symptom_tracking'
    ORDER BY granted_at DESC,id DESC LIMIT 1)`;
  const [saved] = await db.batch([
    db.statement(
      `WITH tenant(org_id) AS (SELECT :org)
       INSERT INTO her_symptoms (org_id,id,patient_id,log_date,pelvic_pain,mood,tags_json)
       SELECT tenant.org_id,?,?,?,?,?,? FROM tenant WHERE ${activeConsent}`,
      crypto.randomUUID(),
      patientId,
      body.date,
      body.pain,
      body.mood,
      JSON.stringify([body.flow]),
      patientId,
    ),
    ...(body.periodStarted
      ? [
          db.statement(
            `WITH tenant(org_id) AS (SELECT :org)
      INSERT INTO her_cycles (org_id,id,patient_id,start_date,period_length_days,flow_intensity)
      SELECT tenant.org_id,?,?,?,?,? FROM tenant WHERE ${activeConsent}
      AND NOT EXISTS (SELECT 1 FROM her_cycles h WHERE h.org_id=tenant.org_id AND h.patient_id=? AND h.start_date=?)`,
            crypto.randomUUID(),
            patientId,
            body.date,
            body.periodLength ?? null,
            body.flow,
            patientId,
            patientId,
            body.date,
          ),
        ]
      : []),
  ]);
  if (!saved?.meta.changes)
    throw new HTTPException(403, {
      message: "Enable HER symptom tracking before saving.",
    });
  const profile = await db
    .statement(
      "SELECT is_pregnant_or_lactating FROM her_profiles WHERE org_id=:org AND patient_id=?",
      patientId,
    )
    .first<{ is_pregnant_or_lactating: number }>();
  const safety = herSafetyGate({
    pelvicPainSeverity: body.pain,
    isPregnantOrPossible: Boolean(profile?.is_pregnant_or_lactating),
  });
  return c.json({ saved: true, urgent: safety.isUrgent }, 201);
});

const vitalisMetrics = {
  resting_heart_rate: { name: "Resting heart rate", unit: "bpm" },
  sleep_duration: { name: "Sleep duration", unit: "hours" },
  activity_minutes: { name: "Activity", unit: "minutes" },
} as const;
const vitalisValue = z.discriminatedUnion("metric", [
  z.strictObject({
    metric: z.literal("resting_heart_rate"),
    value: z.number().int().min(25).max(250),
  }),
  z.strictObject({
    metric: z.literal("sleep_duration"),
    value: z.number().min(0).max(24),
  }),
  z.strictObject({
    metric: z.literal("activity_minutes"),
    value: z.number().int().min(0).max(1440),
  }),
]);

companionRouter.get("/vitalis", async (c) => {
  const { orgId, patientId } = c.get("patient");
  const db = tenantDb({ db: c.env.DB, orgId });
  const consent = await db
    .statement(
      "SELECT vitalis_health_data,revoked_at FROM vitalis_consents WHERE org_id=:org AND patient_id=? ORDER BY granted_at DESC,id DESC LIMIT 1",
      patientId,
    )
    .first<{ vitalis_health_data: number; revoked_at: string | null }>();
  if (!consent?.vitalis_health_data || consent.revoked_at)
    return c.json({ consent: false, observations: [], index: null });
  const { results } = await db
    .statement(
      `SELECT o.id,o.metric_code,o.metric_name,o.value_numeric,o.unit,o.observed_start_utc,o.source_type,o.quality
     FROM vitalis_observations o WHERE o.org_id=:org AND o.patient_id=?
     ORDER BY o.observed_start_utc DESC LIMIT 60`,
      patientId,
    )
    .all<{
      id: string;
      metric_code: string;
      metric_name: string;
      value_numeric: number;
      unit: string;
      observed_start_utc: string;
      source_type: string;
      quality: string;
    }>();
  const domains: HealthspanIndexInput["domains"] = {};
  const domainKeys = [
    "physical_activity",
    "strength_mobility",
    "sleep_recovery",
    "nutrition_quality",
    "cardio_health",
    "metabolic_health",
    "preventive_care",
    "psychosocial_wellbeing",
  ] as const;
  const cutoff = new Date(Date.now() - 90 * 86_400_000).toISOString();
  for (const key of domainKeys) {
    const row = results.find(
      ({ metric_code, quality, observed_start_utc }) =>
        metric_code === `hpi_${key}` &&
        quality === "verified" &&
        observed_start_utc >= cutoff,
    );
    if (row)
      domains[key] = {
        score: row.value_numeric,
        observed: true,
        provenance:
          row.source_type === "patient_reported" ? "self_reported" : "verified",
      };
  }
  const { status, hpiScore, coverage } = vitalisHealthspanIndex({ domains });
  return c.json({
    consent: true,
    observations: results,
    index: { status, score: hpiScore, coverage },
  });
});

companionRouter.post("/vitalis/consent", async (c) => {
  const { orgId, patientId } = c.get("patient");
  const { granted } = await input(
    c.req.raw,
    z.strictObject({ granted: z.boolean() }),
  );
  const at = new Date().toISOString();
  await tenantDb({ db: c.env.DB, orgId })
    .statement(
      `INSERT INTO vitalis_consents (org_id,id,patient_id,vitalis_health_data,wearable_sync,clinician_sharing,research_anonymized,her_menstrual_sharing,granted_at,revoked_at)
    VALUES (:org,?,?,?,0,0,0,0,?,?)`,
      crypto.randomUUID(),
      patientId,
      Number(granted),
      at,
      granted ? null : at,
    )
    .run();
  return c.json({ consent: granted });
});

companionRouter.post("/vitalis", async (c) => {
  const { orgId, patientId } = c.get("patient");
  const body = await input(c.req.raw, vitalisValue);
  const metric = vitalisMetrics[body.metric];
  const saved = await tenantDb({ db: c.env.DB, orgId })
    .statement(
      `WITH tenant(org_id) AS (SELECT :org)
     INSERT INTO vitalis_observations (org_id,id,patient_id,metric_code,metric_name,value_numeric,unit,observed_start_utc,source_type,quality)
     SELECT tenant.org_id,?,?,?,?,?,?,?,'patient_reported','unverified' FROM tenant WHERE 1=(
       SELECT CASE WHEN revoked_at IS NULL THEN vitalis_health_data ELSE 0 END FROM vitalis_consents v
       WHERE v.org_id=tenant.org_id AND v.patient_id=? ORDER BY granted_at DESC,id DESC LIMIT 1
     ) RETURNING id`,
      crypto.randomUUID(),
      patientId,
      body.metric,
      metric.name,
      body.value,
      metric.unit,
      new Date().toISOString(),
      patientId,
    )
    .first();
  if (!saved)
    throw new HTTPException(403, {
      message: "Enable Vitalis tracking before saving.",
    });
  return c.json({ saved: true }, 201);
});

companionRouter.get("/prakriti", async (c) => {
  const { orgId, patientId } = c.get("patient");
  const observation = await tenantDb({ db: c.env.DB, orgId })
    .statement(
      `SELECT json_extract(n.details_json,'$.agni') AS agni,
      json_extract(n.details_json,'$.dosha') AS dosha,
      json_extract(n.details_json,'$.examination.prakriti') AS prakriti, n.updated_at
     FROM ayush_case_notes n JOIN encounters e ON e.org_id=n.org_id AND e.id=n.encounter_id AND e.clinic_id=n.clinic_id
     JOIN consents c ON c.org_id=e.org_id AND c.encounter_id=e.id AND c.purpose='care' AND c.revoked_at IS NULL
     WHERE n.org_id=:org AND e.patient_id=?
     ORDER BY n.updated_at DESC LIMIT 1`,
      patientId,
    )
    .first<{
      agni: string | null;
      dosha: string | null;
      prakriti: string | null;
      updated_at: string;
    }>();
  return c.json({
    assessment: observation && {
      ...observation,
      dosha: observation.dosha ? JSON.parse(observation.dosha) : null,
    },
  });
});

companionRouter.post("/yoga", async (c) => {
  const flags = await input(
    c.req.raw,
    z.strictObject({
      cardiovascularRestriction: z.boolean(),
      eyePressureRestriction: z.boolean(),
      spineRestriction: z.boolean(),
      acuteSymptoms: z.boolean(),
    }),
  );
  const { orgId, patientId } = c.get("patient");
  const clinical = await tenantDb({ db: c.env.DB, orgId })
    .statement(
      "SELECT clinician_restricted_exertion FROM vitalis_profiles WHERE org_id=:org AND patient_id=?",
      patientId,
    )
    .first<{ clinician_restricted_exertion: number }>();
  const restricted = Boolean(
    clinical?.clinician_restricted_exertion ||
      Object.values(flags).some(Boolean),
  );
  const eligible = new Set([
    "yoga-04-supported-rest",
    "yoga-06-restorative-breath",
  ]);
  const items = restricted
    ? []
    : herWellnessRanker({ categoryFocus: "yoga_movement" })
        .filter(({ id }) => eligible.has(id))
        .map(({ id, title, description, disclaimer }) => ({
          id,
          title,
          description,
          disclaimer,
        }));
  return c.json({ restricted, items });
});
