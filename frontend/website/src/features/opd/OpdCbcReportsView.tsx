import { lazy, Suspense } from "react";
import { CbcBoundary } from "@/features/cbc/CbcBoundary";
import CbcResearchDemo from "@/features/cbc/CbcResearchDemo";
import { DoctorCbcAccess } from "@/features/cbc/DoctorCbcAccess";
import { OpdPatientSummary, OpdSubpageHeader, OpdSubpageWave } from "./OpdChrome";
import { useOpdWorkspace } from "./opdContext";
import { opdQueueIdentity } from "./opdMetricsAndAlerts";

const CbcConsultationPanel = lazy(() => import("@/features/cbc/CbcConsultationPanel"));

export function OpdCbcReportsView() {
  const {
    queue,
    activePatient,
    selectedPatientId,
    selectPatient,
    cbcSession,
    setCbcDirty,
    connectCbc,
  } = useOpdWorkspace();

  return (
    <div id="tour-clinical-overview" className="jvk-opd-subpage space-y-4">
      <OpdSubpageHeader
        sectionTitle="CBC Reports"
        subtitle="Explore synthetic CBC screening inputs or connect a verified clinical session to review patient CBC reports."
        activeTab="cbc"
      />

      {activePatient && (
        <OpdPatientSummary
          patient={activePatient}
          encounterId={activePatient.encounterId ?? activePatient.cbcEncounterId ?? null}
        />
      )}

      <div className="jvk-opd-cbc-access">
        {/* Section 1: Experimental Synthetic Research Demo */}
        <CbcBoundary>
          <CbcResearchDemo />
        </CbcBoundary>

        {/* Section 2: Strict CBC Clinical Authentication Boundary */}
        <DoctorCbcAccess onConnect={connectCbc} />
      </div>

      {/* Section 3: Explicit Authorized Encounter Selector (never silently binds to arbitrary patient) */}
      {queue.length > 0 && (
        <section aria-label="CBC encounter selector" className="jvk-opd-card p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="jvk-opd-panel-title">
                Select Consultation Encounter for CBC Review
              </h3>
              <p className="text-xs text-[#586C64]">
                CBC uploads and revisions bind strictly to the explicitly chosen clinical encounter.
              </p>
            </div>
            {activePatient && (
              <span className="rounded-full border border-[#C6E0D1] bg-[#E1F0E7] px-3 py-1 text-xs font-bold text-[#175B4B]">
                Selected: {activePatient.name}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-60 overflow-y-auto pr-1">
            {queue.map((item) => {
              const id = opdQueueIdentity(item);
              const isSelected = id === selectedPatientId;
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => selectPatient(id, false)}
                  className={`rounded-xl border-2 p-3 text-left transition ${
                    isSelected
                      ? "border-[#047C61] bg-[#EDF7F2]"
                      : "border-[#E3DDD0] bg-white hover:border-[#9EC6B7]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-mono font-bold text-[#0E2420]">{item.token}</span>
                    {item.cbcEncounterId ? (
                      <span className="rounded-full bg-[#E1F0E7] px-2 py-0.5 text-[10px] font-bold text-[#175B4B]">
                        CBC Linked
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                        Not CBC-verified
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm font-bold text-[#0E2420] truncate">{item.name}</p>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Section 4: Authenticated CBC Consultation Panel (strictly keyed by verified context) */}
      <CbcBoundary
        key={`${cbcSession?.token ?? "none"}:${activePatient?.patientId ?? "none"}:${
          activePatient?.cbcEncounterId ?? "unverified"
        }`}
      >
        <Suspense fallback={<div className="p-4 text-sm text-[#4F635B]">Loading CBC reports…</div>}>
          <CbcConsultationPanel
            session={cbcSession}
            patientId={activePatient?.patientId ?? ""}
            patientName={activePatient?.name ?? ""}
            encounterId={
              activePatient && opdQueueIdentity(activePatient) === selectedPatientId
                ? (activePatient.cbcEncounterId ?? null)
                : null
            }
            onDirty={setCbcDirty}
          />
        </Suspense>
      </CbcBoundary>
      <OpdSubpageWave />
    </div>
  );
}
