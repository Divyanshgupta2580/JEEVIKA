import type { ClinicalReceipt } from "../../../../packages/shared/clinical-receipt";
import type { tenantDb } from "../../database";

type Repo = ReturnType<typeof tenantDb>;
type ReceiptRow = Omit<ClinicalReceipt, "payments" | "lines"> & { payments: string; lines: string };

export async function completedClinicalReceipt(
  db: Repo,
  clinicId: string,
  id: string,
  day: string | null,
): Promise<ClinicalReceipt | null> {
  const row = await db.statement(
    `SELECT s.id,r.prescription_id AS prescriptionId,s.clinic_id AS clinicId,c.name AS clinicName,
       d.address AS clinicAddress,j.id AS journalId,j.date AS businessDay,s.created_at AS createdAt,
       s.total_paise AS totalPaise,s.net_paise AS netPaise,s.tax_paise AS taxPaise,
       s.cgst_paise AS cgstPaise,s.sgst_paise AS sgstPaise,s.igst_paise AS igstPaise,
       (SELECT json_group_array(json_object('method',p.method,'amountPaise',p.amount_paise))
          FROM (SELECT method,amount_paise FROM sale_payments WHERE org_id=s.org_id AND sale_id=s.id ORDER BY method) p) AS payments,
       (SELECT json_group_array(json_object(
          'batchId',q.batch_id,'batchNo',q.batch_no,'expiry',q.expiry,'brand',q.brand,
          'strengthMg',q.strength_mg,'units',q.units,'unitPricePaise',q.unit_price_paise,
          'totalPaise',q.units*q.unit_price_paise
        )) FROM (
          SELECT a.batch_id,b.batch_no,b.expiry,k.brand,k.strength_mg,a.units,a.unit_price_paise
          FROM reservation_lines a
          JOIN inventory_batches b ON b.org_id=a.org_id AND b.id=a.batch_id AND b.clinic_id=s.clinic_id
          JOIN sku k ON k.org_id=b.org_id AND k.id=b.sku_id
          WHERE a.org_id=s.org_id AND a.reservation_id=s.reservation_id ORDER BY b.expiry,b.id,a.line_id
        ) q) AS lines
     FROM sales s
     JOIN reservations r ON r.org_id=s.org_id AND r.clinic_id=s.clinic_id AND r.id=s.reservation_id AND r.status='dispensed'
     JOIN journals j ON j.org_id=s.org_id AND j.clinic_id=s.clinic_id AND j.ref_type='sale' AND j.ref_id=s.id AND j.status='posted'
     JOIN clinics c ON c.org_id=s.org_id AND c.id=s.clinic_id
     LEFT JOIN command_clinic_details d ON d.org_id=c.org_id AND d.clinic_id=c.id
     WHERE s.org_id=:org AND s.clinic_id=? AND s.id=? AND s.status='completed' AND (? IS NULL OR j.date=?)`,
    clinicId, id, day, day,
  ).first<ReceiptRow>();
  if (!row) return null;
  const payments = JSON.parse(row.payments) as ClinicalReceipt["payments"];
  const lines = JSON.parse(row.lines) as ClinicalReceipt["lines"];
  if (!lines.length || lines.reduce((sum, line) => sum + line.totalPaise, 0) !== row.totalPaise ||
      payments.reduce((sum, payment) => sum + payment.amountPaise, 0) !== row.totalPaise) {
    return null;
  }
  return { ...row, payments, lines };
}
