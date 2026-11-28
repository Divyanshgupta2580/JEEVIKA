import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import type { IntegrationContext } from "../../context";
import { tenantDb } from "../../database";
import { staffAccess } from "../../staff-access";

type Repo = ReturnType<typeof tenantDb>;
export const shareWellnessSchema = z.strictObject({
  kind: z.enum(["her", "vitalis"]),
  encounterId: z.uuid(),
});
const reviewedCare = `FROM encounters e JOIN consents c
  ON c.org_id=e.org_id AND c.encounter_id=e.id AND c.revoked_at IS NULL AND c.purpose='care'`;
const activeModule = (kind: "her" | "vitalis") => kind === "her"
  ? `COALESCE((SELECT granted=1 AND revoked_at IS NULL FROM her_consents h
       WHERE h.org_id=e.org_id AND h.patient_id=e.patient_id AND h.consent_type='symptom_tracking'
       ORDER BY granted_at DESC,id DESC LIMIT 1),0)`
  : `COALESCE((SELECT vitalis_health_data=1 AND revoked_at IS NULL FROM vitalis_consents v
       WHERE v.org_id=e.org_id AND v.patient_id=e.patient_id ORDER BY granted_at DESC,id DESC LIMIT 1),0)`;

export async function wellnessShareOptions(db: Repo, patientId: string) {
  const { results } = await db.statement(
    `SELECT e.id AS encounterId,cx.name AS clinicName,e.reviewed_at AS reviewedAt
     ${reviewedCare} JOIN clinics cx ON cx.org_id=e.org_id AND cx.id=e.clinic_id
     WHERE e.org_id=:org AND e.patient_id=? AND e.status='reviewed' AND e.reviewed_by IS NOT NULL
     ORDER BY e.reviewed_at DESC,e.id LIMIT 30`, patientId,
  ).all();
  const { results: shares } = await db.statement(
    `SELECT id,kind,encounter_id AS encounterId,expires_at AS expiresAt
     FROM continuity_wellness_shares WHERE org_id=:org AND patient_id=? AND revoked_at IS NULL AND expires_at>?
     ORDER BY granted_at DESC,id`, patientId, new Date().toISOString(),
  ).all();
  return { encounters: results, shares };
}

export async function shareWellness(db: Repo, patientId: string, selection: z.infer<typeof shareWellnessSchema>) {
  const { encounterId, kind } = selection;
  const now = new Date();
  const at = now.toISOString();
  const expiresAt = new Date(now.getTime() + 7 * 86_400_000).toISOString();
  await db.batch([
    db.statement(
      `UPDATE continuity_wellness_shares SET revoked_at=? WHERE org_id=:org AND patient_id=?
       AND encounter_id=? AND kind=? AND revoked_at IS NULL AND (expires_at<=? OR doctor_id<>(
         SELECT e.reviewed_by FROM encounters e WHERE e.org_id=continuity_wellness_shares.org_id AND e.id=continuity_wellness_shares.encounter_id
       ))`, at, patientId, encounterId, kind, at,
    ),
    db.statement(
      `INSERT INTO continuity_wellness_shares(org_id,id,clinic_id,encounter_id,patient_id,doctor_id,kind,granted_at,expires_at)
       SELECT e.org_id,?,e.clinic_id,e.id,e.patient_id,e.reviewed_by,?,?,? ${reviewedCare}
       WHERE e.org_id=:org AND e.patient_id=? AND e.id=? AND e.status='reviewed'
         AND e.reviewed_by IS NOT NULL AND ${activeModule(kind)}
       ON CONFLICT DO NOTHING`,
      crypto.randomUUID(), kind, at, expiresAt, patientId, encounterId,
    ),
  ]);
  const share = await db.statement(
    `SELECT w.id,w.expires_at AS expiresAt ${reviewedCare}
     JOIN continuity_wellness_shares w ON w.org_id=e.org_id AND w.encounter_id=e.id AND w.patient_id=e.patient_id AND w.doctor_id=e.reviewed_by
     WHERE e.org_id=:org AND e.patient_id=? AND e.id=? AND w.kind=? AND w.revoked_at IS NULL
       AND w.expires_at>? AND ${activeModule(kind)}`,
    patientId, encounterId, kind, at,
  ).first();
  if (!share) throw new HTTPException(404, { message: "A reviewed visit and active tracking consent are required." });
  return share;
}

export async function revokeWellness(db: Repo, patientId: string, id: string) {
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) throw new HTTPException(400, { message: "Invalid wellness share" });
  const share = await db.statement(
    `UPDATE continuity_wellness_shares SET revoked_at=COALESCE(revoked_at,?)
     WHERE org_id=:org AND patient_id=? AND id=? RETURNING id`, new Date().toISOString(), patientId, parsed.data,
  ).first();
  if (!share) throw new HTTPException(404, { message: "Wellness share unavailable" });
  return share;
}

export const wellnessClinicianRouter = new Hono<IntegrationContext>();

wellnessClinicianRouter.get("/:encounter", staffAccess("DOCTOR"), async (c) => {
  const id = z.uuid().safeParse(c.req.param("encounter"));
  if (!id.success) throw new HTTPException(400, { message: "Invalid encounter" });
  const p = c.get("principal");
  const db = tenantDb({ db: c.env.DB, orgId: p.orgId });
  const current = new Date().toISOString();
  const modules = await Promise.all((["her", "vitalis"] as const).map(async kind => {
    // Authorize against the same D1 snapshot that returns the summary.
    const records = kind === "her"
      ? `SELECT log_date AS day,pelvic_pain AS pain FROM her_symptoms WHERE org_id=e.org_id AND patient_id=e.patient_id ORDER BY log_date DESC,created_at DESC LIMIT 30`
      : `SELECT metric_name AS metric,value_numeric AS value,unit,source_type AS source,quality,observed_start_utc AS at
          FROM vitalis_observations WHERE org_id=e.org_id AND patient_id=e.patient_id ORDER BY observed_start_utc DESC,id LIMIT 30`;
    const cycles = kind === "her" ? `(
      SELECT json_group_array(json_object('day',start_date,'periodLength',period_length_days)) FROM (
        SELECT start_date,period_length_days FROM her_cycles WHERE org_id=e.org_id AND patient_id=e.patient_id
        ORDER BY start_date DESC,id LIMIT 12
      )
    )` : "'[]'";
    const summary = await db.statement(
      `SELECT w.granted_at AS grantedAt,w.expires_at AS expiresAt,${cycles} AS cycles,
        (SELECT json_group_array(${kind === "her" ? "json_object('day',day,'pain',pain)" :
          "json_object('metric',metric,'value',value,'unit',unit,'source',source,'quality',quality,'at',at)"})
         FROM (${records})) AS records
       ${reviewedCare} JOIN continuity_wellness_shares w ON w.org_id=e.org_id AND w.encounter_id=e.id
         AND w.patient_id=e.patient_id AND w.clinic_id=e.clinic_id AND w.doctor_id=e.reviewed_by
       WHERE e.org_id=:org AND e.clinic_id=? AND e.id=? AND w.doctor_id=? AND w.kind=?
        AND w.revoked_at IS NULL AND w.expires_at>? AND ${activeModule(kind)}`,
      p.clinicId, id.data, p.userId, kind, current,
    ).first<{ grantedAt: string; expiresAt: string; cycles: string; records: string }>();
    return summary && { kind, ...summary, cycles: JSON.parse(summary.cycles), records: JSON.parse(summary.records) };
  }));
  return c.json({ summaries: modules.filter(Boolean) });
});
