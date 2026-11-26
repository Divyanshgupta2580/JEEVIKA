import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FileText,
  Pill,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";
import { StatusChip } from "@/components/ui/design-primitives";
import "@/design-system/opd-subpages.css";
import { useOpdWorkspace } from "./opdContext";
import { opdQueueIdentity, type OpdQueueItem } from "./opdMetricsAndAlerts";

export function OpdGoldCurve() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 180 14"
      fill="none"
      className="pointer-events-none block h-2.5 w-full mt-0.5"
      preserveAspectRatio="none"
    >
      <path
        d="M3 10.5C52 3.2 126 2.2 177 8.8"
        stroke="#E5A736"
        strokeWidth="3.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

const subpageArtwork = {
  queue: "/assets/opd/opd-queue-clipboard.png",
  consultation: "/assets/ipd/ipd-corner-leaves.png",
  rx: "/assets/patient/medicines-bottle.png",
  cbc: "/assets/patient/drift-clipboard.png",
};

export function OpdPatientInitials({ name, className }: { name: string; className?: string }) {
  const initials = name.trim().split(/\s+/u).slice(0, 2).map((word) => Array.from(word)[0]).join("");
  return <span aria-hidden="true" className={className}>{initials || "PT"}</span>;
}

export function OpdPatientSummary({
  patient,
  encounterId,
  showFacility = false,
}: {
  patient: OpdQueueItem;
  encounterId: string | null;
  showFacility?: boolean;
}) {
  return (
    <section aria-label="Patient overview" className="jvk-opd-card jvk-opd-patient-summary">
      <OpdPatientInitials name={patient.name} className="jvk-opd-patient-avatar" />
      <div className="min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <h3 className="text-lg font-bold text-[#0E2420]">{patient.name}</h3>
          <span className="jvk-opd-patient-ref">Ref {patient.token}</span>
          {patient.pmjayEligible && (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              ₹5L PM-JAY Cashless Eligible
            </span>
          )}
        </div>
        <dl className="jvk-opd-patient-facts">
          <div><dt>Age</dt><dd>{patient.age === null ? "Not recorded" : patient.age}</dd></div>
          <div><dt>Gender</dt><dd>{patient.gender}</dd></div>
          <div><dt>ABHA ID</dt><dd>{patient.abhaId || "Not recorded"}</dd></div>
          {patient.abhaId && (
            <div>
              <dt className="sr-only">ABHA status</dt>
              <dd className="inline-flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
                NRCeS Linked
              </dd>
            </div>
          )}
          <div><dt>Encounter</dt><dd>{encounterId || "Not recorded"}</dd></div>
          <div><dt>Intake</dt><dd>{patient.checkInTime}</dd></div>
        </dl>
      </div>
      <div className="jvk-opd-patient-status">
        <span>Status</span>
        <StatusChip tone={patient.status === "STAT_ALERT" ? "emergency" : "neutral"}>
          {patient.status === "STAT_ALERT" ? "Emergency triage"
            : patient.status === "IN_CONSULT" ? "Reviewed"
              : patient.status === "DISPENSED" ? "Dispensed"
                : "Awaiting review"}
        </StatusChip>
      </div>
      {showFacility && <div className="jvk-opd-patient-facility" aria-hidden="true" />}
    </section>
  );
}

export function OpdSubpageWave() {
  return <div className="jvk-opd-subpage-wave" aria-hidden="true" />;
}

export function OpdSubpageHeader({
  sectionTitle,
  subtitle,
  activeTab,
}: {
  sectionTitle: string;
  subtitle: string;
  activeTab: "queue" | "consultation" | "cbc" | "rx";
}) {
  const { activePatient, navigateOpd, queue } = useOpdWorkspace();

  const tabs = [
    { id: "queue" as const, label: `Patient Queue (${queue.length})`, path: "/app/doctor/queue", icon: ClipboardList },
    { id: "consultation" as const, label: "Consultation", path: "/app/doctor/consultation", icon: Stethoscope },
    { id: "rx" as const, label: "Prescriptions", path: "/app/doctor/rx", icon: Pill },
    { id: "cbc" as const, label: "CBC Reports", path: "/app/doctor/cbc", icon: FileText },
  ];

  return (
    <header className="jvk-opd-subpage-header">
      <div className="jvk-opd-subpage-hero" data-page={activeTab}>
        <img
          src={subpageArtwork[activeTab]}
          alt=""
          className="jvk-opd-subpage-art"
          width="280"
          height="150"
          decoding="async"
        />
        <div className="jvk-opd-subpage-title">
          <div className="jvk-opd-subpage-breadcrumb">
            <button
              type="button"
              onClick={() => navigateOpd("/app/doctor")}
              className="jvk-motion-action inline-flex items-center gap-1.5 rounded-lg border border-[#E2DBCB] bg-white px-2.5 py-1 font-semibold text-[#175B4B] hover:border-[#047C61] hover:bg-[#F3F9F5]"
            >
              <ArrowLeft className="jvk-motion-arrow w-3.5 h-3.5" />
              <span>Back to OPD Cockpit</span>
            </button>
            <ChevronRight className="w-3.5 h-3.5 text-[#8A9991]" aria-hidden="true" />
            <span className="font-semibold text-[#0E2420]">{sectionTitle}</span>
          </div>
          <div className="jvk-opd-subpage-heading">
            <h1 data-jvk-entrance="left" className="jvk-opd-serif">
              Doctor Consultation <span className="jvk-opd-italic">(OPD)</span>
            </h1>
            <span className="jvk-opd-subpage-title-divider" aria-hidden="true">·</span>
            <h2 data-jvk-entrance="right" className="jvk-opd-serif">{sectionTitle}</h2>
          </div>
          <p className="jvk-opd-subpage-description">{subtitle}</p>
        </div>

        {activePatient && (
          <div
            className={`jvk-opd-subpage-selected ${
              activePatient.status === "STAT_ALERT"
                ? "border-rose-300 bg-rose-50 text-rose-900"
                : "border-[#D7E3DC] bg-white text-[#0E2420]"
            }`}
          >
            <div className="flex flex-wrap items-center gap-2 font-bold">
              {activePatient.status === "STAT_ALERT" && (
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              )}
              <span>Selected: {activePatient.name}</span>
              <span className="font-mono text-[11px] bg-[#EEF5F0] text-[#175B4B] px-1.5 py-0.5 rounded">
                {activePatient.token}
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-[#586C64]">
              {activePatient.status === "STAT_ALERT"
                ? "Emergency triage"
                : activePatient.status === "IN_CONSULT"
                  ? "Reviewed / In consult"
                  : "Awaiting review"}
            </p>
          </div>
        )}
      </div>

      <nav
        aria-label="OPD workflow sections"
        className="jvk-opd-subpage-tabs"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isCurrent = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              aria-current={isCurrent ? "page" : undefined}
              onClick={() => navigateOpd(tab.path)}
              className="jvk-opd-subpage-tab"
            >
              <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </header>
  );
}

export function OpdNoPatientPrompt({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  const { queue, queueRequest, selectPatient, navigateOpd } = useOpdWorkspace();

  return (
    <section className="jvk-opd-card p-6 sm:p-8 space-y-5">
      <div className="max-w-xl space-y-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E1F0E7] border border-[#C6E0D1] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#175B4B]">
          Encounter selection required
        </span>
        <h3 className="text-lg font-bold text-[#0E2420]">{title}</h3>
        <p className="text-sm text-[#4F635B]">{description}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => navigateOpd("/app/doctor/queue")}
          className="jvk-opd-primary-btn inline-flex min-h-11 items-center gap-2 px-4 py-2.5 text-sm font-bold"
        >
          <ClipboardList className="w-4 h-4" />
          <span>Open Patient Intake Queue</span>
        </button>
      </div>

      {queueRequest === "loaded" && queue.length > 0 && (
        <div className="pt-4 border-t border-[#E6DFD0] space-y-2.5">
          <p className="text-xs font-bold uppercase tracking-wider text-[#586C64]">
            Or choose an encounter directly:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {queue.slice(0, 6).map((item: OpdQueueItem) => {
              const id = opdQueueIdentity(item);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => selectPatient(id, false)}
                  className={`rounded-xl border p-3 text-left transition-all ${
                    item.status === "STAT_ALERT"
                      ? "border-rose-300 bg-rose-50/60 hover:border-rose-500"
                      : "border-[#E3DDD0] bg-white hover:border-[#047C61]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-mono font-bold text-[#0E2420]">{item.token}</span>
                    {item.status === "STAT_ALERT" && (
                      <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800">
                        STAT
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm font-bold text-[#0E2420] truncate">{item.name}</p>
                  <p className="text-xs text-[#586C64] truncate">
                    {item.symptoms[0] || "Encounter ready"}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
