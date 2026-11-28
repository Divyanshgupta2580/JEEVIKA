import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { driftRadar } from "../../../../packages/engine";
import { checkInSchema } from "../../../../packages/shared/patient-experience";
import type { IntegrationContext } from "../../context";
import { tenantDb } from "../../database";
import { staffAccess, staffBody } from "../../staff-access";
import { clinicalDay } from "../dispensing/prescription-review";

type Repo = ReturnType<typeof tenantDb>;
type Reading = z.infer<typeof checkInSchema>;
export const urgentCheckIn = (reading: Reading) =>
  reading.distress || (reading.systolic ?? 0) >= 180 || (reading.spo2 ?? 100) <= 90;

type CheckIn = { day: string; created_at: string; observations_json: string };
async function observations(db: Repo, patientId: string, from: string | null) {
  const { results } = await db.statement(
    `SELECT day,created_at,observations_json FROM patient_check_ins
      WHERE org_id=:org AND patient_id=? AND (? IS NULL OR created_at>=?)
      ORDER BY day DESC LIMIT 60`, patientId, from, from,
  ).all<CheckIn>();
  return results.reverse().map(row => ({ ...row, reading: checkInSchema.parse(JSON.parse(row.observations_json)) }));
}

function analyze(records: Awaited<ReturnType<typeof observations>>) {
  const readings = records.flatMap(({ day, reading }) => {
    const systolic = reading.systolic;
    return systolic === undefined || systolic < 60 || systolic > 250
      ? []
      : [{ day: Date.parse(day) / 86_400_000, value: systolic }];
  });
  const drift = readings.length >= 7 ? driftRadar({ readings }) : null;
  const latest = records.at(-1);
  const urgent = Boolean(latest && urgentCheckIn(latest.reading));
  const point = drift?.trace.at(-1);
  const previous = drift?.trace.at(-2);
  const priorCheck = records.at(-2);
  const hasCurrentSystolic = latest && point?.day === Date.parse(latest.day) / 86_400_000;
  const alert = Boolean(hasCurrentSystolic && !urgent && point?.alert && !point.absolute);
  const sustained = Boolean(
    alert && point && previous?.alert && !previous.absolute && point.day - previous.day <= 3 &&
    priorCheck && previous.day === Date.parse(priorCheck.day) / 86_400_000 && !urgentCheckIn(priorCheck.reading),
  );
  const status = urgent ? "urgent" : !latest ? "no-readings" :
    latest.reading.systolic === undefined ? "missing-systolic" :
    latest.reading.systolic < 60 || latest.reading.systolic > 250 ? "outside-trend-range" :
    !drift || drift.learning ? "learning" : sustained ? "sustained" : alert ? "trend-change" : "monitoring";
  return { latest, drift, urgent, alert, sustained, status };
}

export async function recoveryTrend(db: Repo, patientId: string) {
  const records = await observations(db, patientId, null);
  const { drift, urgent, alert, status } = analyze(records);
  return {
    readings: records.map(({ day, reading }) => ({
      day, systolic: reading.systolic, spo2: reading.spo2,
    })),
    baseline: drift?.baseline ?? null, alert, urgent, status,
  };
}

const outpatient = `NOT EXISTS (
  SELECT 1 FROM care_admissions a WHERE a.org_id=e.org_id AND a.clinic_id=e.clinic_id AND a.encounter_id=e.encounter_id
)`;
const planScope = `FROM recovery_plans p
  JOIN continuity_remote_encounters e ON e.org_id=p.org_id AND e.encounter_id=p.encounter_id AND e.clinic_id=p.clinic_id
  WHERE p.org_id=:org AND e.patient_id=? AND p.expires_on>=? AND p.approved_by=e.reviewed_by AND ${outpatient}`;

export async function recordRecoveryOutreach(db: Repo, patientId: string, now: Date) {
  const day = clinicalDay(now);
  const plan = await db.statement(
    `SELECT p.encounter_id,p.approved_at ${planScope} ORDER BY p.approved_at DESC,p.encounter_id LIMIT 1`,
    patientId, day,
  ).first<{ encounter_id: string; approved_at: string }>();
  if (!plan) return;
  const { latest, drift, sustained } = analyze(await observations(db, patientId, plan.approved_at));
  if (!sustained || !latest || !drift || latest.day !== day || latest.reading.systolic === undefined) return;

  // The onset is stable across retries and subsequent check-ins in the same episode.
  let onset = day;
  for (let i = drift.trace.length - 1; i > 0; i--) {
    const current = drift.trace[i];
    const previous = drift.trace[i - 1];
    if (!current || !previous?.alert || previous.absolute || current.day - previous.day > 3) break;
    onset = new Date(previous.day * 86_400_000).toISOString().slice(0, 10);
  }

  await db.statement(
    `INSERT INTO recovery_outreach(org_id,id,encounter_id,clinic_id,patient_id,check_in_day,trigger_day,detected_at,baseline,systolic)
     SELECT p.org_id,?,p.encounter_id,p.clinic_id,e.patient_id,?,?,?,?,?
     ${planScope} AND p.encounter_id=? AND p.approved_at=?
     AND EXISTS(SELECT 1 FROM patient_check_ins i WHERE i.org_id=p.org_id AND i.patient_id=e.patient_id
       AND i.day=? AND i.created_at=? AND NOT EXISTS(
         SELECT 1 FROM patient_check_ins newer WHERE newer.org_id=i.org_id AND newer.patient_id=i.patient_id AND newer.day>i.day
       ))
     ON CONFLICT DO NOTHING`,
    crypto.randomUUID(), onset, latest.day, now.toISOString(), drift.baseline, latest.reading.systolic,
    patientId, day, plan.encounter_id, plan.approved_at, latest.day, latest.created_at,
  ).run();
}

function uuid(input: string, record: string) {
  const result = z.uuid().safeParse(input);
  if (!result.success) throw new HTTPException(400, { message: `Invalid ${record}` });
  return result.data;
}

export const recoveryRouter = new Hono<IntegrationContext>();
recoveryRouter.get("/:encounter", staffAccess("DOCTOR"), async (c) => {
  const id = uuid(c.req.param("encounter"), "encounter");
  const p = c.get("principal");
  const db = tenantDb({ db: c.env.DB, orgId: p.orgId });
  const plan = await db.statement(
    `SELECT p.expires_on AS expiresOn FROM continuity_remote_encounters e
     LEFT JOIN recovery_plans p ON p.org_id=e.org_id AND p.encounter_id=e.encounter_id
     WHERE e.org_id=:org AND e.clinic_id=? AND e.encounter_id=? AND e.reviewed_by=? AND ${outpatient}`,
    p.clinicId, id, p.userId,
  ).first<{ expiresOn: string | null }>();
  return c.json(plan ? { eligible: true, expiresOn: plan.expiresOn } : { eligible: false, expiresOn: null });
});

const approvalSchema = z.strictObject({
  expiresOn: z.iso.date(),
  criterion: z.literal("sustained-systolic-v1"),
});

recoveryRouter.post("/:encounter", staffAccess("DOCTOR"), async (c) => {
  const id = uuid(c.req.param("encounter"), "encounter");
  const { expiresOn, criterion } = await staffBody(c.req.raw, approvalSchema);
  const p = c.get("principal");
  const now = new Date();
  if (expiresOn < clinicalDay(now)) throw new HTTPException(400, { message: "Use a current or future recovery end date." });
  const db = tenantDb({ db: c.env.DB, orgId: p.orgId });
  const saved = await db.statement(
    `INSERT INTO recovery_plans(org_id,encounter_id,clinic_id,approved_by,approved_at,expires_on,criterion)
     SELECT e.org_id,e.encounter_id,e.clinic_id,e.reviewed_by,?,?,?
     FROM continuity_remote_encounters e WHERE e.org_id=:org AND e.clinic_id=? AND e.encounter_id=? AND e.reviewed_by=?
       AND ${outpatient}
     ON CONFLICT DO NOTHING RETURNING expires_on AS expiresOn`,
    now.toISOString(), expiresOn, criterion, p.clinicId, id, p.userId,
  ).first<{ expiresOn: string }>();
  if (saved) return c.json(saved, 201);
  const existing = await db.statement(
    `SELECT p.expires_on AS expiresOn FROM recovery_plans p
     JOIN continuity_remote_encounters e ON e.org_id=p.org_id AND e.encounter_id=p.encounter_id AND e.clinic_id=p.clinic_id
     WHERE p.org_id=:org AND p.clinic_id=? AND p.encounter_id=? AND p.approved_by=? AND e.reviewed_by=? AND ${outpatient}`,
    p.clinicId, id, p.userId, p.userId,
  ).first<{ expiresOn: string }>();
  if (existing?.expiresOn === expiresOn) return c.json(existing);
  throw new HTTPException(existing ? 409 : 404, { message: "Recovery plan unavailable for approval." });
});

const accessibleTask = `x.org_id=:org AND x.clinic_id=? AND x.id=? AND x.closed_at IS NULL AND EXISTS (
  SELECT 1 FROM continuity_remote_encounters e WHERE e.org_id=x.org_id AND e.clinic_id=x.clinic_id
    AND e.encounter_id=x.encounter_id AND e.patient_id=x.patient_id AND ${outpatient}
)`;

export async function openRecoveryCalls(db: Repo, clinicId: string) {
  const { results } = await db.statement(
    `SELECT x.id AS taskId,p.name AS patientName,x.check_in_day AS day,'review' AS priority,
      'opd-recovery' AS kind,x.acknowledged_at AS acknowledgedAt
     FROM recovery_outreach x
     JOIN continuity_remote_encounters e ON e.org_id=x.org_id AND e.encounter_id=x.encounter_id AND e.clinic_id=x.clinic_id
     JOIN patients p ON p.org_id=e.org_id AND p.id=e.patient_id AND p.id=x.patient_id
     WHERE x.org_id=:org AND x.clinic_id=? AND x.closed_at IS NULL AND ${outpatient}`, clinicId,
  ).all<{ taskId: string; patientName: string; day: string; priority: "review"; kind: "opd-recovery"; acknowledgedAt: string | null }>();
  return results;
}

export async function acknowledgeRecoveryCall(db: Repo, clinicId: string, userId: string, taskId: string) {
  return db.statement(
    `UPDATE recovery_outreach AS x SET acknowledged_by=COALESCE(acknowledged_by,?),acknowledged_at=COALESCE(acknowledged_at,?)
     WHERE ${accessibleTask} RETURNING acknowledged_at AS acknowledgedAt`,
    userId, new Date().toISOString(), clinicId, taskId,
  ).first<{ acknowledgedAt: string }>();
}

export async function closeRecoveryCall(db: Repo, clinicId: string, userId: string, taskId: string, outcome: string) {
  return db.statement(
    `UPDATE recovery_outreach AS x SET closed_by=?,closed_at=?,outcome=?
     WHERE ${accessibleTask} AND x.acknowledged_at IS NOT NULL RETURNING id`,
    userId, new Date().toISOString(), outcome, clinicId, taskId,
  ).first<{ id: string }>();
}
