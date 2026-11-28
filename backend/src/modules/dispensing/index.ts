import { kioskPurposeDenied } from "../kiosk-consent";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { dispensingPlan } from "../../../../packages/engine/dispensing";
import {
  roundDivide,
  prescriptionApprovalSchema,
  prescriptionQuoteSchema,
  savedPrescriptionDraftSchema,
  signPrescriptionSchema,
  skuSchema,
  type Inventory,
  type Prescription,
} from "../../../../packages/shared/operations";
import type { IntegrationContext } from "../../context";
import { tenantDb } from "../../database";
import { equalHash, tokenHash } from "../../security";
import { staffAccess, staffBody } from "../../staff-access";
import { clinicalDay, profileAllergies, recordedAllergies, reviewPrescription } from "./prescription-review";
import { stockWriteoffs } from "./stock-writeoffs";
import { completedClinicalReceipt } from "./receipt";

type Repo = ReturnType<typeof tenantDb>;
type Batch = Inventory["batches"][number] & { gstBps: number; nti: boolean };
type RxHeader = Omit<
  Prescription,
  "lines" | "allergies" | "reservationId" | "reservationExpiresAt" | "saleId"
> & { allergiesJson: string; profileAllergiesJson: string | null; reviewedAllergiesJson: string | null };
const today = clinicalDay;
const posRoles = staffAccess("CASHIER", "CLINIC_ADMIN");
const cashierCheckout = z.strictObject({
  prescriptionId: z.uuid(),
  expectedTotalPaise: z.number().int().positive().safe(),
  cashReceived: z.literal(true),
  taxMode: z.enum(["intra", "inter"]),
});

export const clinicalPharmacyRouter = new Hono<IntegrationContext>();
clinicalPharmacyRouter.route("/inventory", stockWriteoffs);

async function batches(db: Repo, clinicId: string, skuIds?: string[]) {
  const { results } = await db
    .statement(
      `SELECT b.id,b.sku_id AS skuId,s.brand,s.salt,s.strength_mg AS strengthMg,
    s.form,s.gst_bps AS gstBps,s.nti,b.clinic_id AS clinicId,b.batch_no AS batchNo,b.expiry,b.qty_units AS quantity,
    b.reserved_units AS reserved,b.qty_units-b.reserved_units AS available,b.price_paise AS pricePaise,b.cost_paise AS costPaise
    FROM inventory_batches b JOIN sku s ON s.org_id=b.org_id AND s.id=b.sku_id
    WHERE b.org_id=:org AND b.clinic_id=?
    ${skuIds ? "AND b.sku_id IN (SELECT value FROM json_each(?))" : ""}
    ORDER BY b.expiry,b.id${skuIds ? "" : " LIMIT 5000"}`,
      clinicId,
      ...(skuIds ? [JSON.stringify(skuIds)] : []),
    )
    .all<Omit<Batch, "nti"> & { nti: number }>();
  return results.map((batch) => ({ ...batch, nti: Boolean(batch.nti) }));
}

const availableRx = `SELECT r.id,r.encounter_id AS encounterId,e.patient_id AS patientId,p.name AS patientName,r.clinic_id AS clinicId,
 r.signed_by AS signedBy,r.signed_at AS signedAt,r.signature_hash AS signatureHash,r.note,
 r.allergies_json AS allergiesJson,p.allergies_json AS profileAllergiesJson,
 (SELECT json_extract(cr.details_json,'$.allergies') FROM clinical_reviews cr
  WHERE cr.org_id=e.org_id AND cr.encounter_id=e.id ORDER BY cr.revision DESC LIMIT 1) AS reviewedAllergiesJson
 FROM signed_prescriptions r JOIN encounters e ON e.org_id=r.org_id AND e.clinic_id=r.clinic_id AND e.id=r.encounter_id
 JOIN patients p ON p.org_id=e.org_id AND p.id=e.patient_id
 JOIN consents c ON c.org_id=e.org_id AND c.encounter_id=e.id AND c.purpose='care' AND c.revoked_at IS NULL
 JOIN encounter_permissions ep ON ep.org_id=r.org_id AND ep.encounter_id=r.encounter_id AND ep.purpose='pharmacy' AND ep.revoked_at IS NULL
 WHERE r.org_id=:org AND r.clinic_id=? AND NOT ${kioskPurposeDenied("e", "pharmacy")}
 AND NOT EXISTS (SELECT 1 FROM reservations v WHERE v.org_id=r.org_id AND v.prescription_id=r.id AND v.status='dispensed')`;

async function prescription(
  db: Repo,
  clinicId: string,
  id: string,
): Promise<Prescription | null> {
  const row = await db
    .statement(`${availableRx} AND r.id=?`, clinicId, id)
    .first<RxHeader>();
  if (!row) return null;
  const { results } = await db
    .statement(
      `SELECT l.id,l.sku_id AS skuId,s.brand,s.salt,s.strength_mg AS strengthMg,
    s.form,l.units,l.course_end AS courseEnd,l.directions,l.allow_equivalent AS allowEquivalent,s.nti,s.schedule_h AS scheduleH
    FROM prescription_lines l JOIN sku s ON s.org_id=l.org_id AND s.id=l.sku_id
    WHERE l.org_id=:org AND l.prescription_id=? ORDER BY l.id`,
      id,
    )
    .all<Prescription["lines"][number]>();
  return {
    ...row,
    allergies: recordedAllergies(
      profileAllergies(row.allergiesJson),
      profileAllergies(row.profileAllergiesJson),
      profileAllergies(row.reviewedAllergiesJson),
    ),
    reservationId: null,
    reservationExpiresAt: null,
    saleId: null,
    lines: results.map((line) => ({
      ...line,
      // Clinical dispensing uses the exact signed SKU. Legacy broad flags
      // do not identify an individually approved alternative.
      allowEquivalent: false,
      nti: Boolean(line.nti),
      scheduleH: Boolean(line.scheduleH),
    })),
  };
}

clinicalPharmacyRouter.get("/catalog", staffAccess("DOCTOR"), async (c) => {
  const p = c.get("principal");
  const { results } = await tenantDb({ db: c.env.DB, orgId: p.orgId })
    .statement(
      "SELECT id,brand,salt,strength_mg AS strengthMg,form,nti,schedule_h AS scheduleH FROM sku WHERE org_id=:org ORDER BY brand,id LIMIT 1000",
    )
    .all();
  return c.json({ items: results });
});

const newSku = skuSchema.strict().extend({
  brand: z.string().trim().min(1).max(120),
  salt: z.string().trim().min(1).max(120),
  strengthMg: z.number().int().positive().max(100000),
});

clinicalPharmacyRouter.post(
  "/catalog",
  staffAccess("HOSPITAL_ADMIN"),
  async (c) => {
    const p = c.get("principal");
    const item = await staffBody(c.req.raw, newSku);
    const stored = await tenantDb({ db: c.env.DB, orgId: p.orgId })
      .statement(
        `INSERT INTO sku(org_id,id,brand,salt,strength_mg,form,nti,schedule_h,gst_bps)
     VALUES(:org,?,?,?,?,?,?,?,?) ON CONFLICT(org_id,id) DO NOTHING RETURNING id`,
        item.id,
        item.brand,
        item.salt,
        item.strengthMg,
        item.form,
        Number(item.nti),
        Number(item.scheduleH),
        item.gstBps,
      )
      .first<{ id: string }>();
    if (!stored)
      throw new HTTPException(409, {
        message: "Medicine catalog identifier already exists",
      });
    return c.json(stored, 201);
  },
);

const editableEncounter = `FROM encounters e JOIN consents c ON c.org_id=e.org_id
  AND c.encounter_id=e.id AND c.purpose='care' AND c.revoked_at IS NULL
  WHERE e.org_id=:org AND e.clinic_id=? AND e.id=? AND e.status<>'emergency'
  AND NOT EXISTS (SELECT 1 FROM signed_prescriptions r WHERE r.org_id=e.org_id AND r.encounter_id=e.id)`;

clinicalPharmacyRouter.get("/prescriptions/draft/:id", staffAccess("DOCTOR"), async (c) => {
  const p = c.get("principal");
  const id = z.uuid().parse(c.req.param("id"));
  const row = await tenantDb({ db: c.env.DB, orgId: p.orgId }).statement(
    `SELECT (SELECT draft_json FROM clinician_prescription_drafts d
     WHERE d.org_id=e.org_id AND d.encounter_id=e.id AND d.actor_id=?) AS draft
     ${editableEncounter}`,
    p.userId, p.clinicId, id,
  ).first<{ draft: string | null }>();
  if (!row) throw new HTTPException(404, { message: "Draft encounter unavailable" });
  return c.json(row.draft ? savedPrescriptionDraftSchema.parse(JSON.parse(row.draft)) : null);
});

clinicalPharmacyRouter.put("/prescriptions/draft/:id", staffAccess("DOCTOR"), async (c) => {
  const p = c.get("principal");
  const id = z.uuid().parse(c.req.param("id"));
  const draft = await staffBody(c.req.raw, savedPrescriptionDraftSchema);
  const saved = { ...draft, revision: draft.revision + 1 };
  const row = await tenantDb({ db: c.env.DB, orgId: p.orgId }).statement(
    `INSERT INTO clinician_prescription_drafts(org_id,encounter_id,actor_id,revision,draft_json)
     SELECT e.org_id,e.id,?,?,? ${editableEncounter}
       AND (?=0 OR EXISTS (SELECT 1 FROM clinician_prescription_drafts d WHERE d.org_id=e.org_id AND d.encounter_id=e.id AND d.actor_id=?))
     ON CONFLICT(org_id,encounter_id,actor_id) DO UPDATE SET revision=excluded.revision,draft_json=excluded.draft_json
     WHERE clinician_prescription_drafts.revision=?
     RETURNING revision`,
    p.userId, saved.revision, JSON.stringify(saved), p.clinicId, id, draft.revision, p.userId, draft.revision,
  ).first();
  if (!row) throw new HTTPException(409, { message: "Draft encounter or revision changed" });
  return c.json(saved);
});

clinicalPharmacyRouter.post(
  "/prescriptions/quote",
  staffAccess("DOCTOR"),
  async (c) => {
    const p = c.get("principal");
    const draft = await staffBody(c.req.raw, signPrescriptionSchema);
    const db = tenantDb({ db: c.env.DB, orgId: p.orgId });
    const checkedAt = new Date().toISOString();
    const { snapshot, approval } = await reviewPrescription(
      db, p, draft, checkedAt, (ids) => batches(db, p.clinicId, ids),
    );
    return c.json(prescriptionQuoteSchema.parse({
      checkedAt, approval, allergies: snapshot.allergies, lines: snapshot.lines, warnings: snapshot.warnings,
    }));
  },
);

clinicalPharmacyRouter.post(
  "/prescriptions",
  staffAccess("DOCTOR"),
  async (c) => {
    const p = c.get("principal");
    const { draft, checkedAt, approval } = await staffBody(c.req.raw, prescriptionApprovalSchema);
    const db = tenantDb({ db: c.env.DB, orgId: p.orgId });
    const age = Date.now() - Date.parse(checkedAt);
    if (age < 0 || age > 5 * 60_000 || today(new Date(checkedAt)) !== today())
      throw new HTTPException(409, { message: "Stock review expired. Check availability again." });
    const review = await reviewPrescription(
      db, p, draft, checkedAt, (ids) => batches(db, p.clinicId, ids),
    );
    if (!review.approval || !equalHash(approval, review.approval))
      throw new HTTPException(409, { message: "The prescription or eligibility changed. Review a fresh quote." });
    const { snapshot } = review;
    const id = crypto.randomUUID();
    const at = new Date().toISOString();
    const signatureHash = await tokenHash(
      JSON.stringify({ org: p.orgId, signer: p.userId, at, snapshot }),
    );
    try {
      await db.batch([
        db.statement(
          `INSERT INTO encounter_permissions(org_id,encounter_id,purpose,granted_at,actor_id)
         VALUES(:org,?,'pharmacy',?,?) ON CONFLICT(org_id,encounter_id,purpose) DO NOTHING`,
          draft.encounterId,
          at,
          p.userId,
        ),
        db.statement(
          `INSERT INTO signed_prescriptions(org_id,id,encounter_id,clinic_id,signed_by,signed_at,signature_hash,note,allergies_json,clinical_snapshot_json)
         VALUES(:org,?,?,?,?,?,?,?,?,?)`,
          id,
          draft.encounterId,
          p.clinicId,
          p.userId,
          at,
          signatureHash,
          draft.note,
          JSON.stringify(snapshot.allergies),
          JSON.stringify(snapshot),
        ),
        ...draft.lines.map((line, index) =>
          db.statement(
            `INSERT INTO prescription_lines(org_id,id,prescription_id,sku_id,units,course_end,directions,allow_equivalent)
         VALUES(:org,?,?,?,?,?,?,0)`,
            crypto.randomUUID(),
            id,
            snapshot.lines[index]!.finalSku.id,
            line.units,
            line.courseEnd,
            line.directions,
          ),
        ),
      ]);
    } catch {
      throw new HTTPException(409, {
        message:
          "Prescription could not be signed. Check clinic consent, catalog and existing prescriptions.",
      });
    }
    return c.json({ id }, 201);
  },
);

clinicalPharmacyRouter.get("/inflow", posRoles, async (c) => {
  const p = c.get("principal");
  const { results } = await tenantDb({ db: c.env.DB, orgId: p.orgId })
    .statement(`${availableRx} ORDER BY r.signed_at DESC LIMIT 50`, p.clinicId)
    .all<RxHeader>();
  return c.json({
    prescriptions: results.map(({ id, patientName, signedAt }) => ({
      id,
      patientName,
      signedAt,
    })),
  });
});

clinicalPharmacyRouter.get("/prescriptions/encounter/:id", staffAccess("DOCTOR"), async (c) => {
  const p = c.get("principal");
  const { id } = z.object({ id: z.uuid() }).parse(c.req.param());
  const record = await tenantDb({ db: c.env.DB, orgId: p.orgId }).statement(
    `SELECT rx.id, rx.clinical_snapshot_json AS snapshot
     FROM signed_prescriptions rx
     JOIN consents c ON c.org_id=rx.org_id AND c.encounter_id=rx.encounter_id AND c.purpose='care' AND c.revoked_at IS NULL
     WHERE rx.org_id=:org AND rx.clinic_id=? AND rx.encounter_id=?`,
    p.clinicId, id,
  ).first<{ id: string; snapshot: string | null }>();
  if (!record) throw new HTTPException(404, { message: "Signed prescription unavailable" });
  if (!record.snapshot) {
    const { results } = await tenantDb({ db: c.env.DB, orgId: p.orgId }).statement(
      `SELECT s.brand,s.salt,s.strength_mg AS strengthMg,s.form,l.units,l.course_end AS courseEnd,l.directions
       FROM prescription_lines l JOIN sku s ON s.org_id=l.org_id AND s.id=l.sku_id
       WHERE l.org_id=:org AND l.prescription_id=? ORDER BY l.id`,
      record.id,
    ).all();
    return c.json({ id: record.id, lines: results, quote: null });
  }
  const snapshot = JSON.parse(record.snapshot);
  const draft = signPrescriptionSchema.parse(snapshot.draft);
  const quote = prescriptionQuoteSchema.parse({ ...snapshot, approval: null });
  return c.json({
    id: record.id, quote,
    lines: draft.lines.map((line, index) => ({
      ...quote.lines[index]!.finalSku,
      units: line.units, courseEnd: line.courseEnd, directions: line.directions,
    })),
  });
});

clinicalPharmacyRouter.get("/inflow/:id/quote", posRoles, async (c) => {
  const p = c.get("principal");
  const db = tenantDb({ db: c.env.DB, orgId: p.orgId });
  const rx = await prescription(db, p.clinicId, c.req.param("id"));
  if (!rx)
    throw new HTTPException(404, { message: "Prescription unavailable" });
  return c.json(
    dispensingPlan(rx, { batches: await batches(db, p.clinicId) }, today()),
  );
});

clinicalPharmacyRouter.get("/receipts/:id", posRoles, async (c) => {
  const p = c.get("principal");
  const input = z.object({ id: z.uuid(), day: z.iso.date().optional() })
    .safeParse({ id: c.req.param("id"), day: c.req.query("day") });
  if (!input.success) throw new HTTPException(400, { message: "Invalid receipt reference or posted date" });
  const receipt = await completedClinicalReceipt(
    tenantDb({ db: c.env.DB, orgId: p.orgId }), p.clinicId, input.data.id, input.data.day ?? null,
  );
  const cash = receipt?.payments.find(({ method }) => method === "cash");
  if (!receipt || !cash) throw new HTTPException(404, { message: "Cash receipt unavailable" });
  return c.json({ ...receipt, method: cash.method, amountPaise: cash.amountPaise });
});

clinicalPharmacyRouter.get(
  "/inventory",
  staffAccess("CASHIER", "CLINIC_ADMIN", "HOSPITAL_ADMIN"),
  async (c) => {
    const p = c.get("principal");
    const stock = await batches(
      tenantDb({ db: c.env.DB, orgId: p.orgId }),
      p.clinicId,
    );
    return c.json({
      batches:
        p.role === "CASHIER"
          ? stock.map(({ costPaise: _cost, ...batch }) => batch)
          : stock,
    });
  },
);

clinicalPharmacyRouter.post("/checkout", posRoles, async (c) => {
  const p = c.get("principal");
  const db = tenantDb({ db: c.env.DB, orgId: p.orgId });
  const payload = await staffBody(c.req.raw, cashierCheckout);
  const key = z.uuid().safeParse(c.req.header("Idempotency-Key"));
  if (!key.success)
    throw new HTTPException(400, { message: "Checkout reference required" });
  const hash = await tokenHash(JSON.stringify(payload));
  const replay = () =>
    db
      .statement(
        `SELECT cr.request_hash,s.id,s.total_paise AS totalPaise,s.created_at AS createdAt
    FROM command_receipts cr JOIN sales s ON s.org_id=cr.org_id AND s.id=cr.result_id AND s.clinic_id=? AND s.status='completed'
    WHERE cr.org_id=:org AND cr.actor_id=? AND cr.kind='checkout' AND cr.key=?`,
        p.clinicId,
        p.userId,
        key.data,
      )
      .first<{
        request_hash: string;
        id: string;
        totalPaise: number;
        createdAt: string;
      }>();
  function reply(
    value: NonNullable<Awaited<ReturnType<typeof replay>>>,
    status: 200 | 201,
  ) {
    if (value.request_hash !== hash)
      throw new HTTPException(409, {
        message: "Checkout reference already used",
      });
    return c.json(
      {
        id: value.id,
        totalPaise: value.totalPaise,
        createdAt: value.createdAt,
      },
      status,
    );
  }
  const prior = await replay();
  if (prior) return reply(prior, 200);
  const [rx, stock] = await Promise.all([
    prescription(db, p.clinicId, payload.prescriptionId),
    batches(db, p.clinicId),
  ]);
  if (!rx) {
    const winner = await replay();
    if (winner) return reply(winner, 200);
    throw new HTTPException(404, { message: "Prescription unavailable" });
  }
  const plan = dispensingPlan(rx, { batches: stock }, today());
  if (!plan.complete || plan.totalPaise !== payload.expectedTotalPaise) {
    const winner = await replay();
    if (winner) return reply(winner, 200);
    throw new HTTPException(409, {
      message: "Stock or prices changed. Review a fresh quote.",
    });
  }
  const byBatch = new Map(stock.map((batch) => [batch.id, batch]));
  const tax = plan.allocation.reduce((sum, line) => {
    const rate = byBatch.get(line.batchId)?.gstBps ?? 0;
    return (
      sum +
      roundDivide(
        BigInt(line.units) * BigInt(line.unitPricePaise) * BigInt(rate),
        BigInt(10000 + rate),
      )
    );
  }, 0);
  const cogs = plan.allocation.reduce((sum, line) => sum + line.costPaise, 0);
  const net = plan.totalPaise - tax;
  const cgst = payload.taxMode === "intra" ? roundDivide(BigInt(tax), 2n) : 0;
  const sgst = payload.taxMode === "intra" ? tax - cgst : 0;
  const igst = payload.taxMode === "inter" ? tax : 0;
  const reservation = crypto.randomUUID();
  const id = crypto.randomUUID();
  const journal = crypto.randomUUID();
  const at = new Date();
  const stamp = at.toISOString();
  const amounts: Array<[string, number, number]> = [
    ["cash", plan.totalPaise, 0],
    ["revenue", 0, net],
    ["gst_payable", 0, tax],
    ["cogs", cogs, 0],
    ["inventory", 0, cogs],
  ];
  try {
    await db.batch([
      db.statement(
        `INSERT INTO reservations(org_id,id,prescription_id,clinic_id,created_by,created_at,expires_at,status)
        VALUES(:org,?,?,?,?,?,?,'held')`,
        reservation,
        rx.id,
        p.clinicId,
        p.userId,
        stamp,
        new Date(at.getTime() + 60_000).toISOString(),
      ),
      ...plan.allocation.map((line) =>
        db.statement(
          `INSERT INTO reservation_lines(org_id,reservation_id,line_id,batch_id,units,unit_price_paise,unit_cost_paise)
        VALUES(:org,?,?,?,?,?,?)`,
          reservation,
          line.lineId,
          line.batchId,
          line.units,
          line.unitPricePaise,
          byBatch.get(line.batchId)?.costPaise ?? 0,
        ),
      ),
      db.statement(
        `INSERT INTO sales(org_id,id,reservation_id,clinic_id,created_by,created_at,status,total_paise,net_paise,tax_paise,cgst_paise,sgst_paise,igst_paise,cost_paise)
        VALUES(:org,?,?,?,?,?,'pending',?,?,?,?,?,?,?)`,
        id,
        reservation,
        p.clinicId,
        p.userId,
        stamp,
        plan.totalPaise,
        net,
        tax,
        cgst,
        sgst,
        igst,
        cogs,
      ),
      db.statement(
        "INSERT INTO sale_payments(org_id,sale_id,method,amount_paise) VALUES(:org,?,'cash',?)",
        id,
        plan.totalPaise,
      ),
      db.statement(
        "INSERT INTO journals(org_id,id,clinic_id,ref_type,ref_id,date,status) VALUES(:org,?,?,'sale',?,?,'draft')",
        journal,
        p.clinicId,
        id,
        today(at),
      ),
      ...amounts
        .filter(([, debit, credit]) => debit || credit)
        .map(([account, debit, credit]) =>
          db.statement(
            "INSERT INTO journal_lines(org_id,id,journal_id,account,debit_paise,credit_paise) VALUES(:org,?,?,?,?,?)",
            crypto.randomUUID(),
            journal,
            account,
            debit,
            credit,
          ),
        ),
      db.statement(
        "UPDATE journals SET status='posted' WHERE org_id=:org AND clinic_id=? AND id=?",
        p.clinicId,
        journal,
      ),
      db.statement(
        "UPDATE reservations SET status='dispensed' WHERE org_id=:org AND clinic_id=? AND id=?",
        p.clinicId,
        reservation,
      ),
      db.statement(
        "UPDATE sales SET status='completed' WHERE org_id=:org AND clinic_id=? AND id=?",
        p.clinicId,
        id,
      ),
      db.statement(
        "INSERT INTO command_receipts(org_id,actor_id,kind,key,request_hash,result_id) VALUES(:org,?,'checkout',?,?,?)",
        p.userId,
        key.data,
        hash,
        id,
      ),
    ]);
  } catch {
    const winner = await replay();
    if (winner) return reply(winner, 200);
    throw new HTTPException(409, {
      message:
        "Checkout could not be posted. Review stock and accounting status.",
    });
  }
  return reply(
    { request_hash: hash, id, totalPaise: plan.totalPaise, createdAt: stamp },
    201,
  );
});

export const postedLedgerRouter = new Hono<IntegrationContext>();
postedLedgerRouter.get(
  "/",
  staffAccess("SUPER_ADMIN", "OWNER", "HOSPITAL_ADMIN"),
  async (c) => {
    const p = c.get("principal");
    const db = tenantDb({ db: c.env.DB, orgId: p.orgId });
    const [accounts, entries, settings] = await Promise.all([
      db
        .statement(`SELECT l.account,SUM(l.debit_paise) AS debitPaise,SUM(l.credit_paise) AS creditPaise
      FROM journal_lines l JOIN journals j ON j.org_id=l.org_id AND j.id=l.journal_id AND j.status='posted'
      WHERE l.org_id=:org GROUP BY l.account ORDER BY l.account`)
        .all(),
      db
        .statement(`SELECT j.id,j.ref_id AS referenceId,j.ref_type AS referenceType,j.date,
      SUM(l.debit_paise) AS debitPaise,SUM(l.credit_paise) AS creditPaise
      FROM journals j JOIN journal_lines l ON l.org_id=j.org_id AND l.journal_id=j.id
      WHERE j.org_id=:org AND j.status='posted' GROUP BY j.id,j.ref_id,j.ref_type,j.date ORDER BY j.date DESC,j.id LIMIT 100`)
        .all(),
      db
        .statement(
          "SELECT lock_date AS lockDate FROM accounting_settings WHERE org_id=:org",
        )
        .first<{ lockDate: string | null }>(),
    ]);
    return c.json({
      accounts: accounts.results,
      entries: entries.results,
      lockDate: settings?.lockDate ?? null,
    });
  },
);

postedLedgerRouter.post("/lock", staffAccess("SUPER_ADMIN"), async (c) => {
  const p = c.get("principal");
  const { lockDate } = await staffBody(
    c.req.raw,
    z.strictObject({
      lockDate: z.iso.date().refine((date) => date <= today()),
    }),
  );
  const changed = await tenantDb({ db: c.env.DB, orgId: p.orgId })
    .statement(
      `INSERT INTO accounting_settings(org_id,lock_date) VALUES(:org,?)
     ON CONFLICT(org_id) DO UPDATE SET lock_date=excluded.lock_date WHERE accounting_settings.lock_date IS NULL OR accounting_settings.lock_date<excluded.lock_date
     RETURNING lock_date AS lockDate`,
      lockDate,
    )
    .first();
  if (!changed)
    throw new HTTPException(409, { message: "The period is already locked" });
  return c.json(changed);
});
