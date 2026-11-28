import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import type { HqFinance } from "../../../../packages/shared/hq-command";
import type { IntegrationContext } from "../../context";
import { tenantDb } from "../../database";
import { staffAccess } from "../../staff-access";
import { clinicalDay } from "../dispensing/prescription-review";
import { completedClinicalReceipt } from "../dispensing/receipt";

const filters = z.object({
  period: z.enum(["today", "week", "month", "all"]).default("today"),
  clinic: z.string().min(1).max(100).optional(),
  payment: z.enum(["cash", "upi", "card", "credit"]).optional(),
  service: z.enum(["PHARMACY", "CONSULTATION", "IPD"]).optional(),
  group: z.enum(["clinic_id", "payment_mode", "sale_type"]).default("clinic_id"),
  receipt: z.string().trim().toLowerCase().max(100).optional(),
});

const report = `WITH cfg AS (SELECT :org AS org_id,? AS clinic_id,? AS date_from,? AS date_to,? AS payment,? AS service,? AS group_by,? AS receipt_search),
  posted AS (
    SELECT j.* FROM journals j JOIN cfg q ON q.org_id=j.org_id
    WHERE j.status='posted' AND (q.clinic_id IS NULL OR q.clinic_id=j.clinic_id)
      AND (q.date_from IS NULL OR j.date>=q.date_from) AND j.date<=q.date_to
  ),
  totals AS (
    SELECT j.id,
      COALESCE(SUM(l.debit_paise),0) AS debit,COALESCE(SUM(l.credit_paise),0) AS credit,
      COALESCE(SUM(CASE WHEN l.account='revenue' THEN l.credit_paise-l.debit_paise END),0) AS revenue,
      COALESCE(SUM(CASE WHEN l.account='cogs' THEN l.debit_paise-l.credit_paise END),0) AS cogs,
      COALESCE(SUM(CASE WHEN l.account='inventory_writeoff_loss' THEN l.debit_paise-l.credit_paise END),0) AS writeoff
    FROM posted j LEFT JOIN journal_lines l ON l.org_id=j.org_id AND l.journal_id=j.id GROUP BY j.id
  ),
  sales_in_period AS (
    SELECT s.* FROM sales s JOIN cfg q ON q.org_id=s.org_id
    LEFT JOIN journals j ON j.org_id=s.org_id AND j.clinic_id=s.clinic_id
      AND j.ref_type='sale' AND j.ref_id=s.id AND j.status='posted'
    WHERE s.status='completed' AND (q.clinic_id IS NULL OR q.clinic_id=s.clinic_id)
      AND (q.date_from IS NULL OR COALESCE(j.date,date(s.created_at,'+330 minutes'))>=q.date_from)
      AND COALESCE(j.date,date(s.created_at,'+330 minutes'))<=q.date_to
  ),
  settled AS (
    SELECT s.*,j.date AS business_day,t.revenue,t.cogs,t.debit,t.credit
    FROM sales_in_period s JOIN posted j
      ON j.org_id=s.org_id AND j.clinic_id=s.clinic_id AND j.ref_type='sale' AND j.ref_id=s.id
    JOIN totals t ON t.id=j.id
  ),
  expenses AS (
    SELECT e.clinic_id,e.amount_paise-e.tax_paise AS amount
    FROM command_expenses e JOIN cfg q ON q.org_id=e.org_id
    WHERE e.voided_at IS NULL AND (q.clinic_id IS NULL OR e.clinic_id=q.clinic_id)
      AND (q.date_from IS NULL OR e.expense_date>=q.date_from) AND e.expense_date<=q.date_to
    UNION ALL
    SELECT j.clinic_id,t.writeoff FROM posted j JOIN totals t ON t.id=j.id WHERE t.writeoff<>0
  ),
  branches AS (
    SELECT c.id AS clinicId,
     COALESCE((SELECT SUM(s.total_paise) FROM settled s WHERE s.clinic_id=c.id),0) AS grossPaise,
     COALESCE((SELECT SUM(s.revenue) FROM settled s WHERE s.clinic_id=c.id),0) AS revenuePaise,
     COALESCE((SELECT SUM(s.cogs) FROM settled s WHERE s.clinic_id=c.id),0) AS cogsPaise,
     COALESCE((SELECT SUM(e.amount) FROM expenses e WHERE e.clinic_id=c.id),0) AS operatingExpensesPaise,
     (SELECT COUNT(*) FROM settled s WHERE s.clinic_id=c.id) AS saleCount
    FROM clinics c JOIN cfg q ON q.org_id=c.org_id WHERE q.clinic_id IS NULL OR c.id=q.clinic_id
  ),
  selected AS (
    SELECT s.*,c.name AS clinic_name,COALESCE(
      (SELECT SUM(p.amount_paise) FROM sale_payments p WHERE p.org_id=s.org_id AND p.sale_id=s.id AND p.method=q.payment),
      CASE WHEN q.payment IS NULL THEN s.total_paise ELSE 0 END
    ) AS selected_gross
    FROM settled s JOIN cfg q ON q.org_id=s.org_id JOIN clinics c ON c.org_id=s.org_id AND c.id=s.clinic_id
    WHERE (q.service IS NULL OR q.service='PHARMACY')
      AND (q.receipt_search IS NULL OR instr(lower(s.id),q.receipt_search)>0)
      AND (q.payment IS NULL OR EXISTS (SELECT 1 FROM sale_payments p WHERE p.org_id=s.org_id AND p.sale_id=s.id AND p.method=q.payment))
  ),
  segments AS (
    SELECT CASE WHEN q.group_by='sale_type' THEN 'PHARMACY' ELSE s.clinic_name END AS name,
      SUM(s.selected_gross) AS paise
    FROM selected s JOIN cfg q ON q.org_id=s.org_id WHERE q.group_by<>'payment_mode'
    GROUP BY CASE WHEN q.group_by='sale_type' THEN 'PHARMACY' ELSE s.clinic_id END
    UNION ALL
    SELECT p.method AS name,SUM(p.amount_paise) AS paise
    FROM selected s JOIN cfg q ON q.org_id=s.org_id
    JOIN sale_payments p ON p.org_id=s.org_id AND p.sale_id=s.id
    WHERE q.group_by='payment_mode' AND (q.payment IS NULL OR p.method=q.payment)
    GROUP BY p.method
  )
  SELECT
    (SELECT lock_date FROM accounting_settings a WHERE a.org_id=q.org_id) AS lockDate,
    (SELECT COUNT(*) FROM posted) AS journalCount,
    (SELECT COALESCE(SUM(debit),0) FROM totals) AS debitPaise,
    (SELECT COALESCE(SUM(credit),0) FROM totals) AS creditPaise,
    (SELECT COALESCE(SUM(total_paise),0) FROM settled) AS grossPaise,
    (SELECT COALESCE(SUM(revenue),0) FROM settled) AS revenuePaise,
    (SELECT COALESCE(SUM(cogs),0) FROM settled) AS cogsPaise,
    (SELECT COALESCE(SUM(amount),0) FROM expenses) AS operatingExpensesPaise,
    (SELECT COALESCE(SUM(amount),0) FROM expenses WHERE clinic_id IS NULL) AS centralExpensesPaise,
    (SELECT COUNT(*) FROM settled) AS saleCount,
    (SELECT COUNT(*) FROM sales_in_period s LEFT JOIN settled t ON t.id=s.id WHERE t.id IS NULL OR t.debit<>t.credit
       OR t.revenue<>s.net_paise OR t.cogs<>s.cost_paise OR s.total_paise<>COALESCE(
           (SELECT SUM(p.amount_paise) FROM sale_payments p WHERE p.org_id=s.org_id AND p.sale_id=s.id),0)
    ) AS unreconciledSales,
    (SELECT COUNT(*) FROM selected)>500 AS salesTruncated,
    (SELECT COUNT(*) FROM selected) AS selectedSaleCount,
    (SELECT COALESCE(SUM(selected_gross),0) FROM selected) AS selectedGrossPaise,
    (SELECT json_group_array(json_object('method',method,'amountPaise',total,'saleCount',sale_count)) FROM (
      SELECT p.method,SUM(p.amount_paise) AS total,COUNT(*) AS sale_count
      FROM settled s JOIN sale_payments p ON p.org_id=s.org_id AND p.sale_id=s.id
      GROUP BY p.method ORDER BY p.method
    )) AS paymentSummary,
    (SELECT json_group_array(json_object('date',day,'grossPaise',gross,'saleCount',count)) FROM
      (SELECT s.business_day AS day,SUM(s.total_paise) AS gross,COUNT(*) AS count
       FROM settled s GROUP BY day ORDER BY day)) AS daily,
    (SELECT json_group_array(json_object('clinicId',clinicId,'grossPaise',grossPaise,'revenuePaise',revenuePaise,
      'cogsPaise',cogsPaise,'operatingExpensesPaise',operatingExpensesPaise,'saleCount',saleCount,
      'profitPaise',revenuePaise-cogsPaise-operatingExpensesPaise)) FROM branches) AS branches,
    (SELECT json_group_array(json_object('name',name,'paise',paise)) FROM
       (SELECT name,paise FROM segments ORDER BY paise DESC,name)) AS segments,
    (SELECT json_group_array(json_object('id',s.id,'clinicId',s.clinic_id,'recordedAt',s.created_at,
      'businessDay',s.business_day,'grossPaise',s.total_paise,'netPaise',s.revenue,'cogsPaise',s.cogs,'taxPaise',s.tax_paise,
      'payments',json((SELECT json_group_array(json_object('method',p.method,'amountPaise',p.amount_paise))
       FROM sale_payments p WHERE p.org_id=s.org_id AND p.sale_id=s.id))))
      FROM (SELECT * FROM selected ORDER BY created_at DESC,id LIMIT 500) s) AS sales
  FROM cfg q`;

type ReportRow = Omit<HqFinance, "from" | "through" | "operatingProfitPaise" | "branches" | "segments" | "sales" | "salesTruncated" | "daily" | "paymentSummary"> & {
  branches: string; segments: string; sales: string; daily: string; paymentSummary: string; salesTruncated: 0 | 1;
};

export const hqFinance = new Hono<IntegrationContext>();
hqFinance.get("/branches/:clinic/receipts/:id", staffAccess("HOSPITAL_ADMIN", "OWNER", "SUPER_ADMIN", "CLINIC_ADMIN"), async (c) => {
  const input = z.object({ clinic: z.string().min(1).max(100), id: z.uuid(), day: z.iso.date().optional() })
    .safeParse({ ...c.req.param(), day: c.req.query("day") });
  if (!input.success) throw new HTTPException(400, { message: "Invalid clinic, receipt reference or posted date" });
  const { clinic, id, day } = input.data;
  const p = c.get("principal");
  if (p.role === "CLINIC_ADMIN" && p.clinicId !== clinic)
    throw new HTTPException(404, { message: "Receipt unavailable" });
  const db = tenantDb({ db: c.env.DB, orgId: p.orgId });
  const receipt = await completedClinicalReceipt(db, clinic, id, day ?? null);
  if (!receipt) throw new HTTPException(404, { message: "Receipt unavailable" });
  return c.json({ ...receipt, grossPaise: receipt.totalPaise });
});

hqFinance.get("/", staffAccess("HOSPITAL_ADMIN", "OWNER", "SUPER_ADMIN", "CLINIC_ADMIN"), async (c) => {
  const parsed = filters.safeParse(c.req.query());
  if (!parsed.success) throw new HTTPException(400, { message: "Invalid finance filters" });
  const input = parsed.data;
  const p = c.get("principal");
  if (p.role === "CLINIC_ADMIN" && (!p.clinicId || (input.clinic && p.clinicId !== input.clinic)))
    throw new HTTPException(404, { message: "Clinic unavailable" });
  const clinic = (p.role === "CLINIC_ADMIN" ? p.clinicId : input.clinic) ?? null;
  const db = tenantDb({ db: c.env.DB, orgId: p.orgId });
  if (clinic && !(await db.statement("SELECT id FROM clinics WHERE org_id=:org AND id=?", clinic).first()))
    throw new HTTPException(404, { message: "Clinic unavailable" });
  const through = clinicalDay();
  const start = new Date(`${through}T00:00:00.000Z`);
  const days = { all: 0, today: 0, week: 6, month: 29 };
  start.setUTCDate(start.getUTCDate() - days[input.period]);
  const from = input.period === "all" ? null : start.toISOString().slice(0, 10);
  const values = await db.statement(report, clinic, from, through, input.payment ?? null, input.service ?? null, input.group, input.receipt ?? null).first<ReportRow>();
  if (!values) throw new HTTPException(503, { message: "Finance unavailable" });
  const { branches, segments, sales, daily, paymentSummary, salesTruncated, ...summary } = values;
  const response: HqFinance = {
    ...summary, from, through,
    operatingProfitPaise: summary.revenuePaise - summary.cogsPaise - summary.operatingExpensesPaise,
    branches: JSON.parse(branches),
    segments: JSON.parse(segments),
    sales: JSON.parse(sales),
    daily: JSON.parse(daily),
    paymentSummary: JSON.parse(paymentSummary),
    salesTruncated: Boolean(salesTruncated),
  };
  return c.json(response);
});
