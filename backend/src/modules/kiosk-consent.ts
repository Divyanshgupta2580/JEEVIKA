export const kioskOptionalPurposes = ["pharmacy", "remote", "research"] as const;
type OptionalPurpose = (typeof kioskOptionalPurposes)[number];

/** Non-kiosk encounters retain their own workflows and authorization. */
export function kioskPurposeDenied(
  encounter: "e" | "cbc_reports",
  purpose: OptionalPurpose,
) {
  const encounterId = encounter === "e" ? "e.id" : "cbc_reports.encounter_id";
  return `(EXISTS (SELECT 1 FROM kiosk_intakes k
    WHERE k.org_id=${encounter}.org_id AND k.encounter_id=${encounterId}
    AND COALESCE(json_extract(k.consent_json,'$.${purpose}'),0)<>1)
    OR EXISTS (SELECT 1 FROM kiosk_consent_withdrawals w
    WHERE w.org_id=${encounter}.org_id AND w.encounter_id=${encounterId} AND w.purpose='${purpose}'))`;
}
