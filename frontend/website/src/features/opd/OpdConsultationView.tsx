import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BedDouble,
  FileText,
  HeartPulse,
  Languages,
  Mic,
  Pill,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Thermometer,
  Volume2,
  VolumeX,
  Wind,
} from "lucide-react";
import { AmbientClinicalScribe } from "@/components/AmbientClinicalScribe";
import { staffApi } from "@/lib/staffApi";
import {
  OpdNoPatientPrompt,
  OpdPatientSummary,
  OpdSubpageHeader,
  OpdSubpageWave,
} from "./OpdChrome";
import { useOpdWorkspace } from "./opdContext";
import { evaluatePatientVital } from "./opdMetricsAndAlerts";

export function OpdConsultationView({
  onAdmitToIpd,
  onAssignBay,
}: {
  onAdmitToIpd?: (encounterId: string) => void;
  onAssignBay?: (encounterId: string) => void;
}) {
  const {
    activePatient,
    clinicalEncounterId,
    applyScribeDraftToActive,
    markEncounterSoapSaved,
    soapDraft,
    setSoapDraft,
    soapSignOff,
    setSoapSignOff,
    soapSaved,
    setSoapSaved,
    navigateOpd,
  } = useOpdWorkspace();

  const [showAmbientScribe, setShowAmbientScribe] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [activeCitationId, setActiveCitationId] = useState<number | null>(null);
  const [soapPending, setSoapPending] = useState(false);
  const [clinicalError, setClinicalError] = useState("");

  if (!activePatient) {
    return (
      <div className="jvk-opd-subpage space-y-5">
        <OpdSubpageHeader
          sectionTitle="Clinical Consultation"
          subtitle="Patient overview, vitals telemetry, SOAP notes, diagnostic coding, and care handoffs."
          activeTab="consultation"
        />
        <OpdNoPatientPrompt
          title="No patient encounter selected"
          description="Select a patient from the Patient Intake Queue before reviewing vitals, AI SOAP notes, or diagnostic coding."
        />
      </div>
    );
  }

  const isRealBackendEncounter = Boolean(activePatient.kioskIntake || activePatient.cbcEncounterId);
  const handleToggleIntakeAudio = () => {
    if (isPlayingAudio) {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      setIsPlayingAudio(false);
    } else {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const textToSpeak =
          activePatient.intakeAudioSnippet ||
          (activePatient.symptoms.length > 0 ? activePatient.symptoms.join(", ") : "") ||
          activePatient.soap.subjective ||
          "No audio narrative recorded for this intake.";
        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        utterance.lang = "hi-IN";
        utterance.rate = 0.95;
        utterance.onend = () => setIsPlayingAudio(false);
        utterance.onerror = () => setIsPlayingAudio(false);
        window.speechSynthesis.speak(utterance);
      }
      setIsPlayingAudio(true);
    }
  };

  const noteToSign =
    soapDraft ??
    [
      `Subjective: ${activePatient.soap.subjective}`,
      `Objective: ${activePatient.soap.objective}`,
      `Assessment: ${activePatient.soap.assessment}`,
      `Plan: ${activePatient.soap.plan
        .map(({ drug, dosage, frequency, duration, instructions }) =>
          [drug, dosage, frequency, duration, instructions].filter(Boolean).join(" · "),
        )
        .join("; ")}`,
    ].join("\n");

  const saveSoapNote = async () => {
    if (
      !clinicalEncounterId ||
      !activePatient.consentActive ||
      soapPending ||
      noteToSign.trim().length < 3 ||
      noteToSign.length > 4000
    ) {
      return;
    }
    setSoapPending(true);
    setClinicalError("");
    try {
      await staffApi(`/encounters/${clinicalEncounterId}/review`, {
        method: "POST",
        body: JSON.stringify({ note: noteToSign }),
      });
      setSoapSaved(true);
      markEncounterSoapSaved(clinicalEncounterId, noteToSign);
    } catch (error) {
      setClinicalError(error instanceof Error ? error.message : "SOAP note could not be saved.");
    } finally {
      setSoapPending(false);
    }
  };

  const bpEval = evaluatePatientVital(activePatient, "bp");
  const pulseEval = evaluatePatientVital(activePatient, "pulse");
  const spo2Eval = evaluatePatientVital(activePatient, "spo2");
  const tempEval = evaluatePatientVital(activePatient, "temp");

  return (
    <div id="tour-clinical-record" className="jvk-opd-subpage space-y-4">
      <OpdSubpageHeader
        sectionTitle="Clinical Consultation"
        subtitle="Review encounter details, vitals telemetry, SOAP documentation, ICD-11 coding, and care handoffs."
        activeTab="consultation"
      />

      <OpdPatientSummary patient={activePatient} encounterId={clinicalEncounterId ?? null} showFacility />

      <div className="jvk-opd-consultation-warnings">
        {/* Contextual STAT Emergency Banner */}
        {activePatient.status === "STAT_ALERT" && (
          <div
            role="alert"
            className="rounded-2xl border-2 border-rose-500 bg-rose-50 p-4 flex flex-wrap items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-600 text-white">
                <AlertTriangle className="w-5 h-5" aria-hidden="true" />
              </span>
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-rose-950">
                  Emergency red flag detected
                </h4>
                <p className="mt-0.5 text-xs font-medium text-rose-800">
                  Review the emergency encounter and coordinate a casualty bay assignment.
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={!clinicalEncounterId || !onAssignBay}
              onClick={() => clinicalEncounterId && onAssignBay?.(clinicalEncounterId)}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-rose-700 hover:bg-rose-800 px-3.5 py-2 text-xs font-bold text-white disabled:opacity-50"
            >
              <BedDouble className="w-4 h-4" aria-hidden="true" />
              <span>Open emergency bays</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        )}

        <div className="flex items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-800" aria-hidden="true" />
          <p><strong>Allergies: Not recorded</strong> — verify before prescribing.</p>
        </div>
      </div>

      {activePatient.outreachReviewRequested && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-medium text-orange-900">
          Nurse outreach requested an OPD review for this encounter.
        </div>
      )}

      {/* Section B — Patient Vitals Telemetry */}
      <section aria-label="Patient vitals telemetry" className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#047C61]" aria-hidden="true" />
            <h3 className="jvk-opd-panel-title">
              Patient Vitals Telemetry
            </h3>
          </div>
          <span className="rounded-lg border border-[#CFE3D6] bg-[#EDF6F0] px-2.5 py-1 text-[11px] font-semibold text-[#175B4B]">
            {isRealBackendEncounter ? "Intake Telemetry Stream" : "Demo Measurements"}
          </span>
        </div>

        <div className="jvk-opd-vitals">
          {[
            { label: "Blood Pressure", evalRes: bpEval, Icon: Activity },
            { label: "Pulse Rate", evalRes: pulseEval, Icon: HeartPulse },
            { label: "Oxygen SpO2", evalRes: spo2Eval, Icon: Wind },
            { label: "Body Temperature", evalRes: tempEval, Icon: Thermometer },
          ].map(({ label, evalRes, Icon }) => (
            <div key={label} className={`flex items-center gap-2.5 rounded-xl border p-3 ${evalRes.border}`}>
              <Icon className="h-5 w-5 shrink-0 text-[#087466]" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-1 text-xs font-bold">
                  <span>{label}</span>
                  <span className="rounded bg-white/80 px-1.5 py-0.5 text-[10px] font-bold uppercase">
                    {evalRes.tag}
                  </span>
                </div>
                <div className="mt-0.5 text-base font-bold tracking-tight">
                  {evalRes.displayValue}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="jvk-opd-consultation-panels">
        {/* Section C — Intelligent AI SOAP Notes & Clinical Intake */}
        <section aria-label="SOAP notes and intake" className="jvk-opd-card p-5 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EAE3D4] pb-3">
            <div className="flex items-center gap-2">
              <Stethoscope className="w-4 h-4 text-[#047C61]" aria-hidden="true" />
              <h4 className="jvk-opd-panel-title">
                Intelligent AI SOAP Notes & Clinical Intake
              </h4>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAmbientScribe(true)}
                className="jvk-opd-primary-btn inline-flex min-h-10 items-center gap-1.5 px-3.5 py-2 text-xs font-bold"
                title="Activate ambient clinical stenographer for this consultation"
              >
                <Mic className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Ambient Scribe (Doctor Mic)</span>
              </button>
              <span className="rounded-lg bg-[#F1EFE8] px-2.5 py-1 text-[11px] font-mono font-bold text-[#3F554D]">
                Indic ASR v2
              </span>
              <span className="rounded-lg bg-[#F1EFE8] px-2.5 py-1 text-[11px] font-mono font-bold text-[#3F554D]">
                Dual Coding (ICD-11)
              </span>
            </div>
          </div>

          {/* Sign-off & Save SOAP Note Box */}
          <div className="rounded-xl border border-[#DFD8C7] bg-white p-4 space-y-3">
            {activePatient.savedSoapNote ? (
              <div>
                <h5 className="text-sm font-bold text-[#0E2420]">Signed SOAP note</h5>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm text-[#243B34]">
                  {activePatient.savedSoapNote}
                </p>
              </div>
            ) : clinicalEncounterId && activePatient.consentActive && activePatient.status !== "STAT_ALERT" ? (
              <>
                <label htmlFor="clinical-soap-draft" className="block text-sm font-bold text-[#0E2420]">
                  SOAP note
                </label>
                <textarea
                  id="clinical-soap-draft"
                  className="w-full rounded-xl border border-[#CEDAD3] bg-[#FEFBF6] p-3 text-sm text-[#0E2420]"
                  value={noteToSign}
                  maxLength={4000}
                  rows={6}
                  onChange={(event) => {
                    setSoapDraft(event.target.value);
                    setSoapSignOff(false);
                  }}
                />
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={soapSignOff}
                    onChange={(event) => {
                      setSoapSignOff(event.target.checked);
                      setSoapSaved(false);
                    }}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[#047C61]"
                    aria-label="Clinician sign-off for SOAP note"
                  />
                  <span className="text-xs leading-relaxed text-[#354E45]">
                    <strong>Clinician sign-off:</strong> I reviewed this SOAP note, verified the assessment and confirmed it is ready for the clinical record.
                  </span>
                </label>
                <button
                  type="button"
                  disabled={
                    !soapSignOff ||
                    soapPending ||
                    noteToSign.trim().length < 3 ||
                    noteToSign.length > 4000
                  }
                  onClick={() => void saveSoapNote()}
                  className="jvk-opd-primary-btn min-h-10 w-full sm:w-auto px-4 py-2 text-sm font-bold disabled:opacity-50"
                >
                  {soapPending ? "Saving SOAP…" : "Sign and save SOAP"}
                </button>
              </>
            ) : (
              <p className="text-sm text-[#586C64]">
                SOAP sign-off is unavailable for this encounter (requires active care consent and routine waiting status).
              </p>
            )}
            {clinicalError && (
              <p role="alert" className="text-sm font-semibold text-rose-800">
                {clinicalError}
              </p>
            )}
            {soapSaved && (
              <p role="status" className="text-xs font-bold text-emerald-800">
                SOAP note signed and saved to the encounter.
              </p>
            )}
          </div>

          {/* S & O Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activePatient.documentReview && (
              <details className="md:col-span-2 rounded-xl border border-[#DFD8C7] bg-white p-4">
                <summary className="cursor-pointer text-sm font-bold text-[#0E2420]">
                  Patient-reviewed document text
                </summary>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm text-[#354E45]">
                  {activePatient.documentReview}
                </p>
              </details>
            )}

            {/* S: Subjective */}
            <div className="rounded-2xl border border-[#E3DDD0] bg-[#FAF7F0] p-4 space-y-3">
              <div className="flex items-center justify-between gap-2 border-b border-[#E6DFD0] pb-2">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase text-[#0E2420]">
                  <Languages className="w-4 h-4 text-amber-600" aria-hidden="true" />
                  <span>S: Subjective (Voice Intake)</span>
                </div>
                <button
                  type="button"
                  onClick={handleToggleIntakeAudio}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold border transition ${
                    isPlayingAudio
                      ? "bg-amber-600 text-white border-amber-700"
                      : "bg-white text-[#243B34] border-[#DCD5C5] hover:border-[#047C61]"
                  }`}
                >
                  {isPlayingAudio ? (
                    <VolumeX className="w-3.5 h-3.5" aria-hidden="true" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5 text-amber-600" aria-hidden="true" />
                  )}
                  <span>{isPlayingAudio ? "Pause Audio" : "Play Intake Audio"}</span>
                </button>
              </div>

              {activePatient.intakeAudioSnippet && (
                <div className="rounded-xl border border-[#E6DFD0] bg-white p-3 text-xs italic text-[#354E45]">
                  <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[#6B7E76] not-italic">
                    Verbatim Voice Intake:
                  </div>
                  “{activePatient.intakeAudioSnippet}”
                </div>
              )}

              <p className="text-sm text-[#0E2420] leading-relaxed">
                {activePatient.soap.subjective}
              </p>

              {activePatient.citations && activePatient.citations.length > 0 && (
                <div className="border-t border-[#E6DFD0] pt-2 space-y-2">
                  <div className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-[#586C64]">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" />
                    <span>Voice Provenance Citations (Click to inspect):</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {activePatient.citations.map((c) => {
                      const isHighlighted = activeCitationId === c.id;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setActiveCitationId(isHighlighted ? null : c.id)}
                          className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold transition ${
                            isHighlighted
                              ? "bg-amber-600 text-white border-amber-700"
                              : "bg-white text-[#243B34] border-[#DCD5C5] hover:border-amber-500"
                          }`}
                        >
                          <span className="font-mono">[{c.timestamp}]</span>
                          <span>“{c.transcriptSnippet}”</span>
                        </button>
                      );
                    })}
                  </div>
                  {activeCitationId && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs font-medium text-amber-950">
                      <strong>Clinical Link:</strong>{" "}
                      {activePatient.citations.find((c) => c.id === activeCitationId)?.clinicalFinding}
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-1.5 pt-1">
                {activePatient.symptoms.map((s, idx) => (
                  <span
                    key={idx}
                    className="rounded-md bg-[#E9ECE6] px-2 py-0.5 text-xs font-semibold text-[#243B34]"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>

            {/* O: Objective */}
            <div className="rounded-2xl border border-[#E3DDD0] bg-[#FAF7F0] p-4 space-y-3">
              <div className="flex items-center justify-between gap-2 border-b border-[#E6DFD0] pb-2">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase text-[#0E2420]">
                  <Activity className="w-4 h-4 text-[#047C61]" aria-hidden="true" />
                  <span>O: Objective (Biomarkers & Exam)</span>
                </div>
                <span className="rounded-full bg-[#E1F0E7] px-2.5 py-0.5 text-[11px] font-bold text-[#175B4B]">
                  {isRealBackendEncounter ? "Clinical encounter record" : "Demo measurements"}
                </span>
              </div>

              <p className="text-sm text-[#0E2420] leading-relaxed">
                {activePatient.soap.objective}
              </p>

              <div className="rounded-xl border border-[#E6DFD0] bg-white p-3 text-xs space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#586C64]">
                  Biomarker Diagnostics at Intake:
                </div>
                {isRealBackendEncounter ? (
                  <p className="text-xs text-[#586C64]">
                    No point-of-care biomarkers recorded at intake. Connect CBC Reports if lab PDF extraction is needed.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-[#E6DFD0] bg-[#FAF7F0] p-2">
                      <span className="block text-[11px] text-[#586C64]">POC Troponin-T</span>
                      <span className="font-bold text-[#0E2420]">Not recorded</span>
                    </div>
                    <div className="rounded-lg border border-[#E6DFD0] bg-[#FAF7F0] p-2">
                      <span className="block text-[11px] text-[#586C64]">Blood Glucose (RBS)</span>
                      <span className="font-bold text-[#0E2420]">Not recorded</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <div className="jvk-opd-consultation-side">
          {/* Section D — Assessment & Standard Diagnostic Coding */}
          <section aria-label="Assessment and coding" data-jvk-reveal="0" className="jvk-opd-card p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EAE3D4] pb-3">
              <div className="flex items-center gap-2">
                <Stethoscope className="w-4 h-4 text-[#047C61]" aria-hidden="true" />
                <h4 className="jvk-opd-panel-title">
                  Assessment & Standard Diagnostic Coding
                </h4>
              </div>
              <span className="rounded-full bg-[#E1F0E7] px-2.5 py-0.5 text-[11px] font-bold text-[#175B4B]">
                NRCeS Dual-Coding Standard
              </span>
            </div>

            <p className="text-sm font-bold text-[#0E2420]">
              {activePatient.soap.assessment || "Assessment pending clinician review."}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl border border-[#DCE5DF] bg-white p-3.5 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#175B4B]">
                    WHO ICD-11 Standard Code:
                  </span>
                  <span className="rounded bg-[#EEF5F0] px-1.5 py-0.5 text-[10px] font-bold text-[#175B4B]">
                    MMS R4
                  </span>
                </div>
                <div className="font-mono text-xs font-bold text-[#0E2420]">
                  {activePatient.soap.icd11Code || "Not coded yet"}
                </div>
                {activePatient.soap.icd11Description && (
                  <div className="text-xs text-[#586C64]">{activePatient.soap.icd11Description}</div>
                )}
              </div>

              <div className="rounded-xl border border-[#DCE5DF] bg-white p-3.5 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#087F72]">
                    Evidence-Based Clinical Guideline:
                  </span>
                  <span className="rounded bg-[#E8F4F2] px-1.5 py-0.5 text-[10px] font-bold text-[#087F72]">
                    Western CDS Standard
                  </span>
                </div>
                <div className="font-mono text-xs font-bold text-[#0E2420]">
                  {activePatient.soap.namasteCode || "Pending guideline selection"}
                </div>
                {activePatient.soap.namasteDescription && (
                  <div className="text-xs text-[#586C64]">{activePatient.soap.namasteDescription}</div>
                )}
              </div>
            </div>
          </section>

          {/* Section E — Clinical Record Integrity & Contextual Workflow Handoffs */}
          <section aria-label="Clinical record integrity and handoffs" className="jvk-opd-card-sage p-5 sm:p-6 space-y-4">
            <h4 className="jvk-opd-panel-title flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[#047C61]" aria-hidden="true" />
              Clinical Authorization &amp; Handoff
            </h4>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#D4E4D8] bg-white p-3.5 text-xs">
              <div className="flex items-center gap-2.5">
                {activePatient.savedSoapNote ? (
                  <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0" aria-hidden="true" />
                ) : (
                  <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0" aria-hidden="true" />
                )}
                <div>
                  <div className="font-bold text-[#0E2420]">
                    {activePatient.savedSoapNote
                      ? "Encounter clinical review signed & stored in server record"
                      : "Unsigned encounter note — complete clinician sign-off above"}
                  </div>
                  <div className="text-[11px] text-[#586C64] font-mono">
                    Encounter ID: {clinicalEncounterId ?? activePatient.patientId} · Server session enforced
                  </div>
                </div>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                  activePatient.savedSoapNote
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-100 text-amber-900"
                }`}
              >
                {activePatient.savedSoapNote ? "Signed" : "Draft / Unverified"}
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => navigateOpd("/app/doctor/rx")}
                  className="jvk-opd-primary-btn inline-flex min-h-10 items-center gap-2 px-4 py-2 text-xs font-bold"
                >
                  <Pill className="w-4 h-4" aria-hidden="true" />
                  <span>Open Prescriptions ({activePatient.soap.plan.length})</span>
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => navigateOpd("/app/doctor/cbc")}
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#CEDAD3] bg-white px-4 py-2 text-xs font-bold text-[#0E2420] hover:border-[#047C61]"
                >
                  <FileText className="w-4 h-4 text-[#047C61]" aria-hidden="true" />
                  <span>Open CBC Reports</span>
                </button>
              </div>

              {onAdmitToIpd && clinicalEncounterId && activePatient.consentActive && (
                <button
                  type="button"
                  onClick={() => onAdmitToIpd(clinicalEncounterId)}
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#0E2420] hover:bg-[#193A34] px-4 py-2 text-xs font-bold text-white"
                >
                  <BedDouble className="w-4 h-4 text-emerald-300" aria-hidden="true" />
                  <span>Choose IPD bed</span>
                </button>
              )}
            </div>
          </section>
        </div>
      </div>
      <OpdSubpageWave />

      {showAmbientScribe && (
        <AmbientClinicalScribe
          activePatientName={activePatient.name}
          isOpen={showAmbientScribe}
          onClose={() => setShowAmbientScribe(false)}
          onApplyDraft={applyScribeDraftToActive}
        />
      )}
    </div>
  );
}
