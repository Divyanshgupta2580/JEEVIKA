import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import {
  courseExpiryCutoff,
  dispensingPlan,
  hasRecordedMedicineAllergy,
} from "../../../../packages/engine/dispensing";
import { checkHerbDrugInteractions } from "../../../../packages/engine/herbDrugInteractions";
import { clinicalReviewDetailsSchema, type Principal } from "../../../../packages/shared/integration";
import {
  skuSchema,
  type Inventory,
  type PrescriptionDraft,
  type PrescriptionQuote,
} from "../../../../packages/shared/operations";
import type { tenantDb } from "../../database";
import { kioskPurposeDenied } from "../kiosk-consent";

type Repo = ReturnType<typeof tenantDb>;
type Medicine = z.infer<typeof skuSchema>;
type CatalogRow = Omit<Medicine, "nti" | "scheduleH"> & { nti: number; scheduleH: number };
type ReviewRow = {
  patientId: string;
  patientName: string;
  profileAllergiesJson: string | null;
  revision: number;
  detailsJson: string;
  secret: string;
};

export function recordedAllergies(...lists: readonly string[][]) {
  const entries = new Map<string, string>();
  for (const name of lists.flat()) {
    const trimmed = name.trim();
    if (trimmed) entries.set(trimmed.toLowerCase(), trimmed);
  }
  return [...entries.values()];
}

export function profileAllergies(raw: string | null) {
  return z.array(z.string()).parse(JSON.parse(raw ?? "[]"));
}

const isoBytes = new TextEncoder();
async function approvalCode(secret: string, data: unknown) {
  const key = await crypto.subtle.importKey(
    "raw", isoBytes.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, isoBytes.encode(JSON.stringify(data)));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function clinicalDay(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(date);
}

export async function reviewPrescription(
  db: Repo,
  doctor: Principal,
  draft: PrescriptionDraft,
  checkedAt: string,
  readBatches: (skuIds: string[]) => Promise<Inventory["batches"]>,
) {
  const row = await db.statement(
    `SELECT p.id AS patientId,p.name AS patientName,p.allergies_json AS profileAllergiesJson,
       r.revision,r.details_json AS detailsJson,k.secret
     FROM encounters e
     JOIN consents c ON c.org_id=e.org_id AND c.encounter_id=e.id AND c.purpose='care' AND c.revoked_at IS NULL
     JOIN patients p ON p.org_id=e.org_id AND p.id=e.patient_id
     JOIN clinical_reviews r ON r.org_id=e.org_id AND r.encounter_id=e.id
       AND r.revision=(SELECT MAX(rr.revision) FROM clinical_reviews rr WHERE rr.org_id=e.org_id AND rr.encounter_id=e.id)
     JOIN clinical_quote_keys k ON k.org_id=e.org_id AND k.clinic_id=e.clinic_id
     WHERE e.org_id=:org AND e.clinic_id=? AND e.id=? AND e.status='reviewed'
       AND NOT ${kioskPurposeDenied("e", "pharmacy")}
       AND NOT EXISTS (SELECT 1 FROM encounter_permissions ep
         WHERE ep.org_id=e.org_id AND ep.encounter_id=e.id AND ep.purpose='pharmacy' AND ep.revoked_at IS NOT NULL)`,
    doctor.clinicId, draft.encounterId,
  ).first<ReviewRow>();
  if (!row) throw new HTTPException(404, { message: "Reviewed encounter or pharmacy consent unavailable" });
  const context = row;
  const day = clinicalDay();
  if (draft.lines.some((line) => line.courseEnd < day))
    throw new HTTPException(400, { message: "Treatment course has ended" });
  const selected = draft.lines.map((line) => line.approvedSubstituteSkuId ?? line.skuId);
  if (new Set(selected).size !== selected.length)
    throw new HTTPException(400, { message: "Combine duplicate final medicine lines" });
  const skuIds = [...new Set([...selected, ...draft.lines.map((line) => line.skuId)])];
  const [{ results }, stock] = await Promise.all([
    db.statement(
      `SELECT id,brand,salt,strength_mg AS strengthMg,form,nti,schedule_h AS scheduleH,gst_bps AS gstBps
       FROM sku WHERE org_id=:org AND id IN (SELECT value FROM json_each(?))`,
      JSON.stringify(skuIds),
    ).all<CatalogRow>(),
    readBatches(skuIds),
  ]);
  const catalog = new Map(results.map((row) => [row.id, {
    ...row, nti: Boolean(row.nti), scheduleH: Boolean(row.scheduleH),
  }]));
  const details = clinicalReviewDetailsSchema.parse(JSON.parse(context.detailsJson));
  const allergies = recordedAllergies(
    profileAllergies(context.profileAllergiesJson), details.allergies ?? [], draft.allergies,
  );
  const warnings: string[] = [];
  const lines = draft.lines.map((line): PrescriptionQuote["lines"][number] => {
    const prescribedSku = catalog.get(line.skuId);
    const finalSku = catalog.get(line.approvedSubstituteSkuId ?? line.skuId);
    if (!prescribedSku || !finalSku)
      throw new HTTPException(400, { message: "Medicine is missing from the approved catalog" });
    const substituted = Boolean(line.approvedSubstituteSkuId);
    if (substituted && (
      finalSku.id === prescribedSku.id || finalSku.nti || prescribedSku.nti ||
      finalSku.salt.toLowerCase() !== prescribedSku.salt.toLowerCase() ||
      finalSku.strengthMg !== prescribedSku.strengthMg || finalSku.form !== prescribedSku.form ||
      finalSku.scheduleH !== prescribedSku.scheduleH
    )) throw new HTTPException(400, { message: "The selected substitution is not equivalent" });

    const interactions = checkHerbDrugInteractions(
      [finalSku.salt, finalSku.brand], details.complementaryMedicines ?? [],
    );
    warnings.push(...interactions.map((interaction) =>
      `${interaction.severity}: ${interaction.allopathicDrug} / ${interaction.ayurvedicHerb}. ${interaction.clinicalRisk}`,
    ));
    const interactionBlock = interactions.some(({ severity }) =>
      severity === "CONTRAINDICATED" || severity === "HIGH_RISK",
    );
    function check(sku: Medicine) {
      const candidates = stock.filter((batch) => batch.skuId === sku.id);
      const plan = dispensingPlan({
        id: draft.encounterId, encounterId: draft.encounterId, patientId: context.patientId,
        patientName: context.patientName, clinicId: doctor.clinicId, signedBy: doctor.userId,
        signedAt: checkedAt, signatureHash: "", note: draft.note, allergies,
        reservationId: null, reservationExpiresAt: null, saleId: null,
        lines: [{ ...sku, ...line, id: draft.encounterId, skuId: sku.id }],
      }, { batches: candidates }, day);
      const eligibleUnits = candidates.filter((batch) => batch.expiry >= courseExpiryCutoff(line.courseEnd))
        .reduce((sum, batch) => sum + batch.available, 0);
      return {
        total: plan.complete ? plan.totalPaise : null,
        eligibleUnits,
        overflow: candidates.length > 200,
        reason: plan.issues[0]?.reason ?? null,
      };
    }
    const final = check(finalSku);
    const allergyBlock = hasRecordedMedicineAllergy(allergies, finalSku);
    const blocked = allergyBlock || interactionBlock || final.overflow ||
      Boolean(final.reason && final.eligibleUnits >= line.units);
    const noEligibleStock = final.reason && final.eligibleUnits === 0 && !blocked;
    const hasUnreservedStock = stock.some((batch) => batch.skuId === finalSku.id && batch.available > 0);
    const reason = interactionBlock
      ? "Recorded medicines require an updated clinical review"
      : noEligibleStock
        ? hasUnreservedStock
          ? "Clinic stock expires before course end + 14 days"
          : "The selected medicine is out of stock at this clinic"
        : final.reason;
    return {
      prescribedSku, finalSku, units: line.units,
      eligibleUnits: allergyBlock || interactionBlock ? 0 : final.eligibleUnits,
      blocked,
      reason,
      quotedTotalPaise: final.total,
      originalTotalPaise: substituted ? check(prescribedSku).total : final.total,
    };
  });
  const snapshot = {
    checkedAt, revision: context.revision, profileAllergiesJson: context.profileAllergiesJson,
    draft, allergies, warnings: [...new Set(warnings)], lines,
  };
  const ready = lines.every((line) => !line.blocked && (line.reason === null || draft.unavailableReason));
  const approval = ready ? await approvalCode(context.secret, {
    orgId: doctor.orgId, clinicId: doctor.clinicId, actorId: doctor.userId, snapshot,
  }) : null;
  return { snapshot, approval };
}
