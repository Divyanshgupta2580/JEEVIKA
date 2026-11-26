import { AlertTriangle, ArrowLeft, ChevronRight, ClipboardList, FileText, Pill, Stethoscope } from "lucide-react";
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
    <header className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#586C64]">
            <button
              type="button"
              onClick={() => navigateOpd("/app/doctor")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2DBCB] bg-white px-2.5 py-1 font-semibold text-[#175B4B] hover:border-[#047C61] hover:bg-[#F3F9F5] transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to OPD Cockpit</span>
            </button>
            <ChevronRight className="w-3.5 h-3.5 text-[#8A9991]" aria-hidden="true" />
            <span className="font-semibold text-[#0E2420]">{sectionTitle}</span>
          </div>
          <div className="flex flex-wrap items-baseline gap-2.5 pt-1">
            <h1 className="jvk-opd-serif text-xl sm:text-2xl font-bold text-[#0E2420] tracking-tight">
              Doctor Consultation <span className="jvk-opd-italic">(OPD)</span>
            </h1>
            <span className="text-[#8A9991]" aria-hidden="true">·</span>
            <h2 className="text-lg sm:text-xl font-bold text-[#175B4B]">{sectionTitle}</h2>
          </div>
          <p className="text-sm text-[#4F635B]">{subtitle}</p>
        </div>

        {activePatient && (
          <div
            className={`rounded-xl border px-3.5 py-2 text-xs shadow-xs ${
              activePatient.status === "STAT_ALERT"
                ? "border-rose-300 bg-rose-50 text-rose-900"
                : "border-[#D7E3DC] bg-white text-[#0E2420]"
            }`}
          >
            <div className="flex items-center gap-2 font-bold">
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
        className="flex flex-wrap gap-2 rounded-2xl border border-[#E6DFD0] bg-[#FAF6EC] p-1.5"
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
              className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                isCurrent
                  ? "bg-[#047C61] text-white shadow-xs"
                  : "text-[#354E45] hover:bg-white hover:text-[#0E2420]"
              }`}
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
