import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { threadPulse } from "../../../../packages/engine";
import type { IntegrationContext } from "../../context";
import { tenantDb } from "../../database";
import { staffAccess, staffBody } from "../../staff-access";
import { clinicalDay } from "../dispensing/prescription-review";

type Repo = ReturnType<typeof tenantDb>;
type RefillState = "requested" | "held" | "released";
const refillReviewers = staffAccess("CASHIER", "CLINIC_ADMIN");

const hydratedRequest = `SELECT q.id,q.status,q.requested_at AS requestedAt,q.held_until AS heldUntil,
    q.release_reason AS releaseReason,d.medicine,d.units
  FROM refill_requests q
  JOIN refill_approvals a ON a.org_id=q.org_id AND a.line_id=q.line_id AND a.clinic_id=q.clinic_id
  JOIN continuity_dispensed_lines d ON d.org_id=q.org_id AND d.line_id=q.line_id
    AND d.clinic_id=q.clinic_id AND d.patient_id=q.patient_id`;
type Refill = {
  id: string; status: RefillState; requestedAt: string; heldUntil: string | null;
  releaseReason: string | null; medicine: string; units: number;
};

function requireUuid(value: string) {
  const id = z.uuid().safeParse(value);
  if (!id.success) throw new HTTPException(400, { message: "Invalid refill reference" });
  return id.data;
}

export async function releaseStaleRefills(db: Repo, clinicId: string | null, now = new Date()) {
  await db.statement(
    `UPDATE refill_requests AS q SET status='released',released_at=?,
       release_reason=CASE WHEN a.request_through<? OR q.held_until<=? THEN 'expired' ELSE 'safety-recheck' END
     FROM refill_approvals a WHERE q.org_id=:org AND (? IS NULL OR q.clinic_id=?)
       AND a.org_id=q.org_id AND a.line_id=q.line_id AND q.status IN ('held','requested')
       AND (a.request_through<? OR q.held_until<=? OR NOT EXISTS (
         SELECT 1 FROM continuity_dispensed_lines d WHERE d.org_id=q.org_id AND d.line_id=q.line_id
           AND d.clinic_id=q.clinic_id AND d.patient_id=q.patient_id
       ))`,
    now.toISOString(), clinicalDay(now), now.toISOString(),
    clinicId, clinicId, clinicalDay(now), now.toISOString(),
  ).run();
}

export async function requestRefill(db: Repo, patientId: string, lineId: string) {
  requireUuid(lineId);
  const now = new Date();
  await db.statement(
    `INSERT INTO refill_requests(org_id,id,line_id,clinic_id,patient_id,requested_at)
     SELECT d.org_id,?,d.line_id,d.clinic_id,d.patient_id,?
     FROM refill_approvals a JOIN continuity_dispensed_lines d ON d.org_id=a.org_id AND d.line_id=a.line_id AND d.clinic_id=a.clinic_id
     WHERE d.org_id=:org AND d.patient_id=? AND d.line_id=? AND a.request_through>=?
     ON CONFLICT DO NOTHING`,
    crypto.randomUUID(), now.toISOString(), patientId, lineId, clinicalDay(now),
  ).run();
  const item = await db.statement(
    `${hydratedRequest} WHERE q.org_id=:org AND q.patient_id=? AND q.line_id=? AND a.request_through>=?`,
    patientId, lineId, clinicalDay(now),
  ).first<Refill>();
  if (!item) throw new HTTPException(404, { message: "Approved refill unavailable" });
  return item;
}

export async function cancelPatientRefill(db: Repo, patientId: string, requestId: string) {
  const id = requireUuid(requestId);
  const now = new Date().toISOString();
  const result = await db.statement(
    `UPDATE refill_requests SET status='released',released_at=?,release_reason='patient-cancelled'
      WHERE org_id=:org AND patient_id=? AND id=? AND status IN ('held','requested') RETURNING id`,
    now, patientId, id,
  ).first<{ id: string }>();
  if (!result) throw new HTTPException(404, { message: "Active refill unavailable" });
  return result;
}

export const refillStaffRouter = new Hono<IntegrationContext>();
refillStaffRouter.get("/approval/:encounter", staffAccess("DOCTOR"), async (c) => {
  const id = requireUuid(c.req.param("encounter"));
  const p = c.get("principal");
  const { results } = await tenantDb({ db: c.env.DB, orgId: p.orgId }).statement(
    `SELECT d.line_id AS lineId,d.medicine,d.units,a.request_through AS requestThrough,a.course_end AS courseEnd
     FROM continuity_dispensed_lines d
     LEFT JOIN refill_approvals a ON a.org_id=d.org_id AND a.clinic_id=d.clinic_id AND a.line_id=d.line_id
     WHERE d.org_id=:org AND d.clinic_id=? AND d.encounter_id=? AND d.signed_by=? ORDER BY d.medicine,d.line_id`,
    p.clinicId, id, p.userId,
  ).all();
  return c.json({ items: results });
});

const approveRefill = z.strictObject({
  requestThrough: z.iso.date(),
  courseEnd: z.iso.date(),
  confirmedNewReview: z.literal(true),
});

refillStaffRouter.post("/approval/:line", staffAccess("DOCTOR"), async (c) => {
  const line = requireUuid(c.req.param("line"));
  const { requestThrough, courseEnd } = await staffBody(c.req.raw, approveRefill);
  const p = c.get("principal");
  const now = new Date();
  if (requestThrough < clinicalDay(now) || courseEnd < requestThrough)
    throw new HTTPException(400, { message: "Review the request and course-end dates." });
  const db = tenantDb({ db: c.env.DB, orgId: p.orgId });
  const saved = await db.statement(
    `INSERT INTO refill_approvals(org_id,line_id,clinic_id,approved_by,approved_at,request_through,course_end)
     SELECT d.org_id,d.line_id,d.clinic_id,d.signed_by,?,?,? FROM continuity_dispensed_lines d
     WHERE d.org_id=:org AND d.clinic_id=? AND d.line_id=? AND d.signed_by=?
     ON CONFLICT DO NOTHING RETURNING line_id AS lineId`,
    now.toISOString(), requestThrough, courseEnd, p.clinicId, line, p.userId,
  ).first<{ lineId: string }>();
  if (saved) return c.json(saved, 201);
  const found = await db.statement(
    `SELECT a.request_through AS requestThrough,a.course_end AS courseEnd
     FROM refill_approvals a JOIN continuity_dispensed_lines d ON d.org_id=a.org_id AND d.line_id=a.line_id AND d.clinic_id=a.clinic_id
     WHERE a.org_id=:org AND a.clinic_id=? AND a.line_id=? AND a.approved_by=?`,
    p.clinicId, line, p.userId,
  ).first<{ requestThrough: string; courseEnd: string }>();
  if (found?.requestThrough === requestThrough && found.courseEnd === courseEnd) return c.json({ lineId: line });
  throw new HTTPException(found ? 409 : 404, { message: "Dispensed line unavailable for an approval." });
});

refillStaffRouter.get("/", refillReviewers, async (c) => {
  const p = c.get("principal");
  const db = tenantDb({ db: c.env.DB, orgId: p.orgId });
  await releaseStaleRefills(db, p.clinicId);
  const { results } = await db.statement(
    `${hydratedRequest} WHERE q.org_id=:org AND q.clinic_id=? AND q.status IN ('held','requested')
      ORDER BY q.requested_at,q.id`, p.clinicId,
  ).all<Refill>();
  return c.json({ items: results });
});

refillStaffRouter.post("/:id/hold", refillReviewers, async (c) => {
  const id = requireUuid(c.req.param("id"));
  const p = c.get("principal");
  await staffBody(c.req.raw, z.strictObject({ confirmed: z.literal(true) }));
  const db = tenantDb({ db: c.env.DB, orgId: p.orgId });
  const now = new Date();
  await releaseStaleRefills(db, p.clinicId, now);
  try {
    await db.statement(
      `UPDATE refill_requests AS q SET status='held',held_by=?,held_at=?,
         held_until=MIN(?,strftime('%Y-%m-%dT%H:%M:%fZ',a.request_through,'+1 day','-330 minutes'))
       FROM refill_approvals a WHERE q.org_id=:org AND q.clinic_id=? AND q.id=? AND q.status='requested'
         AND a.org_id=q.org_id AND a.clinic_id=q.clinic_id AND a.line_id=q.line_id`,
      p.userId, now.toISOString(), new Date(now.getTime() + 86_400_000).toISOString(), p.clinicId, id,
    ).run();
  } catch (error) {
    if (/REFILL_(STOCK_UNAVAILABLE|NOT_ELIGIBLE)/.test(String(error)))
      throw new HTTPException(409, { message: "Refill eligibility or stock changed. Review again." });
    throw error;
  }

  const item = await db.statement(
    `${hydratedRequest} WHERE q.org_id=:org AND q.clinic_id=? AND q.id=? AND q.status='held'`, p.clinicId, id,
  ).first<Refill>();
  if (!item) throw new HTTPException(404, { message: "Approved refill unavailable" });
  return c.json(item);
});

refillStaffRouter.post("/:id/release", refillReviewers, async (c) => {
  const id = requireUuid(c.req.param("id"));
  const p = c.get("principal");
  await staffBody(c.req.raw, z.strictObject({ confirmed: z.literal(true) }));
  const item = await tenantDb({ db: c.env.DB, orgId: p.orgId }).statement(
    `UPDATE refill_requests SET status='released',released_at=?,released_by=?,release_reason='pharmacy-released'
     WHERE org_id=:org AND clinic_id=? AND id=? AND status IN ('held','requested') RETURNING id`,
    new Date().toISOString(), p.userId, p.clinicId, id,
  ).first<{ id: string }>();
  if (!item) throw new HTTPException(404, { message: "Active refill unavailable" });
  return c.json(item);
});

export const threadPulseCohort = new Hono<IntegrationContext>();
threadPulseCohort.get("/", staffAccess("CLINIC_ADMIN", "HOSPITAL_ADMIN", "OWNER", "SUPER_ADMIN"), async (c) => {
  const input = z.object({ sku: z.string().min(1).max(100), clinic: z.string().min(1).max(100).optional() })
    .safeParse(c.req.query());
  if (!input.success) throw new HTTPException(400, { message: "Select a clinic and medicine." });
  const p = c.get("principal");
  const { sku, clinic = p.clinicId } = input.data;
  if (p.role === "CLINIC_ADMIN" && clinic !== p.clinicId)
    throw new HTTPException(404, { message: "Clinic unavailable" });
  const db = tenantDb({ db: c.env.DB, orgId: p.orgId });
  const configured = await db.statement(
    `SELECT id FROM clinics c WHERE c.org_id=:org AND c.id=?
      AND EXISTS(SELECT 1 FROM sku s WHERE s.org_id=c.org_id AND s.id=?)`, clinic, sku,
  ).first();
  if (!configured) throw new HTTPException(404, { message: "Clinic or medicine unavailable" });
  await releaseStaleRefills(db, clinic);
  const cohort = await db.statement(
    `SELECT COUNT(DISTINCT q.patient_id) AS patients,COALESCE(SUM(d.units),0) AS requestedUnits,
       COALESCE(SUM(CASE WHEN q.status='held' THEN d.units ELSE 0 END),0) AS heldUnits
     FROM refill_requests q
     JOIN continuity_dispensed_lines d ON d.org_id=q.org_id AND d.line_id=q.line_id AND d.clinic_id=q.clinic_id AND d.patient_id=q.patient_id
     JOIN continuity_remote_encounters e ON e.org_id=d.org_id AND e.encounter_id=d.encounter_id AND e.clinic_id=d.clinic_id
     WHERE q.org_id=:org AND q.clinic_id=? AND d.sku_id=? AND q.status IN ('held','requested')`,
    clinic, sku,
  ).first<{ patients: number; requestedUnits: number; heldUnits: number }>();
  if (!cohort?.patients) return c.json({ status: "missing-cohort", forecast: null });
  if (cohort.patients > 500) return c.json({ status: "cohort-too-large", forecast: null });
  // Here the event is a request already made. Collection probability is uncalibrated.
  const { pmf, target, expectedDemand } = threadPulse({ probabilities: Array<number>(cohort.patients).fill(1), stock: 0 });
  return c.json({
    status: "confirmed-requests", provenance: "consented-persisted-requests",
    ...cohort, forecast: { pmf, expectedDemand, target, unit: "patients-with-requests" },
    collectionProbability: null,
  });
});
