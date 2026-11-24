import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import type { IntegrationContext } from "../../context";
import { tenantDb } from "../../database";
import { tokenHash } from "../../security";
import { staffAccess, staffBody } from "../../staff-access";

export const procurementHandoffs = new Hono<IntegrationContext>();
const managers = staffAccess("HOSPITAL_ADMIN", "CLINIC_ADMIN");
const receivers = staffAccess("HOSPITAL_ADMIN", "CLINIC_ADMIN", "CASHIER");
const dateIN = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(
    new Date(),
  );
const cents = z.number().int().positive().max(100_000_000);
const units = z.number().int().positive().max(100_000);
const order = z.strictObject({
  supplierReference: z.string().trim().min(1).max(150),
  lines: z
    .array(
      z.strictObject({
        skuId: z.string().min(1).max(100),
        units,
        costPaise: cents,
        pricePaise: cents,
      }),
    )
    .min(1)
    .max(20),
});
const receipt = z.strictObject({
  orderId: z.uuid(),
  lineId: z.uuid(),
  batchNo: z.string().trim().min(1).max(60),
  expiry: z.iso.date(),
  received: units,
  damaged: z.number().int().nonnegative(),
  invoice: z.string().trim().min(1).max(100),
});
const linesSql = `SELECT o.id AS orderId,o.status,o.supplier_reference AS supplierReference,l.id AS lineId,s.brand,
  l.units, l.units-COALESCE((SELECT SUM(received-damaged) FROM goods_receipts r
   WHERE r.org_id=l.org_id AND r.order_id=l.order_id AND r.line_id=l.id),0) AS outstanding
 FROM procurement_orders o JOIN procurement_order_lines l ON l.org_id=o.org_id AND l.order_id=o.id
 JOIN sku s ON s.org_id=l.org_id AND s.id=l.sku_id WHERE o.org_id=:org AND o.clinic_id=?`;

procurementHandoffs.get(
  "/orders",
  staffAccess("SUPER_ADMIN", "HOSPITAL_ADMIN", "CLINIC_ADMIN"),
  async (c) => {
    const p = c.get("principal");
    const db = tenantDb({ db: c.env.DB, orgId: p.orgId });
    const [orders, catalog] = await Promise.all([
      db
        .statement(
          `${linesSql} ORDER BY o.created_at DESC,l.id LIMIT 200`,
          p.clinicId,
        )
        .all(),
      db
        .statement(
          "SELECT id,brand FROM sku WHERE org_id=:org ORDER BY brand LIMIT 1000",
        )
        .all(),
    ]);
    return c.json({ orders: orders.results, catalog: catalog.results });
  },
);
procurementHandoffs.post("/orders", managers, async (c) => {
  const p = c.get("principal");
  const body = await staffBody(c.req.raw, order);
  const key = z.uuid().safeParse(c.req.header("Idempotency-Key"));
  if (!key.success)
    throw new HTTPException(400, {
      message: "Purchase order reference required",
    });
  const db = tenantDb({ db: c.env.DB, orgId: p.orgId });
  const hash = await tokenHash(JSON.stringify(body));
  const find = () =>
    db
      .statement(
        `SELECT o.id, cr.request_hash FROM command_receipts cr
      JOIN procurement_orders o ON o.org_id=cr.org_id AND o.clinic_id=? AND o.id=cr.result_id
      WHERE cr.org_id=:org AND cr.actor_id=? AND cr.kind='purchase-order' AND cr.key=?`,
        p.clinicId,
        p.userId,
        key.data,
      )
      .first<{ id: string; request_hash: string }>();
  const reply = ({
    id,
    request_hash,
  }: {
    id: string;
    request_hash: string;
  }) => {
    if (request_hash !== hash)
      throw new HTTPException(409, { message: "Order reference already used" });
    return c.json({ id });
  };
  const prior = await find();
  if (prior) return reply(prior);
  const id = crypto.randomUUID();
  try {
    await db.batch([
      db.statement(
        `INSERT INTO procurement_orders(org_id,clinic_id,id,supplier_reference,status,created_by,created_at) VALUES(:org,?,?,?,'draft',?,?)`,
        p.clinicId,
        id,
        body.supplierReference,
        p.userId,
        new Date().toISOString(),
      ),
      ...body.lines.map((line) =>
        db.statement(
          `INSERT INTO procurement_order_lines(org_id,order_id,id,sku_id,units,unit_cost_paise,unit_price_paise) VALUES(:org,?,?,?,?,?,?)`,
          id,
          crypto.randomUUID(),
          line.skuId,
          line.units,
          line.costPaise,
          line.pricePaise,
        ),
      ),
      db.statement(
        "INSERT INTO command_receipts(org_id,actor_id,kind,key,request_hash,result_id) VALUES(:org,?,'purchase-order',?,?,?)",
        p.userId,
        key.data,
        hash,
        id,
      ),
    ]);
  } catch {
    const winner = await find();
    if (winner) return reply(winner);
    throw new HTTPException(409, {
      message: "Purchase order could not be created. Check the catalog.",
    });
  }
  return c.json({ id }, 201);
});
procurementHandoffs.post("/orders/:id/issue", managers, async (c) => {
  const p = c.get("principal");
  const posted = await tenantDb({ db: c.env.DB, orgId: p.orgId })
    .statement(
      `UPDATE procurement_orders SET status='issued',issued_by=?,issued_at=?
    WHERE org_id=:org AND clinic_id=? AND id=? AND status='draft' RETURNING id`,
      p.userId,
      new Date().toISOString(),
      p.clinicId,
      c.req.param("id"),
    )
    .first();
  if (!posted)
    throw new HTTPException(404, { message: "Draft order unavailable" });
  return c.json(posted);
});
procurementHandoffs.get(
  "/grn",
  staffAccess("SUPER_ADMIN", "HOSPITAL_ADMIN", "CLINIC_ADMIN", "CASHIER"),
  async (c) => {
    const p = c.get("principal");
    const { results } = await tenantDb({ db: c.env.DB, orgId: p.orgId })
      .statement(
        `SELECT orderId,lineId,brand,outstanding FROM (
    ${linesSql} AND o.status IN ('issued','partial')) WHERE outstanding>0 LIMIT 200`,
        p.clinicId,
      )
      .all();
    return c.json({ lines: results });
  },
);
procurementHandoffs.post("/grn", receivers, async (c) => {
  const p = c.get("principal");
  const body = await staffBody(c.req.raw, receipt);
  if (body.damaged > body.received || body.expiry <= dateIN())
    throw new HTTPException(400, {
      message: "Invalid received quantities or expiry",
    });
  const key = z.uuid().safeParse(c.req.header("Idempotency-Key"));
  if (!key.success)
    throw new HTTPException(400, { message: "Receipt reference required" });
  const db = tenantDb({ db: c.env.DB, orgId: p.orgId });
  const hash = await tokenHash(JSON.stringify(body));
  const find = () =>
    db
      .statement(
        `SELECT r.id,r.received-r.damaged AS accepted,cr.request_hash FROM command_receipts cr
    JOIN goods_receipts r ON r.org_id=cr.org_id AND r.id=cr.result_id AND r.clinic_id=?
    WHERE cr.org_id=:org AND cr.actor_id=? AND cr.kind='grn' AND cr.key=?`,
        p.clinicId,
        p.userId,
        key.data,
      )
      .first<{ id: string; accepted: number; request_hash: string }>();
  const replay = (
    data: NonNullable<Awaited<ReturnType<typeof find>>>,
    status: 200 | 201,
  ) => {
    if (data.request_hash !== hash)
      throw new HTTPException(409, {
        message: "Receipt reference already used",
      });
    return c.json({ id: data.id, accepted: data.accepted }, status);
  };
  const prior = await find();
  if (prior) return replay(prior, 200);
  const line = await db
    .statement(
      `SELECT l.unit_cost_paise AS costPaise FROM procurement_order_lines l
    JOIN procurement_orders o ON o.org_id=l.org_id AND o.id=l.order_id
    WHERE l.org_id=:org AND o.clinic_id=? AND l.order_id=? AND l.id=?`,
      p.clinicId,
      body.orderId,
      body.lineId,
    )
    .first<{ costPaise: number }>();
  if (!line)
    throw new HTTPException(404, {
      message: "Authorized purchase order line unavailable",
    });
  const id = crypto.randomUUID(),
    journal = crypto.randomUUID(),
    stamp = new Date().toISOString();
  const accepted = body.received - body.damaged,
    value = accepted * line.costPaise;
  try {
    await db.batch([
      db.statement(
        `INSERT INTO goods_receipts(org_id,clinic_id,id,order_id,line_id,batch_no,expiry,received,damaged,invoice,actor_id,received_at)
      VALUES(:org,?,?,?,?,?,?,?,?,?,?,?)`,
        p.clinicId,
        id,
        body.orderId,
        body.lineId,
        body.batchNo,
        body.expiry,
        body.received,
        body.damaged,
        body.invoice,
        p.userId,
        stamp,
      ),
      ...(value > 0
        ? [
            db.statement(
              "INSERT INTO journals(org_id,id,clinic_id,ref_type,ref_id,date,status) VALUES(:org,?,?,'grn',?,?,'draft')",
              journal,
              p.clinicId,
              id,
              dateIN(),
            ),
            db.statement(
              "INSERT INTO journal_lines(org_id,id,journal_id,account,debit_paise,credit_paise) VALUES(:org,?,?,'inventory',?,0)",
              crypto.randomUUID(),
              journal,
              value,
            ),
            db.statement(
              "INSERT INTO journal_lines(org_id,id,journal_id,account,debit_paise,credit_paise) VALUES(:org,?,?,'accounts_payable',0,?)",
              crypto.randomUUID(),
              journal,
              value,
            ),
            db.statement(
              "UPDATE journals SET status='posted' WHERE org_id=:org AND clinic_id=? AND id=?",
              p.clinicId,
              journal,
            ),
          ]
        : []),
      db.statement(
        "INSERT INTO command_receipts(org_id,actor_id,kind,key,request_hash,result_id) VALUES(:org,?,'grn',?,?,?)",
        p.userId,
        key.data,
        hash,
        id,
      ),
    ]);
  } catch {
    const winner = await find();
    if (winner) return replay(winner, 200);
    throw new HTTPException(409, {
      message:
        "Receipt could not be posted. Check outstanding quantity, batch and accounting status.",
    });
  }
  return replay({ id, accepted, request_hash: hash }, 201);
});
