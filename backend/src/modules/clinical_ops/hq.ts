import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import type { HqClinic, HqOrganization, HqStock, HqTransfer } from "../../../../packages/shared/hq-command";
import type { IntegrationContext } from "../../context";
import { tenantDb } from "../../database";
import { passwordHash, tokenHash } from "../../security";
import { staffAccess, staffBody } from "../../staff-access";
import { clinicalDay } from "../dispensing/prescription-review";
import { hqFinance } from "./hq-finance";

type Repo = ReturnType<typeof tenantDb>;
const id = z.string().trim().min(1).max(100);
const text = (max: number) => z.string().trim().min(1).max(max);
const email = z.email().trim().toLowerCase().max(254);
const hqAccess = staffAccess("HOSPITAL_ADMIN", "OWNER", "SUPER_ADMIN");
const managesHq = staffAccess("HOSPITAL_ADMIN");
const missingClinic = () => new HTTPException(404, { message: "Clinic or stock batch unavailable" });
const organizationInput = z.strictObject({
  name: text(160),
  slug: z.string().trim().min(2).max(60).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  adminEmail: email,
  brandingColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});
const clinicInput = z.strictObject({
  name: text(160), address: text(300), tier: text(120).optional(),
  code: z.string().trim().min(2).max(32).regex(/^[A-Z0-9-]+$/).optional(),
  bedCapacity: z.number().int().min(0).max(100_000).optional(),
  manager: z.strictObject({ name: text(160), email, password: z.string().min(10).max(128) }).optional(),
});
const transferInput = z.strictObject({
  sourceClinicId: id, destinationClinicId: id, skuId: id, batchId: id,
  units: z.number().int().min(1).max(100_000), reason: text(400),
}).refine((data) => data.sourceClinicId !== data.destinationClinicId);
const transferFields = `id,source_clinic_id AS sourceClinicId,destination_clinic_id AS destinationClinicId,
   sku_id AS skuId,source_batch_id AS sourceBatchId,destination_batch_id AS destinationBatchId,batch_no AS batchNo,
   expiry,unit_cost_paise AS unitCostPaise,unit_price_paise AS unitPricePaise,units,reason,created_at AS createdAt,actor_id AS actorId`;

function getOrganization(db: Repo) {
  return db.statement(
    `SELECT org_id AS id,name,slug,admin_email AS adminEmail,branding_color AS brandingColor
     FROM command_organizations WHERE org_id=:org`,
  ).first<HqOrganization>();
}

async function getFleet(db: Repo, clinicId: string | null = null) {
  const day = clinicalDay();
  const { results } = await db.statement(
    `SELECT c.id,c.name,COALESCE(d.status,'active') AS status,d.code,d.address,d.tier,
       d.bed_capacity AS bedCapacity,d.manager_name AS managerName,d.manager_email AS managerEmail,
       (SELECT COUNT(DISTINCT e.patient_id) FROM encounters e WHERE e.org_id=c.org_id AND e.clinic_id=c.id
         AND date(e.created_at,'+330 minutes')=?) AS patientCount,
       (SELECT COUNT(*) FROM care_admissions a JOIN care_locations l
          ON l.org_id=a.org_id AND l.clinic_id=a.clinic_id AND l.id=a.location_id
         WHERE a.org_id=c.org_id AND a.clinic_id=c.id AND a.discharged_at IS NULL AND l.kind='bed') AS activeAdmissions,
       COALESCE((SELECT SUM(s.total_paise) FROM sales s JOIN journals j
          ON j.org_id=s.org_id AND j.clinic_id=s.clinic_id AND j.ref_type='sale' AND j.ref_id=s.id AND j.status='posted'
         WHERE s.org_id=c.org_id AND s.clinic_id=c.id AND s.status='completed' AND j.date=?),0) AS grossPaise,
       (SELECT COUNT(*) FROM sales s JOIN journals j
          ON j.org_id=s.org_id AND j.clinic_id=s.clinic_id AND j.ref_type='sale' AND j.ref_id=s.id AND j.status='posted'
         WHERE s.org_id=c.org_id AND s.clinic_id=c.id AND s.status='completed' AND j.date=?) AS saleCount
     FROM clinics c LEFT JOIN command_clinic_details d ON d.org_id=c.org_id AND d.clinic_id=c.id
     WHERE c.org_id=:org AND (? IS NULL OR c.id=?) ORDER BY c.name,c.id`,
    day, day, day, clinicId, clinicId,
  ).all<HqClinic>();
  return { clinics: results, day };
}

export const hqRouter = new Hono<IntegrationContext>();
hqRouter.get("/fleet", hqAccess, async (c) => {
  const { orgId } = c.get("principal");
  const db = tenantDb({ db: c.env.DB, orgId });
  const [fleet, organization] = await Promise.all([getFleet(db), getOrganization(db)]);
  return c.json({ ...fleet, organization });
});

hqRouter.get("/branches/:id", staffAccess("HOSPITAL_ADMIN", "CLINIC_ADMIN", "OWNER", "SUPER_ADMIN"), async (c) => {
  const principal = c.get("principal");
  const clinicId = id.parse(c.req.param("id"));
  if (principal.role === "CLINIC_ADMIN" && principal.clinicId !== clinicId) throw missingClinic();
  const db = tenantDb({ db: c.env.DB, orgId: principal.orgId });
  const { clinics, day } = await getFleet(db, clinicId);
  if (!clinics[0]) throw missingClinic();
  return c.json({ clinic: clinics[0], day });
});

hqRouter.post("/organization", managesHq, async (c) => {
  const p = c.get("principal");
  const input = await staffBody(c.req.raw, organizationInput);
  const db = tenantDb({ db: c.env.DB, orgId: p.orgId });
  try {
    const inserted = await db.statement(
      `INSERT INTO command_organizations(org_id,name,slug,admin_email,branding_color,created_at,created_by)
       VALUES(:org,?,?,?,?,?,?) ON CONFLICT(org_id) DO NOTHING RETURNING org_id AS id`,
      input.name, input.slug, input.adminEmail, input.brandingColor, new Date().toISOString(), p.userId,
    ).first();
    if (inserted) return c.json({ id: p.orgId, ...input }, 201);
  } catch {
    throw new HTTPException(409, { message: "Organization registration could not be completed" });
  }
  const previous = await getOrganization(db);
  if (previous && Object.entries(input).every(([key, value]) => previous[key as keyof typeof input] === value))
    return c.json(previous, 200);
  throw new HTTPException(409, { message: "Organization is already registered" });
});

hqRouter.post("/branches", managesHq, async (c) => {
  const p = c.get("principal");
  const input = await staffBody(c.req.raw, clinicInput);
  const commandKey = z.uuid().safeParse(c.req.header("Idempotency-Key"));
  if (!commandKey.success) throw new HTTPException(400, { message: "Branch registration reference required" });
  const db = tenantDb({ db: c.env.DB, orgId: p.orgId });
  const find = () => db.statement(
    `SELECT result_id AS id, request_hash AS hash FROM command_receipts
     WHERE org_id=:org AND actor_id=? AND kind='branch-create' AND key=?`,
    p.userId, commandKey.data,
  ).first<{ id: string; hash: string }>();
  // Identical retries may recover the registration. The fingerprint excludes the password.
  const { manager, ...branch } = input;
  const hash = await tokenHash(JSON.stringify({ ...branch, manager: manager && { name: manager.name, email: manager.email } }));
  const replay = (prior: { id: string; hash: string }) => {
    if (hash !== prior.hash) throw new HTTPException(409, { message: "Branch registration reference already used" });
    return c.json({ id: prior.id }, 200);
  };
  const prior = await find();
  if (prior) return replay(prior);
  const clinicId = crypto.randomUUID();
  const now = new Date().toISOString();
  const statements = [
    db.statement("INSERT INTO clinics(org_id,id,name) VALUES(:org,?,?)", clinicId, input.name),
    db.statement(
      `INSERT INTO command_clinic_details(org_id,clinic_id,code,address,tier,bed_capacity,manager_name,manager_email,created_at,updated_at,updated_by)
       VALUES(:org,?,?,?,?,?,?,?,?,?,?)`,
      clinicId, input.code ?? null, input.address, input.tier ?? null, input.bedCapacity ?? null,
      manager?.name ?? null, manager?.email ?? null, now, now, p.userId,
    ),
  ];
  if (manager) {
    const userId = crypto.randomUUID();
    const salt = crypto.randomUUID();
    statements.push(
      db.statement(
        "INSERT INTO users(org_id,id,clinic_id,email,role,password_salt,password_hash) VALUES(:org,?,?,?,'CASHIER',?,?)",
        userId, clinicId, manager.email, salt, await passwordHash(manager.password, salt),
      ),
      db.statement(
        "INSERT INTO staff_clinic_roles(org_id,clinic_id,user_id,role) VALUES(:org,?,?,'CLINIC_ADMIN')",
        clinicId, userId,
      ),
    );
  }
  statements.push(db.statement(
    "INSERT INTO command_receipts(org_id,actor_id,kind,key,request_hash,result_id) VALUES(:org,?,'branch-create',?,?,?)",
    p.userId, commandKey.data, hash, clinicId,
  ));
  try {
    await db.batch(statements);
  } catch {
    const latest = await find();
    if (latest) return replay(latest);
    throw new HTTPException(409, { message: "Branch registration could not be completed. Check the branch code and manager email." });
  }
  return c.json({ id: clinicId }, 201);
});

hqRouter.patch("/branches/:id/status", managesHq, async (c) => {
  const p = c.get("principal");
  const clinicId = id.parse(c.req.param("id"));
  const { status } = await staffBody(c.req.raw, z.strictObject({ status: z.enum(["active", "paused"]) }));
  const now = new Date().toISOString();
  const row = await tenantDb({ db: c.env.DB, orgId: p.orgId }).statement(
    `INSERT INTO command_clinic_details(org_id,clinic_id,status,created_at,updated_at,updated_by)
     SELECT org_id,id,?,?,?,? FROM clinics WHERE org_id=:org AND id=?
     ON CONFLICT(org_id,clinic_id) DO UPDATE SET status=excluded.status,updated_at=excluded.updated_at,updated_by=excluded.updated_by
     RETURNING clinic_id AS id,status`,
    status, now, now, p.userId, clinicId,
  ).first();
  if (!row) throw missingClinic();
  return c.json(row);
});

hqRouter.get("/stock", hqAccess, async (c) => {
  const db = tenantDb({ db: c.env.DB, orgId: c.get("principal").orgId });
  const clinicId = id.optional().parse(c.req.query("clinic")) ?? null;
  if (clinicId && !(await db.statement("SELECT id FROM clinics WHERE org_id=:org AND id=?", clinicId).first()))
    throw missingClinic();
  const [items, batches] = await Promise.all([
    db.statement("SELECT id,brand,salt,strength_mg AS strengthMg,form FROM sku WHERE org_id=:org ORDER BY brand,id LIMIT 5001")
      .all<HqStock["items"][number]>(),
    db.statement(
      `SELECT id,sku_id AS skuId,clinic_id AS clinicId,batch_no AS batchNo,expiry,qty_units AS quantity,
         qty_units-reserved_units AS available,cost_paise AS costPaise,price_paise AS pricePaise
       FROM inventory_batches WHERE org_id=:org AND (? IS NULL OR clinic_id=?) ORDER BY expiry,id LIMIT 5001`,
      clinicId, clinicId,
    ).all<HqStock["batches"][number]>(),
  ]);
  if (items.results.length > 5000 || batches.results.length > 5000)
    throw new HTTPException(503, { message: "Group inventory exceeds the overview capacity" });
  return c.json({ items: items.results, batches: batches.results, day: clinicalDay() });
});

hqRouter.get("/transfers", hqAccess, async (c) => {
  const { results } = await tenantDb({ db: c.env.DB, orgId: c.get("principal").orgId }).statement(
    `SELECT ${transferFields} FROM command_stock_transfers WHERE org_id=:org ORDER BY created_at DESC,id LIMIT 100`,
  ).all<HqTransfer>();
  return c.json({ transfers: results });
});

hqRouter.post("/transfers", managesHq, async (c) => {
  const p = c.get("principal");
  const input = await staffBody(c.req.raw, transferInput);
  const commandKey = z.uuid().safeParse(c.req.header("Idempotency-Key"));
  if (!commandKey.success) throw new HTTPException(400, { message: "Transfer reference required" });
  const hash = await tokenHash(JSON.stringify(input));
  const db = tenantDb({ db: c.env.DB, orgId: p.orgId });
  const find = () => db.statement(
    `SELECT ${transferFields},request_hash AS requestHash FROM command_stock_transfers
     WHERE org_id=:org AND actor_id=? AND command_key=?`,
    p.userId, commandKey.data,
  ).first<HqTransfer & { requestHash: string }>();
  const replay = ({ requestHash, ...entry }: HqTransfer & { requestHash: string }) => {
    if (requestHash !== hash) throw new HTTPException(409, { message: "Transfer reference already used" });
    return c.json(entry, 200);
  };
  const prior = await find();
  if (prior) return replay(prior);
  try {
    const result = await db.statement(
      `INSERT INTO command_stock_transfers(org_id,id,actor_id,command_key,request_hash,source_clinic_id,destination_clinic_id,
         sku_id,source_batch_id,destination_batch_id,batch_no,expiry,unit_cost_paise,unit_price_paise,units,reason,created_at)
       SELECT b.org_id,?,?,?,?,b.clinic_id,c.id,b.sku_id,b.id,COALESCE(other.id,?),b.batch_no,b.expiry,b.cost_paise,b.price_paise,?,?,?
       FROM inventory_batches b JOIN clinics c ON c.org_id=b.org_id AND c.id=?
       LEFT JOIN inventory_batches other ON other.org_id=b.org_id AND other.clinic_id=c.id
         AND other.sku_id=b.sku_id AND other.batch_no=b.batch_no
       WHERE b.org_id=:org AND b.clinic_id=? AND b.id=? AND b.sku_id=?
       ON CONFLICT(org_id,actor_id,command_key) DO NOTHING RETURNING ${transferFields}`,
      crypto.randomUUID(), p.userId, commandKey.data, hash, crypto.randomUUID(),
      input.units, input.reason, new Date().toISOString(), input.destinationClinicId,
      input.sourceClinicId, input.batchId, input.skuId,
    ).first<HqTransfer>();
    if (result) return c.json(result, 201);
  } catch {
    const latest = await find();
    if (latest) return replay(latest);
    throw new HTTPException(409, { message: "Transfer could not be posted. Check batch availability, expiry and destination compatibility." });
  }
  const latest = await find();
  if (latest) return replay(latest);
  throw missingClinic();
});

hqRouter.route("/finance", hqFinance);
