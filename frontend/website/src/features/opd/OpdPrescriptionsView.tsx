import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Check,
  CheckCircle2,
  Languages,
  Leaf,
  Pill,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  savedPrescriptionDraftSchema,
  type PrescriptionQuote,
  type SavedPrescriptionDraft,
} from "../../../../../packages/shared/operations";
import { staffApi } from "@/lib/staffApi";
import { paiseToRupeesString } from "@/lib/utils";
import { SignPrescription } from "@/components/ClinicalPharmacy";
import { PatientVernacularGuide } from "@/components/PatientVernacularGuide";
import { checkHerbDrugInteractions } from "@/lib/herbDrugInteractions";
import { OpdNoPatientPrompt, OpdPatientSummary, OpdSubpageHeader } from "./OpdChrome";
import { useOpdWorkspace } from "./opdContext";
import type { OpdPrescriptionItem } from "./opdMetricsAndAlerts";
import { WESTERN_CLINICAL_RECOMMENDATIONS } from "./westernClinicalRecommendations";

const INITIAL_NEW_MED: OpdPrescriptionItem = {
  drug: "",
  dosage: "",
  frequency: "",
  duration: "",
  availableInClinic: false,
  instructions: "",
  brandName: "",
  genericName: "",
};

type SignedOrder = {
  lines: Array<{ brand: string; salt: string; strengthMg: number; form: string; units: number; courseEnd: string; directions: string }>;
  quote: PrescriptionQuote | null;
};

export function OpdPrescriptionsView() {
  const {
    activePatient,
    activePatientKey,
    clinicalEncounterId,
    updatePatientPlan,
    markEncounterPrescriptionSigned,
    updatePrescriptionReview,
    restorePrescriptionDraft,
    markPrescriptionDraftSaved,
    cardiacChecks,
    setCardiacCheck,
  } = useOpdWorkspace();

  const [showAddMedModal, setShowAddMedModal] = useState(false);
  const [showSignPrescription, setShowSignPrescription] = useState(false);
  const [showVernacularGuide, setShowVernacularGuide] = useState(false);
  const [newMed, setNewMed] = useState<OpdPrescriptionItem>(INITIAL_NEW_MED);

  const [signedOrder, setSignedOrder] = useState<{ encounterId: string; order?: SignedOrder; error?: string }>();
  const prescriptionStatus = activePatient?.prescriptionStatus;
  const draftRevision = activePatient?.prescriptionDraftRevision;
  const draftPath = clinicalEncounterId ? `/clinical/pharmacy/prescriptions/draft/${clinicalEncounterId}` : undefined;
  const draftAvailable = activePatient?.consentActive && activePatient.status !== "STAT_ALERT" && !prescriptionStatus;
  const [draftLoadError, setDraftLoadError] = useState<{ encounterId: string; message: string }>();
  useEffect(() => {
    if (!clinicalEncounterId || !draftPath || !draftAvailable || draftRevision !== undefined) return;
    const controller = new AbortController();
    staffApi<unknown>(draftPath, { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) {
          restorePrescriptionDraft(clinicalEncounterId, savedPrescriptionDraftSchema.nullable().parse(result));
        }
      })
      .catch((error: Error) => {
        if (!controller.signal.aborted) setDraftLoadError({ encounterId: clinicalEncounterId, message: error.message });
      });
    return () => controller.abort();
  }, [clinicalEncounterId, draftPath, draftAvailable, draftRevision, restorePrescriptionDraft]);

  async function saveDraft() {
    if (!draftPath || !clinicalEncounterId || !activePatient || draftRevision === undefined) {
      throw new Error("Wait for the saved prescription draft to load.");
    }
    const saved = await staffApi<SavedPrescriptionDraft>(draftPath, {
      method: "PUT",
      body: JSON.stringify({
        revision: draftRevision,
        plan: activePatient.soap.plan.map((item) => ({
          ...item, availableInClinic: false,
        })),
        review: activePatient.prescriptionReview ?? {},
      }),
    });
    markPrescriptionDraftSaved(clinicalEncounterId, saved.revision);
  }

  useEffect(() => {
    if (!clinicalEncounterId || !prescriptionStatus) return;
    const controller = new AbortController();
    staffApi<SignedOrder>(`/clinical/pharmacy/prescriptions/encounter/${clinicalEncounterId}`, { signal: controller.signal })
      .then((order) => setSignedOrder({ encounterId: clinicalEncounterId, order }))
      .catch((error: Error) => {
        if (!controller.signal.aborted) setSignedOrder({ encounterId: clinicalEncounterId, error: error.message });
      });
    return () => controller.abort();
  }, [clinicalEncounterId, prescriptionStatus]);

  // Reset transient modal/form inputs cleanly when active encounter changes
  useEffect(() => {
    setShowAddMedModal(false);
    setShowSignPrescription(false);
    setShowVernacularGuide(false);
    setNewMed(INITIAL_NEW_MED);
  }, [activePatientKey]);

  const activeInteractions = useMemo(() => checkHerbDrugInteractions(
    activePatient?.soap.plan.filter((line) => line.drug.trim()) ?? [],
    activePatient?.clinicalReview?.complementaryMedicines ?? [],
  ), [activePatient?.soap.plan, activePatient?.clinicalReview]);

  const record = signedOrder?.encounterId === clinicalEncounterId ? signedOrder : undefined;
  const finalLines = record?.order?.lines;
  const signedQuote = record?.order?.quote;
  const priceLines = signedQuote?.lines ?? [];
  const hasComparablePrices = priceLines.some((line) => line.finalSku.id !== line.prescribedSku.id) &&
    priceLines.every((line) => line.originalTotalPaise !== null && line.quotedTotalPaise !== null);
  const originalTotal = hasComparablePrices
    ? priceLines.reduce((sum, line) => sum + (line.originalTotalPaise ?? 0), 0) : null;
  const finalTotal = hasComparablePrices
    ? priceLines.reduce((sum, line) => sum + (line.quotedTotalPaise ?? 0), 0) : null;
  const savings = originalTotal !== null && finalTotal !== null ? Math.max(0, originalTotal - finalTotal) : null;
  const price = (paise: number | null) => paise === null ? "Unavailable" : `₹${paiseToRupeesString(paise)}`;

  if (!activePatient) {
    return (
      <div className="jvk-opd-subpage space-y-5">
        <OpdSubpageHeader
          sectionTitle="Prescriptions"
          subtitle="Build Rx plans, verify clinical safety prerequisites, inspect PMBJP savings, and sign pharmacy orders."
          activeTab="rx"
        />
        <OpdNoPatientPrompt
          title="Select a patient encounter before managing prescriptions"
          description="Prescriptions are strictly bound to an authorized patient consultation encounter."
        />
      </div>
    );
  }

  const isCardiacAcuity =
    activePatient.status === "STAT_ALERT" ||
    activePatient.symptoms.some((s) => {
      const str = s.toLowerCase();
      return (
        str.includes("chest") ||
        str.includes("pressure") ||
        str.includes("angina") ||
        str.includes("infarction") ||
        str.includes("seene")
      );
    });

  const handleAddMedication = () => {
    if (!newMed.drug.trim()) return;
    const itemToAdd: OpdPrescriptionItem = {
      ...newMed,
      brandName: newMed.brandName || newMed.drug,
      genericName: newMed.genericName || newMed.drug,
    };
    updatePatientPlan(activePatientKey, [...activePatient.soap.plan, itemToAdd]);
    setNewMed(INITIAL_NEW_MED);
    setShowAddMedModal(false);
  };

  const handleRemoveMedication = (index: number) => {
    updatePatientPlan(
      activePatientKey,
      activePatient.soap.plan.filter((_, i) => i !== index),
    );
  };

  const handleQuickAddRecommendation = (item: OpdPrescriptionItem) => {
    const firstWord = (item.drug.toLowerCase().split(" ")[0] ?? "");
    const isDuplicate = activePatient.soap.plan.some(
      (p) =>
        (firstWord && p.drug.toLowerCase().includes(firstWord)) ||
        (item.genericName && p.genericName?.toLowerCase() === item.genericName.toLowerCase()),
    );
    if (isDuplicate) return;
    updatePatientPlan(activePatientKey, [
      ...activePatient.soap.plan,
      item,
    ]);
  };

  const allCardiacVerified =
    cardiacChecks.ecgVerified &&
    cardiacChecks.troponinVerified &&
    cardiacChecks.bleedRiskCleared;

  const hasSevereUnoverriddenHdi =
    activeInteractions.some((i) => i.severity === "CONTRAINDICATED" || i.severity === "HIGH_RISK");

  const canSignPrescription =
    Boolean(clinicalEncounterId) &&
    draftRevision !== undefined &&
    Boolean(activePatient.savedSoapNote) &&
    Boolean(activePatient.consentActive) &&
    !activePatient.prescriptionStatus;

  const recommendations = WESTERN_CLINICAL_RECOMMENDATIONS[activePatient.patientId] ?? [];

  return (
    <div id="tour-clinical-record" className="jvk-opd-subpage space-y-4">
      <OpdSubpageHeader
        sectionTitle="Prescriptions"
        subtitle="Build encounter-linked medications, verify safety prerequisites, evaluate PMBJP generic substitution, and sign for pharmacy."
        activeTab="rx"
      />

      <OpdPatientSummary patient={activePatient} encounterId={clinicalEncounterId ?? null} />
      {draftAvailable && draftRevision === undefined && (
        draftLoadError?.encounterId === clinicalEncounterId && draftLoadError ? (
          <p role="alert">Saved prescription draft unavailable. {draftLoadError.message}</p>
        ) : <p role="status">Loading prescription draft…</p>
      )}

      {/* Contextual Allergy & Blocking Safety Reminders */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-rose-900">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" aria-hidden="true" />
          <span>
            {signedQuote?.allergies.length
              ? `Allergies checked · ${signedQuote.allergies.join(", ")}`
              : "Verify recorded allergies before prescribing or signing"}
          </span>
        </div>
        {activePatient.prescriptionStatus && (
          <StatusChipBadge status={activePatient.prescriptionStatus} />
        )}
      </div>

      <div className="jvk-opd-rx-panels">
        {/* Section A — Smart Rx-to-Shelf Prescription Builder */}
        <section aria-label="Prescription builder" className="jvk-opd-card p-5 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EAE3D4] pb-3.5">
            <div className="flex items-center gap-2">
              <Pill className="w-4 h-4 text-[#047C61]" aria-hidden="true" />
              <h3 className="jvk-opd-panel-title jvk-opd-panel-title--accent">
                Smart Rx-to-Shelf Prescription Builder
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setShowAddMedModal(true)}
              disabled={Boolean(prescriptionStatus)}
              className="jvk-opd-primary-btn inline-flex min-h-10 items-center gap-1.5 px-3.5 py-2 text-xs font-bold"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Add Medication</span>
            </button>
          </div>

          {recommendations.length > 0 && (
            <div className="rounded-2xl border border-[#CBE0DC] bg-[#F1F8F6] p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[#0E2420]">
                  <Sparkles className="w-4 h-4 text-[#087F72]" aria-hidden="true" />
                  <span>Recommended Western Medicines (Evidence-Based CDS)</span>
                </div>
                <span className="rounded-full border border-[#BFE0D9] bg-white px-2.5 py-0.5 text-[10px] font-bold text-[#175B4B]">
                  Allopathic Protocol
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {recommendations.map((rec, rIdx) => {
                  const firstWord = (rec.drug.toLowerCase().split(" ")[0] ?? "");
                  const isAlreadyAdded = activePatient.soap.plan.some(
                    (p) =>
                      (firstWord && p.drug.toLowerCase().includes(firstWord)) ||
                      (rec.genericName &&
                        p.genericName?.toLowerCase() === rec.genericName.toLowerCase()),
                  );
                  return (
                    <div
                      key={rIdx}
                      className="rounded-xl border border-[#DCE8E4] bg-white p-3 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-[#0E2420]">{rec.drug}</span>
                          <span className="rounded bg-[#F1EFE8] px-1.5 py-0.5 text-[10px] font-mono font-semibold text-[#3F554D]">
                            {rec.dosage}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-[#586C64] truncate">{rec.instructions}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleQuickAddRecommendation(rec)}
                        disabled={isAlreadyAdded || Boolean(prescriptionStatus)}
                        className={`shrink-0 inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
                          isAlreadyAdded
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default"
                            : "bg-[#047C61] hover:bg-[#036450] text-white"
                        }`}
                      >
                        {isAlreadyAdded ? (
                          <>
                            <Check className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Added</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Add to Rx</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <h4 className="jvk-opd-panel-title">{finalLines ? `Signed Medications (${finalLines.length})` : `Draft Medications (${activePatient.soap.plan.length})`}</h4>
          {/* Medication List */}
          {activePatient.prescriptionStatus ? (
            <div className="space-y-2.5">
              {record?.error && <p role="alert">{record.error}</p>}
              {!record && <p role="status">Loading signed medicines…</p>}
              {finalLines?.map((line, index) => (
                <div key={index} className="rounded-xl border border-[#E3DDD0] bg-white p-3.5 text-sm">
                  <strong>{line.brand} · {line.salt} {line.strengthMg} mg {line.form}</strong>
                  <div>{line.units} units · Course end {line.courseEnd}</div>
                  <div className="break-words">{line.directions}</div>
                </div>
              ))}
            </div>
          ) : activePatient.soap.plan.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#D6CFC0] bg-[#FAF7F0] p-6 text-center text-sm text-[#586C64]">
              No draft medications added yet. Use <strong>Add Medication</strong> above or complete the authorized catalog form in <strong>Sign prescription for pharmacy</strong>.
            </div>
          ) : (
            <div className="space-y-2.5">
              {activePatient.soap.plan.map((med, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-[#E3DDD0] bg-white p-3.5 flex flex-wrap items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-[#0E2420]">{med.drug}</span>
                      <span className="rounded bg-[#F1EFE8] px-2 py-0.5 text-[11px] font-mono font-bold text-[#354E45]">
                        {med.dosage}
                      </span>
                      {med.isGenericSubstituted && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                          <Check className="w-3 h-3" aria-hidden="true" />
                          <span>Jan Aushadhi Generic</span>
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#586C64]">
                      <span>
                        Schedule: <strong className="text-[#0E2420]">{med.frequency || "Pending"}</strong>
                      </span>
                      <span>•</span>
                      <span>
                        Duration: <strong className="text-[#0E2420]">{med.duration || "Pending"}</strong>
                      </span>
                      <span>•</span>
                      <span className="italic">{med.directions || med.instructions || "Instructions pending"}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">

                    <button
                      type="button"
                      aria-label={`Remove ${med.drug}`}
                      onClick={() => handleRemoveMedication(idx)}
                      className="p-2 text-[#6B7E76] hover:text-rose-700 rounded-lg hover:bg-rose-50 transition-colors"
                      title="Remove Medication"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="jvk-opd-rx-side">
          {/* Section B — Clinical Safety & Prerequisite Verification */}
          {(activeInteractions.length > 0 || isCardiacAcuity) && (
            <section aria-label="Clinical safety verification" className="jvk-opd-card space-y-3 p-4">
              <h4 className="jvk-opd-panel-title flex items-start gap-2">
                <ShieldCheck className="h-5 w-5 shrink-0 text-[#087466]" aria-hidden="true" />
                <span className="jvk-opd-panel-title--accent">Prescription Safety Verification</span>
              </h4>
              {activeInteractions.length > 0 && (
                <div role="alert" className="rounded-2xl border-2 border-rose-300 bg-rose-50 p-4 sm:p-5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rose-200 pb-2.5">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-rose-600" aria-hidden="true" />
                      <h4 className="text-xs font-black uppercase tracking-wider text-rose-950">
                        Pharmacovigilance Sentinel: Critical Herb-Drug Interaction Detected
                      </h4>
                    </div>
                    <span className="rounded-full bg-rose-700 px-2.5 py-0.5 text-[11px] font-bold uppercase text-white">
                      {activeInteractions[0]?.severity}
                    </span>
                  </div>

                  {activeInteractions.map((interaction) => (
                    <div key={interaction.id} className="text-xs text-rose-950 space-y-1">
                      <div className="font-bold flex flex-wrap items-center gap-2">
                        <span>
                          {interaction.allopathicDrug} ({interaction.allopathicClass})
                        </span>
                        <Sparkles className="w-3.5 h-3.5 text-amber-600" aria-hidden="true" />
                        <span>
                          {interaction.ayurvedicHerb} ({interaction.ayurvedicClass})
                        </span>
                      </div>
                      <p className="text-rose-900">
                        <strong>Clinical Risk:</strong> {interaction.clinicalRisk}.
                      </p>
                      <p className="italic text-rose-800">
                        <strong>Mechanism:</strong> {interaction.mechanism}
                      </p>
                    </div>
                  ))}

                  <p className="border-t border-rose-200 pt-2 text-xs font-bold text-rose-950">
                    Verify the interaction against the selected catalogue medicine and the reviewed clinical record.
                  </p>
                </div>
              )}

              {isCardiacAcuity && (
                <div className="rounded-2xl border border-amber-300 bg-amber-50/70 p-4 sm:p-5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-amber-800" aria-hidden="true" />
                      <h4 className="text-xs font-black uppercase tracking-wider text-[#0E2420]">
                        AHA/ACC STEMI & Resuscitation Diagnostic Prerequisite Verification
                      </h4>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                        allCardiacVerified
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                          : "bg-amber-200 text-amber-950"
                      }`}
                    >
                      {allCardiacVerified ? "Clinician Prerequisites Verified" : "Pending Clinician Verification"}
                    </span>
                  </div>
                  <p className="text-xs text-[#4F635B]">
                    Verify each prerequisite directly from patient diagnostics before antiplatelet loading or dispensing:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                    <label className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-white p-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={cardiacChecks.ecgVerified}
                        onChange={(e) => setCardiacCheck("ecgVerified", e.target.checked)}
                        className="mt-0.5 h-4 w-4 accent-[#047C61]"
                      />
                      <div>
                        <span className="block font-bold text-[#0E2420]">12-Lead ECG</span>
                        <span className="text-[11px] text-[#586C64]">
                          {cardiacChecks.ecgVerified ? "Reviewed by clinician" : "Unverified — inspect ECG tracing"}
                        </span>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-white p-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={cardiacChecks.troponinVerified}
                        onChange={(e) => setCardiacCheck("troponinVerified", e.target.checked)}
                        className="mt-0.5 h-4 w-4 accent-[#047C61]"
                      />
                      <div>
                        <span className="block font-bold text-[#0E2420]">Troponin / Biomarker</span>
                        <span className="text-[11px] text-[#586C64]">
                          {cardiacChecks.troponinVerified ? "Result reviewed" : "Unverified — confirm lab biomarker"}
                        </span>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-white p-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={cardiacChecks.bleedRiskCleared}
                        onChange={(e) => setCardiacCheck("bleedRiskCleared", e.target.checked)}
                        className="mt-0.5 h-4 w-4 accent-[#047C61]"
                      />
                      <div>
                        <span className="block font-bold text-[#0E2420]">GI / CVA Bleed Risk</span>
                        <span className="text-[11px] text-[#586C64]">
                          {cardiacChecks.bleedRiskCleared
                            ? "Contraindications screened"
                            : "Unverified — screen active bleed risk"}
                        </span>
                      </div>
                    </label>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Section C — PMBJP Jan Aushadhi Generic Substitution */}
          <section
            aria-label="Jan Aushadhi generic substitution"
            className="rounded-2xl border border-[#BFE0CE] bg-gradient-to-br from-[#EEF8F2] via-[#F4FAF6] to-[#FEFBF6] p-5 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#047C61] text-white">
                  <Leaf className="w-4 h-4" aria-hidden="true" />
                </span>
                <div>
                  <h4 className="jvk-opd-panel-title">
                    Pradhan Mantri Bhartiya Janaushadhi Pariyojana (PMBJP) Generic Substitution
                  </h4>
                  <p className="text-xs text-[#3F554D]">
                    Clinician review required to verify generic substitution appropriateness (for example NTI drugs remain restricted on the pharmacy catalog).
                  </p>
                </div>
              </div>

              <button type="button" disabled={!canSignPrescription} onClick={() => setShowSignPrescription(true)}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#047C61] px-4 py-2 text-xs font-bold text-white disabled:opacity-50">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" aria-hidden="true" />
                Choose an equivalent
              </button>
            </div>

            <div className="jvk-opd-savings-grid">
              <div className="rounded-xl border border-[#DCE8DF] bg-white p-3">
                <span className="block text-[11px] font-bold uppercase text-[#586C64]">
                  Original course price
                </span>
                <span className="mt-1 block text-lg font-bold text-[#354E45] line-through">
                  {price(originalTotal)}
                </span>
              </div>
              <div className="rounded-xl border border-[#DCE8DF] bg-white p-3">
                <span className="block text-[11px] font-bold uppercase text-[#047C61]">
                  Approved course price
                </span>
                <span className="mt-1 block text-lg font-bold text-[#0E2420]">
                  {price(finalTotal)}
                </span>
              </div>
              <div className="rounded-xl bg-[#047C61] p-3 text-white shadow-xs">
                <span className="block text-[11px] font-bold uppercase text-emerald-100">
                  Savings at signing
                </span>
                <span className="mt-1 block text-lg font-bold">
                  {price(savings)}
                </span>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Section D — Prescription Integrity, Vernacular Guide & Sign for Pharmacy */}
      <section aria-label="Prescription completion" className="jvk-opd-card-sage p-5 sm:p-6 space-y-4">
        <h3 className="jvk-opd-panel-title flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-[#087466]" aria-hidden="true" />
          Prescription Authorization
        </h3>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#D4E4D8] bg-white p-3.5 text-xs">
          <div className="flex items-center gap-2.5">
            {activePatient.prescriptionStatus ? (
              <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0" aria-hidden="true" />
            ) : (
              <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0" aria-hidden="true" />
            )}
            <div>
              <div className="font-bold text-[#0E2420]">
                {activePatient.prescriptionStatus === "dispensed"
                  ? "Prescription signed and dispensed by clinic pharmacy"
                  : activePatient.prescriptionStatus === "signed"
                    ? "Prescription signed and queued in clinic pharmacy"
                    : "Pending clinician authorization & digital pharmacy transmission"}
              </div>
              <div className="text-[11px] text-[#586C64]">
                {!activePatient.savedSoapNote
                  ? "Prerequisite: Complete and save signed SOAP note in Consultation before signing prescription."
                  : hasSevereUnoverriddenHdi
                    ? "Review the recorded interaction before signing a matching medicine."
                    : !activePatient.consentActive
                      ? "Prerequisite: Active patient care consent is required before pharmacy transmission."
                      : isCardiacAcuity && !allCardiacVerified
                        ? "See pending diagnostic verification above."
                        : "Open the pharmacy drawer to verify the catalog items and sign."}
              </div>
            </div>
          </div>
        </div>

        {activePatient.prescriptionStatus && (
          <p role="status" className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm font-semibold text-emerald-900">
            {activePatient.prescriptionStatus === "dispensed"
              ? "Prescription dispensed."
              : "Prescription signed and available in the clinic pharmacy queue."}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <button
            type="button"
            onClick={() => setShowVernacularGuide(true)}
            disabled={!finalLines?.length}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#BFE0CE] bg-[#EDF7F2] hover:bg-[#E1F2E8] px-4 py-2.5 text-xs font-bold text-[#0E2420] transition-colors"
            title="मरीज सचित्र खुराक निर्देशिका - Hindi pictographic audio timetable for patient"
          >
            <Languages className="w-4 h-4 text-[#047C61]" aria-hidden="true" />
            <span>सचित्र खुराक (Vernacular Guide)</span>
          </button>

          <button
            type="button"
            disabled={!canSignPrescription}
            onClick={() => setShowSignPrescription(true)}
            className="jvk-opd-primary-btn inline-flex min-h-11 items-center gap-2 px-5 py-2.5 text-xs font-bold disabled:opacity-45 disabled:cursor-not-allowed"
          >
            <CheckCircle2 className="w-4 h-4 text-amber-300" aria-hidden="true" />
            <span>Sign prescription for pharmacy</span>
          </button>
        </div>
      </section>

      {/* Sign Prescription Drawer */}
      {showSignPrescription && clinicalEncounterId && (
        <SignPrescription
          key={clinicalEncounterId}
          encounterId={clinicalEncounterId}
          plan={activePatient.soap.plan}
          review={activePatient.prescriptionReview ?? {}}
          updatePlan={(plan) => updatePatientPlan(activePatientKey, plan)}
          updateReview={(review) => updatePrescriptionReview(clinicalEncounterId, review)}
          saveDraft={saveDraft}
          close={() => setShowSignPrescription(false)}
          onSigned={() => {
            markEncounterPrescriptionSigned(clinicalEncounterId);
            setShowSignPrescription(false);
          }}
        />
      )}

      {/* Add Medication Modal */}
      {showAddMedModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Add Medication to Prescription"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 backdrop-blur-xs p-4"
        >
          <div className="w-full max-w-lg rounded-2xl border border-[#DFD8C7] bg-[#FFFEFB] p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#EAE3D4] pb-3">
              <div className="flex items-center gap-2">
                <Pill className="w-5 h-5 text-[#047C61]" aria-hidden="true" />
                <h3 className="text-base font-bold text-[#0E2420]">
                  Add Medication to Prescription
                </h3>
              </div>
              <button
                type="button"
                aria-label="Close Add Medication dialog"
                onClick={() => setShowAddMedModal(false)}
                className="p-1.5 rounded-lg text-[#586C64] hover:bg-[#F4F2EB]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <label className="block font-bold text-[#354E45]">
                Medication / Salt Formulation *
                <input
                  type="text"
                  value={newMed.drug}
                  onChange={(e) => setNewMed({ ...newMed, drug: e.target.value })}
                  placeholder="e.g. Telmisartan 40mg or Pantoprazole 40mg"
                  className="mt-1 w-full rounded-xl border border-[#DCD5C5] bg-white p-2.5 text-sm text-[#0E2420]"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block font-bold text-[#354E45]">
                  Dosage
                  <input
                    type="text"
                    value={newMed.dosage}
                    onChange={(e) => setNewMed({ ...newMed, dosage: e.target.value })}
                    placeholder="e.g. 40mg"
                    className="mt-1 w-full rounded-xl border border-[#DCD5C5] bg-white p-2.5 text-sm text-[#0E2420]"
                  />
                </label>
                <label className="block font-bold text-[#354E45]">
                  Frequency
                  <select
                    value={newMed.frequency}
                    onChange={(e) => setNewMed({ ...newMed, frequency: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-[#DCD5C5] bg-white p-2.5 text-sm text-[#0E2420]"
                  >
                    <option value="1-0-0">1-0-0 (Morning)</option>
                    <option value="0-1-0">0-1-0 (Afternoon)</option>
                    <option value="0-0-1">0-0-1 (Night)</option>
                    <option value="">Choose frequency</option>
                    <option value="1-0-1">1-0-1 (Twice Daily)</option>
                    <option value="1-1-1">1-1-1 (Thrice Daily)</option>
                    <option value="STAT">STAT (Immediately)</option>
                    <option value="SOS">SOS (As Needed)</option>
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block font-bold text-[#354E45]">
                  Duration
                  <input
                    type="text"
                    value={newMed.duration}
                    onChange={(e) => setNewMed({ ...newMed, duration: e.target.value })}
                    placeholder="e.g. 10 Days"
                    className="mt-1 w-full rounded-xl border border-[#DCD5C5] bg-white p-2.5 text-sm text-[#0E2420]"
                  />
                </label>
                <label className="block font-bold text-[#354E45]">
                  Instructions
                  <input
                    type="text"
                    value={newMed.instructions}
                    onChange={(e) => setNewMed({ ...newMed, instructions: e.target.value })}
                    placeholder="e.g. Before breakfast"
                    className="mt-1 w-full rounded-xl border border-[#DCD5C5] bg-white p-2.5 text-sm text-[#0E2420]"
                  />
                </label>
              </div>


            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#EAE3D4]">
              <button
                type="button"
                onClick={() => setShowAddMedModal(false)}
                className="rounded-xl border border-[#DCD5C5] bg-white px-4 py-2 text-xs font-bold text-[#354E45]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddMedication}
                className="jvk-opd-primary-btn px-4 py-2 text-xs font-bold"
              >
                Add to Prescription
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Vernacular Medication Guide Modal */}
      {showVernacularGuide && finalLines && (
        <PatientVernacularGuide
          isOpen={showVernacularGuide}
          onClose={() => setShowVernacularGuide(false)}
          patientName={activePatient.name}
          patientAge={activePatient.age ?? undefined}
          patientGender={activePatient.gender}
          patientToken={activePatient.token}
          signedDirectionsOnly
          prescriptionItems={finalLines.map((line) => ({
            drug: line.brand, genericName: line.salt, dosage: `${line.strengthMg} mg ${line.form}`,
            frequency: "", duration: line.courseEnd, instructions: line.directions, availableInClinic: false,
          }))}
        />
      )}
    </div>
  );
}

function StatusChipBadge({ status }: { status: "signed" | "dispensed" }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 text-[11px] font-bold text-emerald-900">
      <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
      <span>{status === "dispensed" ? "Dispensed" : "Signed"}</span>
    </span>
  );
}
