import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { ayushNoteSchema } from "../../../../packages/shared/ayush";
import type { IntegrationContext } from "../../context";
import { tenantDb } from "../../database";
import { phase4Access, phase4Body } from "../phase4-access";

const saveInput = z.strictObject({
  version: z.number().int().min(0),
  note: ayushNoteSchema,
});
const activeCase = `SELECT e.org_id, e.id, e.clinic_id FROM encounters e
  JOIN consents c ON c.org_id = e.org_id AND c.encounter_id = e.id
    AND c.purpose = 'care' AND c.revoked_at IS NULL
  WHERE e.org_id = :org AND e.clinic_id = ? AND e.id = ? AND e.status = 'reviewed'`;

function encounterId(input: string) {
  const id = z.uuid().safeParse(input);
  if (!id.success)
    throw new HTTPException(400, { message: "Invalid encounter" });
  return id.data;
}

export const ayushRouter = new Hono<IntegrationContext>();
ayushRouter.use("*", phase4Access("ayush"));

ayushRouter.get("/cases/:id", async (c) => {
  const { orgId, clinicId, userId } = c.get("principal");
  const id = encounterId(c.req.param("id"));
  const db = tenantDb({ db: c.env.DB, orgId });
  const record = await db
    .statement(
      `WITH eligible AS (${activeCase})
     SELECT n.details_json, n.version, n.updated_at,
       (SELECT json_group_array(json_object('name', p.brand, 'salt', p.salt, 'units', p.units, 'directions', p.directions))
        FROM (
          SELECT s.brand, s.salt, l.units, l.directions
          FROM signed_prescriptions r
          JOIN prescription_lines l ON l.org_id = r.org_id AND l.prescription_id = r.id
          JOIN sku s ON s.org_id = l.org_id AND s.id = l.sku_id
          WHERE r.org_id = e.org_id AND r.clinic_id = e.clinic_id AND r.encounter_id = e.id
          ORDER BY s.brand, s.id
        ) p) AS prescriptions_json
     FROM eligible e
     LEFT JOIN ayush_case_notes n ON n.org_id = e.org_id AND n.encounter_id = e.id
       AND n.clinic_id = e.clinic_id AND n.practitioner_id = ?`,
      clinicId,
      id,
      userId,
    )
    .first<{
      details_json: string | null;
      version: number | null;
      updated_at: string | null;
      prescriptions_json: string;
    }>();
  if (!record)
    throw new HTTPException(404, { message: "Reviewed encounter unavailable" });
  return c.json({
    note: record.details_json
      ? ayushNoteSchema.parse(JSON.parse(record.details_json))
      : null,
    version: record.version ?? 0,
    updatedAt: record.updated_at,
    prescriptions: JSON.parse(record.prescriptions_json),
  });
});

ayushRouter.put("/cases/:id", async (c) => {
  const { orgId, clinicId, userId } = c.get("principal");
  const id = encounterId(c.req.param("id"));
  const input = await phase4Body(c.req.raw, saveInput);
  const db = tenantDb({ db: c.env.DB, orgId });
  const updatedAt = new Date().toISOString();
  const saved = await db
    .statement(
      `WITH eligible AS (${activeCase})
     INSERT INTO ayush_case_notes (org_id, encounter_id, clinic_id, practitioner_id, details_json, version, updated_at)
     SELECT e.org_id, e.id, e.clinic_id, ?, ?, 1, ? FROM eligible e
     WHERE ? = 0 OR EXISTS (
       SELECT 1 FROM ayush_case_notes n
       WHERE n.org_id = e.org_id AND n.encounter_id = e.id AND n.clinic_id = e.clinic_id AND n.practitioner_id = ?
     )
     ON CONFLICT(org_id, encounter_id, practitioner_id) DO UPDATE
     SET details_json = excluded.details_json, version = ayush_case_notes.version + 1, updated_at = excluded.updated_at
     WHERE ayush_case_notes.clinic_id = excluded.clinic_id AND ayush_case_notes.version = ?
     RETURNING version`,
      clinicId,
      id,
      userId,
      JSON.stringify(input.note),
      updatedAt,
      input.version,
      userId,
      input.version,
    )
    .first<{ version: number }>();
  if (!saved) {
    const eligible = await db.statement(activeCase, clinicId, id).first();
    if (!eligible)
      throw new HTTPException(404, {
        message: "Reviewed encounter unavailable",
      });
    throw new HTTPException(409, {
      message: "Case sheet changed. Reopen the encounter before saving again.",
    });
  }
  return c.json({ version: saved.version, updatedAt });
});
