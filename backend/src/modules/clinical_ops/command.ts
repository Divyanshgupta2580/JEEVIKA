import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import type { Principal } from "../../../../packages/shared/integration";
import type { IntegrationContext } from "../../context";
import { tenantDb } from "../../database";
import { staffAccess, staffBody } from "../../staff-access";
import { roundDivide } from "../../../../packages/shared/operations";
import { hqRouter } from "./hq";

export const commandRouter = new Hono<IntegrationContext>();
commandRouter.route("/hq", hqRouter);
const hospitalAccess = staffAccess("HOSPITAL_ADMIN");
const rosterAccess = staffAccess("HOSPITAL_ADMIN", "CLINIC_ADMIN");
const safeId = z.string().min(1).max(100);
const safeMoney = z.number().int().min(0).max(100_000_000);
const expense = z.strictObject({
  clinic_id: safeId.nullable(),
  category: z.string().trim().min(1).max(100),
  amount_paise: safeMoney.min(1),
  tax_bps: z.number().int().min(0).max(10000),
  description: z.string().trim().max(1000),
  expense_type: z.enum(["ONE_TIME", "RECURRING"]),
  expense_date: z.iso.date(),
});
const equipment = z.strictObject({
  clinic_id: safeId.nullable(),
  name: z.string().trim().min(1).max(160),
  category: z.enum([
    "BEDS",
    "MACHINES",
    "IT",
    "FURNITURE",
    "MAINTENANCE",
    "OTHER",
  ]),
  quantity: z.number().int().min(1).max(10000),
  purchase_cost_paise: safeMoney,
  purchase_date: z.iso.date(),
});
const shift = z
  .strictObject({
    name: z.string().trim().min(1).max(100),
    start_time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
    end_time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
    grace_minutes: z.number().int().min(0).max(1440),
    late_cutoff_minutes: z.number().int().min(0).max(1440),
  })
  .refine(
    (value) =>
      value.start_time !== value.end_time &&
      value.late_cutoff_minutes >= value.grace_minutes,
  );
type Repo = ReturnType<typeof tenantDb>;
const clock = () => new Date().toISOString();
const missing = () =>
  new HTTPException(404, { message: "Record or clinic unavailable" });

async function clinicScope(p: Principal, db: Repo, requested: string | null) {
  if (p.role === "CLINIC_ADMIN" && requested !== p.clinicId)
    throw new HTTPException(403, {
      message: "Roster access is limited to your clinic",
    });
  if (
    requested !== null &&
    !(await db
      .statement("SELECT id FROM clinics WHERE org_id=:org AND id=?", requested)
      .first())
  )
    throw missing();
  return requested;
}

commandRouter.get("/clinics", rosterAccess, async (c) => {
  const p = c.get("principal");
  const clinicId = p.role === "CLINIC_ADMIN" ? p.clinicId : null;
  const { results } = await tenantDb({ db: c.env.DB, orgId: p.orgId })
    .statement(
      "SELECT id,name FROM clinics WHERE org_id=:org AND (? IS NULL OR id=?) ORDER BY name LIMIT 200",
      clinicId,
      clinicId,
    )
    .all();
  return c.json({ clinics: results });
});

commandRouter.get("/expenses", hospitalAccess, async (c) => {
  const p = c.get("principal");
  const { results } = await tenantDb({ db: c.env.DB, orgId: p.orgId })
    .statement(`SELECT id,clinic_id,category,amount_paise,tax_paise,tax_bps,description,expense_type,expense_date,created_at
      FROM command_expenses WHERE org_id=:org AND voided_at IS NULL ORDER BY expense_date DESC,id LIMIT 500`)
    .all();
  return c.json({ items: results });
});
commandRouter.post("/expenses", hospitalAccess, async (c) => {
  const p = c.get("principal");
  const input = await staffBody(c.req.raw, expense);
  const db = tenantDb({ db: c.env.DB, orgId: p.orgId });
  await clinicScope(p, db, input.clinic_id);
  const id = crypto.randomUUID();
  const tax = roundDivide(
    BigInt(input.amount_paise) * BigInt(input.tax_bps),
    10000n,
  );
  await db
    .statement(
      `INSERT INTO command_expenses(org_id,clinic_id,id,category,amount_paise,tax_bps,tax_paise,description,expense_type,expense_date,created_at)
    VALUES(:org,?,?,?,?,?,?,?,?,?,?)`,
      input.clinic_id,
      id,
      input.category,
      input.amount_paise + tax,
      input.tax_bps,
      tax,
      input.description,
      input.expense_type,
      input.expense_date,
      clock(),
    )
    .run();
  return c.json({ id }, 201);
});
commandRouter.delete("/expenses/:id", hospitalAccess, async (c) => {
  const p = c.get("principal");
  const item = await tenantDb({ db: c.env.DB, orgId: p.orgId })
    .statement(
      "UPDATE command_expenses SET voided_at=? WHERE org_id=:org AND id=? AND voided_at IS NULL RETURNING id",
      clock(),
      c.req.param("id"),
    )
    .first();
  if (!item) throw missing();
  return c.json(item);
});

commandRouter.get("/equipment", hospitalAccess, async (c) => {
  const p = c.get("principal");
  const { results } = await tenantDb({ db: c.env.DB, orgId: p.orgId })
    .statement(`SELECT id,clinic_id,name,category,quantity,purchase_cost_paise,purchase_date,status,created_at
      FROM command_equipment WHERE org_id=:org AND archived_at IS NULL ORDER BY purchase_date DESC,id LIMIT 500`)
    .all();
  return c.json({ items: results });
});
commandRouter.post("/equipment", hospitalAccess, async (c) => {
  const p = c.get("principal");
  const input = await staffBody(c.req.raw, equipment);
  const db = tenantDb({ db: c.env.DB, orgId: p.orgId });
  await clinicScope(p, db, input.clinic_id);
  const id = crypto.randomUUID();
  await db
    .statement(
      `INSERT INTO command_equipment(org_id,clinic_id,id,name,category,quantity,purchase_cost_paise,purchase_date,status,created_at)
    VALUES(:org,?,?,?,?,?,?,?,'FUNCTIONAL',?)`,
      input.clinic_id,
      id,
      input.name,
      input.category,
      input.quantity,
      input.purchase_cost_paise,
      input.purchase_date,
      clock(),
    )
    .run();
  return c.json({ id }, 201);
});
commandRouter.delete("/equipment/:id", hospitalAccess, async (c) => {
  const p = c.get("principal");
  const item = await tenantDb({ db: c.env.DB, orgId: p.orgId })
    .statement(
      "UPDATE command_equipment SET archived_at=? WHERE org_id=:org AND id=? AND archived_at IS NULL RETURNING id",
      clock(),
      c.req.param("id"),
    )
    .first();
  if (!item) throw missing();
  return c.json(item);
});

const roster = "/roster/:clinic";
commandRouter.get(roster, rosterAccess, async (c) => {
  const p = c.get("principal");
  const db = tenantDb({ db: c.env.DB, orgId: p.orgId });
  const clinic = c.req.param("clinic");
  const scope = await clinicScope(p, db, clinic === "all" ? null : clinic);
  const [shifts, staff] = await Promise.all([
    db
      .statement(
        `SELECT id,clinic_id,name,start_time,end_time,grace_minutes,late_cutoff_minutes,created_at
      FROM command_shifts WHERE org_id=:org AND (? IS NULL OR clinic_id=?) ORDER BY start_time,id LIMIT 500`,
        scope,
        scope,
      )
      .all(),
    db
      .statement(
        `SELECT u.id,u.id AS full_name,u.clinic_id,COALESCE(r.role,u.role) AS role,a.shift_id,c.name AS clinic_name
      FROM users u JOIN clinics c ON c.org_id=u.org_id AND c.id=u.clinic_id
      LEFT JOIN staff_clinic_roles r ON r.org_id=u.org_id AND r.clinic_id=u.clinic_id AND r.user_id=u.id
        AND ((r.role='CLINIC_ADMIN' AND u.role='CASHIER') OR (r.role='STAT_NURSE' AND u.role='NURSE'))
      LEFT JOIN command_shift_assignments a ON a.org_id=u.org_id AND a.clinic_id=u.clinic_id AND a.user_id=u.id
      WHERE u.org_id=:org AND (? IS NULL OR u.clinic_id=?) ORDER BY u.id LIMIT 500`,
        scope,
        scope,
      )
      .all(),
  ]);
  return c.json({ shifts: shifts.results, staff: staff.results });
});
commandRouter.post(`${roster}/shifts`, rosterAccess, async (c) => {
  const p = c.get("principal");
  const db = tenantDb({ db: c.env.DB, orgId: p.orgId });
  const clinic = c.req.param("clinic");
  await clinicScope(p, db, clinic);
  const input = await staffBody(c.req.raw, shift);
  const id = crypto.randomUUID();
  await db
    .statement(
      `INSERT INTO command_shifts(org_id,clinic_id,id,name,start_time,end_time,grace_minutes,late_cutoff_minutes,created_at)
    VALUES(:org,?,?,?,?,?,?,?,?)`,
      clinic,
      id,
      input.name,
      input.start_time,
      input.end_time,
      input.grace_minutes,
      input.late_cutoff_minutes,
      clock(),
    )
    .run();
  return c.json({ id }, 201);
});
commandRouter.put(`${roster}/shifts/:id`, rosterAccess, async (c) => {
  const p = c.get("principal");
  const db = tenantDb({ db: c.env.DB, orgId: p.orgId });
  const clinic = c.req.param("clinic");
  await clinicScope(p, db, clinic);
  const input = await staffBody(c.req.raw, shift);
  const result = await db
    .statement(
      `UPDATE command_shifts SET name=?,start_time=?,end_time=?,grace_minutes=?,late_cutoff_minutes=?
    WHERE org_id=:org AND clinic_id=? AND id=? RETURNING id`,
      input.name,
      input.start_time,
      input.end_time,
      input.grace_minutes,
      input.late_cutoff_minutes,
      clinic,
      c.req.param("id"),
    )
    .first();
  if (!result) throw missing();
  return c.json(result);
});
commandRouter.delete(`${roster}/shifts/:id`, rosterAccess, async (c) => {
  const p = c.get("principal");
  const db = tenantDb({ db: c.env.DB, orgId: p.orgId });
  const clinic = c.req.param("clinic");
  await clinicScope(p, db, clinic);
  const result = await db
    .statement(
      "DELETE FROM command_shifts WHERE org_id=:org AND clinic_id=? AND id=? RETURNING id",
      clinic,
      c.req.param("id"),
    )
    .first();
  if (!result) throw missing();
  return c.json(result);
});
commandRouter.put(`${roster}/staff/:id/shift`, rosterAccess, async (c) => {
  const p = c.get("principal");
  const db = tenantDb({ db: c.env.DB, orgId: p.orgId });
  const clinic = c.req.param("clinic");
  await clinicScope(p, db, clinic);
  const id = c.req.param("id");
  const { shiftId } = await staffBody(
    c.req.raw,
    z.strictObject({ shiftId: z.uuid().nullable() }),
  );
  if (shiftId === null) {
    if (
      !(await db
        .statement(
          "SELECT id FROM users WHERE org_id=:org AND clinic_id=? AND id=?",
          clinic,
          id,
        )
        .first())
    )
      throw missing();
    await db
      .statement(
        "DELETE FROM command_shift_assignments WHERE org_id=:org AND clinic_id=? AND user_id=?",
        clinic,
        id,
      )
      .run();
    return c.json({ id });
  }
  const result = await db
    .statement(
      `INSERT INTO command_shift_assignments(org_id,clinic_id,user_id,shift_id)
    SELECT u.org_id,u.clinic_id,u.id,s.id FROM users u JOIN command_shifts s
      ON s.org_id=u.org_id AND s.clinic_id=u.clinic_id AND s.id=?
    WHERE u.org_id=:org AND u.clinic_id=? AND u.id=?
    ON CONFLICT(org_id,clinic_id,user_id) DO UPDATE SET shift_id=excluded.shift_id RETURNING user_id AS id`,
      shiftId,
      clinic,
      id,
    )
    .first();
  if (!result) throw missing();
  return c.json(result);
});

commandRouter.get(
  "/audit",
  staffAccess("SUPER_ADMIN", "HOSPITAL_ADMIN"),
  async (c) => {
    const p = c.get("principal");
    const db = tenantDb({ db: c.env.DB, orgId: p.orgId });
    const lock = await db
      .statement(
        "SELECT lock_date AS date FROM accounting_settings WHERE org_id=:org",
      )
      .first<{ date: string }>();
    const logs =
      p.role === "SUPER_ADMIN"
        ? (
            await db
              .statement(`SELECT id,action,'INFO' AS status,created_at FROM activity
        WHERE org_id=:org ORDER BY created_at DESC,id LIMIT 100`)
              .all()
          ).results
        : [];
    const transfers = await db.statement(
      `SELECT t.id,'INTER_CLINIC_STOCK_TRANSFER' AS action,'INFO' AS status,t.created_at,
         t.actor_id AS performed_by,t.units || ' units · ' || s.brand || ' · Batch ' || t.batch_no
           || ' · ' || source.name || ' → ' || destination.name || ' · ' || t.reason AS details
       FROM command_stock_transfers t
       JOIN clinics source ON source.org_id=t.org_id AND source.id=t.source_clinic_id
       JOIN clinics destination ON destination.org_id=t.org_id AND destination.id=t.destination_clinic_id
       JOIN sku s ON s.org_id=t.org_id AND s.id=t.sku_id
       WHERE t.org_id=:org ORDER BY t.created_at DESC,t.id LIMIT 100`,
    ).all<{ id: string; action: string; status: string; created_at: string; performed_by: string; details: string }>();
    return c.json({
      logs,
      transfers: transfers.results,
      lockedThrough: lock?.date ?? null,
      verificationAvailable: false,
    });
  },
);
