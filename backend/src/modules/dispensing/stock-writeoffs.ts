import { releaseStaleRefills } from "../continuity/refills";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import type { IntegrationContext } from "../../context";
import { tenantDb } from "../../database";
import { tokenHash } from "../../security";
import { staffAccess, staffBody } from "../../staff-access";

const managesStock = staffAccess("HOSPITAL_ADMIN", "CLINIC_ADMIN");
const writeoffRequest = z.strictObject({
  units: z.number().int().min(1).max(100_000),
  expectedQuantity: z.number().int().nonnegative().safe(),
  reason: z.string().trim().min(3).max(400),
});
const batchId = z.string().min(1).max(100);
const columns = `id,batch_id AS batchId,actor_id AS actorId,recorded_at AS recordedAt,units,
  stock_before-units AS remaining,cost_paise AS costPaise,reason`;
export const stockWriteoffs = new Hono<IntegrationContext>();

stockWriteoffs.get("/batches/:id/writeoffs", managesStock, async (c) => {
  const principal = c.get("principal");
  const db = tenantDb({ db: c.env.DB, orgId: principal.orgId });
  const id = batchId.parse(c.req.param("id"));
  const batch = await db.statement(
    "SELECT id FROM inventory_batches WHERE org_id=:org AND clinic_id=? AND id=?",
    principal.clinicId, id,
  ).first();
  if (!batch) throw new HTTPException(404, { message: "Stock batch unavailable" });
  const { results } = await db.statement(
    `SELECT ${columns} FROM clinical_stock_writeoffs
     WHERE org_id=:org AND clinic_id=? AND batch_id=? ORDER BY recorded_at DESC,id DESC LIMIT 50`,
    principal.clinicId, id,
  ).all();
  return c.json({ entries: results });
});

stockWriteoffs.post("/batches/:id/writeoffs", managesStock, async (c) => {
  const principal = c.get("principal");
  const id = batchId.parse(c.req.param("id"));
  const input = await staffBody(c.req.raw, writeoffRequest);
  const key = z.uuid().safeParse(c.req.header("Idempotency-Key"));
  if (!key.success) throw new HTTPException(400, { message: "Stock adjustment reference required" });
  const db = tenantDb({ db: c.env.DB, orgId: principal.orgId });
  const fingerprint = await tokenHash(JSON.stringify({ batchId: id, ...input }));
  const find = () => db.statement(
    `SELECT ${columns},request_hash AS requestHash FROM clinical_stock_writeoffs
     WHERE org_id=:org AND clinic_id=? AND actor_id=? AND command_key=?`,
    principal.clinicId, principal.userId, key.data,
  ).first<{ id: string; remaining: number; requestHash: string }>();
  function replay(receipt: NonNullable<Awaited<ReturnType<typeof find>>>) {
    const { requestHash, ...entry } = receipt;
    if (requestHash !== fingerprint)
      throw new HTTPException(409, { message: "Stock adjustment reference already used" });
    return c.json(entry, 200);
  }
  const prior = await find();
  if (prior) return replay(prior);
  await releaseStaleRefills(db, principal.clinicId);
  const batch = await db.statement(
    "SELECT id FROM inventory_batches WHERE org_id=:org AND clinic_id=? AND id=?",
    principal.clinicId, id,
  ).first();
  if (!batch) throw new HTTPException(404, { message: "Stock batch unavailable" });
  const result = await db.statement(
    `INSERT INTO clinical_stock_writeoffs(org_id,id,clinic_id,batch_id,actor_id,command_key,request_hash,
       recorded_at,stock_before,units,cost_paise,reason)
     SELECT org_id,?,clinic_id,id,?,?,?,?,qty_units,?,cost_paise*?,?
     FROM inventory_batches WHERE org_id=:org AND clinic_id=? AND id=?
       AND qty_units=? AND qty_units-reserved_units>=?
       AND date('now','+330 minutes')>COALESCE((SELECT lock_date FROM accounting_settings a WHERE a.org_id=inventory_batches.org_id),'')
     ON CONFLICT(org_id,actor_id,command_key) DO NOTHING RETURNING ${columns}`,
    crypto.randomUUID(), principal.userId, key.data, fingerprint, new Date().toISOString(),
    input.units, input.units, input.reason, principal.clinicId, id, input.expectedQuantity, input.units,
  ).first();
  if (result) return c.json(result, 201);
  const winner = await find();
  if (winner) return replay(winner);
  throw new HTTPException(409, { message: "Stock quantity changed, units are reserved, or the period is locked" });
});
