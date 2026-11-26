import {
  AlertTriangle,
  ArrowRight,
  BedDouble,
  ChevronRight,
  ClipboardList,
  FileText,
  Leaf,
  Pill,
  Siren,
  Stethoscope,
  UserPlus,
  Users,
} from "lucide-react";
import { OpdGoldCurve } from "./OpdChrome";
import { useOpdWorkspace } from "./opdContext";

export function OpdOverview() {
  const {
    alerts,
    alertsLoading,
    alertFeedErrors,
    metrics,
    setFilter,
    navigateOpd,
    activePatient,
    queueRequest,
  } = useOpdWorkspace();

  const activeAlertCount = alerts.length;
  const highestSeverity = alerts[0]?.severity;
  const hasEmergency = highestSeverity === "EMERGENCY";
  const allAlertsUnavailable = alertFeedErrors.length >= 3 && activeAlertCount === 0;

  return (
    <div id="tour-clinical-overview" className="relative min-h-[calc(100dvh-112px)] flex flex-col justify-between gap-4">
      <div className="space-y-4 xl:space-y-5">
      {/* Hero section matching approved OPD Cockpit reference */}
      <section className="relative overflow-hidden rounded-[22px] py-2 sm:py-3 md:min-h-[144px] lg:min-h-[168px] md:flex md:items-center">
        <div className="relative z-10 w-full md:max-w-[60%] lg:max-w-[63%] xl:max-w-[66%] space-y-2.5">
          <h1 className="jvk-opd-serif text-[28px] sm:text-4xl lg:text-[38px] xl:text-[42px] font-semibold tracking-tight text-[#0E2420] leading-[1.15]">
            Doctor Consultation{" "}
            <span className="relative inline-block jvk-opd-italic pr-1">
              (OPD)
              <OpdGoldCurve />
            </span>
          </h1>
          <p className="max-w-lg text-sm sm:text-[15px] leading-relaxed text-[#3F554D]">
            Consult patients, review vitals and investigations, and create clinical notes with decision support.
          </p>
        </div>

        {/* Watercolor rural clinic illustration extracted cleanly from approved visual reference */}
        <img
          src="/assets/opd/opd-hero-landscape.png"
          alt=""
          aria-hidden="true"
          className="jvk-opd-landscape-mask pointer-events-none select-none hidden md:block absolute top-0 right-0 h-[140px] lg:h-[168px] w-auto max-w-[38%] lg:max-w-[37%] xl:max-w-[36%] object-contain object-right z-0 opacity-95"
        />
      </section>

      {queueRequest === "error" && (
        <div
          role="alert"
          className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-900"
        >
          Unable to refresh clinical queue from the server. Displayed counts reflect only available data.
        </div>
      )}

      {/* Four Live Actionable Overview Statistics */}
      <section aria-label="OPD overview statistics" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5 xl:gap-4">
        {/* In Queue */}
        <button
          type="button"
          onClick={() => {
            setFilter("all");
            navigateOpd("/app/doctor/queue");
          }}
          className="jvk-opd-card p-4 xl:p-5 text-left hover:border-[#047C61] transition-all flex items-center gap-3 xl:gap-4 group cursor-pointer"
        >
          <span className="grid h-10 w-10 xl:h-12 xl:w-12 shrink-0 place-items-center rounded-full bg-[#E5F2EA] text-[#087F72] group-hover:scale-105 transition-transform">
            <Users className="w-5 h-5 xl:w-6 xl:h-6 stroke-[1.75]" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="text-2xl xl:text-[28px] font-bold leading-none text-[#0E2420] tabular-nums">
              {metrics.inQueue === null ? "Unavailable" : metrics.inQueue}
            </div>
            <div className="mt-1.5 text-xs xl:text-sm font-medium text-[#4F635B]">In Queue</div>
          </div>
        </button>

        {/* In Consultation */}
        <button
          type="button"
          onClick={() => {
            setFilter("in_consult");
            navigateOpd("/app/doctor/queue");
          }}
          className="jvk-opd-card p-4 xl:p-5 text-left hover:border-[#047C61] transition-all flex items-center gap-3 xl:gap-4 group cursor-pointer"
        >
          <span className="grid h-10 w-10 xl:h-12 xl:w-12 shrink-0 place-items-center rounded-full bg-[#E5F2EA] text-[#087F72] group-hover:scale-105 transition-transform">
            <Stethoscope className="w-5 h-5 xl:w-6 xl:h-6 stroke-[1.75]" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="text-2xl xl:text-[28px] font-bold leading-none text-[#0E2420] tabular-nums">
              {metrics.inConsultation === null ? "Unavailable" : metrics.inConsultation}
            </div>
            <div className="mt-1.5 text-xs xl:text-sm font-medium text-[#4F635B]">In Consultation</div>
          </div>
        </button>

        {/* High Priority */}
        <button
          type="button"
          onClick={() => navigateOpd("/app/alerts?priority=high")}
          className="jvk-opd-card-priority p-4 xl:p-5 text-left hover:border-[#C5392F] transition-all flex items-center gap-3 xl:gap-4 group cursor-pointer"
        >
          <span className="grid h-10 w-10 xl:h-12 xl:w-12 shrink-0 place-items-center rounded-full bg-[#FAD9D5] text-[#C5392F] group-hover:scale-105 transition-transform">
            <Siren className="w-5 h-5 xl:w-6 xl:h-6 stroke-[1.75]" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="text-2xl xl:text-[28px] font-bold leading-none text-[#0E2420] tabular-nums">
              {metrics.highPriority === null ? "Unavailable" : metrics.highPriority}
            </div>
            <div className="mt-1.5 text-xs xl:text-sm font-medium text-[#6C322E]">High Priority</div>
          </div>
        </button>

        {/* Awaiting Admission (honest unavailable state) */}
        <button
          type="button"
          onClick={() => navigateOpd("/app/ipd")}
          title={metrics.awaitingAdmission.reason}
          className="jvk-opd-card p-4 xl:p-5 text-left hover:border-[#047C61] transition-all flex items-center gap-3 xl:gap-4 group cursor-pointer"
        >
          <span className="grid h-10 w-10 xl:h-12 xl:w-12 shrink-0 place-items-center rounded-full bg-[#E5F2EA] text-[#087F72] group-hover:scale-105 transition-transform">
            <BedDouble className="w-5 h-5 xl:w-6 xl:h-6 stroke-[1.75]" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="text-base xl:text-lg font-bold leading-tight text-[#4A5E56] break-words">
              Unavailable
            </div>
            <div className="mt-1 text-xs xl:text-sm font-medium text-[#4F635B]">Awaiting Admission</div>
            <div className="mt-0.5 text-[11px] text-[#6B7E76]">Open IPD workflow →</div>
          </div>
        </button>
      </section>

      {/* Primary Asymmetric Grid: Patient Intake Queue + Compact Alert Summary */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left: Patient Intake Queue Card */}
        <div
          id="tour-clinical-queue"
          className="jvk-opd-card-queue lg:col-span-7 relative overflow-hidden p-6 sm:p-7 flex flex-col justify-between min-h-[210px]"
        >
          <div className="relative z-10 max-w-md sm:pr-36 xl:pr-44 space-y-3">
            <div className="flex items-start gap-3.5">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[#CFE4D6] bg-[#EDF6F0] text-[#087F72]">
                <ClipboardList className="w-5 h-5 stroke-[1.8]" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-[#0E2420] leading-snug">
                  Patient Intake Queue
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-[#4A6158]">
                  Pick up where you left off or start a new encounter from the patient queue.
                </p>
              </div>
            </div>

            {activePatient && (
              <p className="text-xs font-semibold text-[#175B4B] bg-[#EAF5EE] border border-[#CBE3D4] inline-flex items-center gap-2 rounded-lg px-2.5 py-1">
                <span>Active encounter: {activePatient.name}</span>
                <span className="font-mono">{activePatient.token}</span>
              </p>
            )}
          </div>

          <div className="relative z-10 mt-6 flex flex-wrap items-center gap-3 pr-0 sm:pr-44 xl:pr-48">
            <button
              type="button"
              onClick={() => navigateOpd("/app/doctor/queue")}
              className="jvk-opd-primary-btn inline-flex min-h-11 items-center gap-2.5 px-5 py-3 text-sm font-bold cursor-pointer"
            >
              <UserPlus className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>See Patient Queue</span>
              <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
            </button>
            {activePatient && (
              <button
                type="button"
                onClick={() => navigateOpd("/app/doctor/consultation")}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#CFDAD2] bg-white/95 px-4 py-2.5 text-xs font-bold text-[#0E2420] hover:border-[#047C61] transition-colors"
              >
                <span>Resume Consultation</span>
                <ChevronRight className="w-4 h-4 text-[#047C61]" aria-hidden="true" />
              </button>
            )}
          </div>

          {/* Clipboard + Stethoscope botanical artwork */}
          <img
            src="/assets/opd/opd-queue-clipboard.png"
            alt=""
            aria-hidden="true"
            className="jvk-opd-clipboard-mask pointer-events-none select-none hidden sm:block absolute bottom-0 right-1 h-[142px] xl:h-[168px] w-auto object-contain object-bottom opacity-95 z-0"
          />
        </div>

        {/* Right: Compact Active Alert Summary Card */}
        <button
          type="button"
          onClick={() => navigateOpd("/app/alerts")}
          className={`lg:col-span-5 rounded-[20px] border p-6 sm:p-7 text-left transition-all flex flex-col justify-center cursor-pointer group ${
            allAlertsUnavailable
              ? "border-rose-300 bg-rose-50 hover:border-rose-500"
              : activeAlertCount > 0
                ? "border-[#F2D2CE] bg-gradient-to-br from-[#FDF2F0] to-[#FCEBEA] hover:border-[#C5392F]"
                : "border-[#DCE8DF] bg-[#F6FAF7] hover:border-[#047C61]"
          }`}
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <span
                className={`grid h-12 w-12 shrink-0 place-items-center rounded-full ${
                  allAlertsUnavailable || activeAlertCount > 0
                    ? "bg-[#FAD9D5] text-[#C5392F]"
                    : "bg-[#E2F0E7] text-[#087F72]"
                }`}
              >
                <AlertTriangle className="w-6 h-6 stroke-[1.8]" aria-hidden="true" />
              </span>

              <div className="min-w-0 space-y-1">
                <h2 className="text-lg font-bold text-[#0E2420]">
                  {alertsLoading && activeAlertCount === 0
                    ? "Checking alerts…"
                    : allAlertsUnavailable
                      ? "Alerts unavailable"
                      : `${activeAlertCount} active ${activeAlertCount === 1 ? "alert" : "alerts"}`}
                </h2>
                <p className="text-sm text-[#58423F]">
                  {allAlertsUnavailable
                    ? "Clinical alert sources could not be retrieved. Open Alerts to inspect details."
                    : hasEmergency
                      ? "Emergency alert active · Immediate attention required in Alerts."
                      : activeAlertCount > 0
                        ? `Highest severity: ${highestSeverity}. High-priority cases available in Alerts.`
                        : "All monitored clinical and safety feeds are clear."}
                </p>
              </div>
            </div>

            <ChevronRight
              className="w-5 h-5 shrink-0 text-[#B44138] group-hover:translate-x-0.5 transition-transform"
              aria-hidden="true"
            />
          </div>
        </button>
      </section>

      {/* Bottom Row: Three Functional Clinical Shortcut Cards */}
      <section aria-label="Clinical tools" className="grid grid-cols-1 md:grid-cols-3 gap-4 relative z-10">
        {/* 1. CBC Reports */}
        <button
          type="button"
          onClick={() => navigateOpd("/app/doctor/cbc")}
          className="jvk-motion-card jvk-opd-card p-5 text-left hover:border-[#047C61] flex items-center gap-4 group cursor-pointer"
        >
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#E5F2EA] text-[#087F72] group-hover:scale-105 transition-transform">
            <FileText className="w-6 h-6 stroke-[1.75]" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-[#0E2420] group-hover:text-[#047C61] transition-colors">
              CBC Reports
            </h3>
            <p className="mt-0.5 text-sm text-[#4F635B]">View latest lab analysis</p>
          </div>
        </button>

        {/* 2. Prescriptions */}
        <button
          type="button"
          onClick={() => navigateOpd("/app/doctor/rx")}
          className="jvk-motion-card jvk-opd-card p-5 text-left hover:border-[#047C61] flex items-center gap-4 group cursor-pointer"
        >
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#E5F2EA] text-[#087F72] group-hover:scale-105 transition-transform">
            <Pill className="w-6 h-6 stroke-[1.75]" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-[#0E2420] group-hover:text-[#047C61] transition-colors">
              Prescriptions
            </h3>
            <p className="mt-0.5 text-sm text-[#4F635B]">
              {activePatient
                ? `Rx for ${activePatient.name} (${activePatient.token})`
                : "Create and manage Rx"}
            </p>
          </div>
        </button>

        {/* 3. AYUSH Support */}
        <button
          type="button"
          onClick={() => navigateOpd("/app/ayush")}
          className="jvk-motion-card jvk-opd-card p-5 text-left hover:border-[#047C61] flex items-center gap-4 group cursor-pointer"
        >
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#E5F2EA] text-[#087F72] group-hover:scale-105 transition-transform">
            <Leaf className="w-6 h-6 stroke-[1.75]" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-[#0E2420] group-hover:text-[#047C61] transition-colors">
              AYUSH Support
            </h3>
            <p className="mt-0.5 text-sm text-[#4F635B]">Integrated traditional care</p>
          </div>
        </button>
      </section>
      </div>

      {/* Bottom Green-and-Gold Watercolor Wave + Botanical Foliage */}
      <div className="pointer-events-none select-none -mx-4 sm:-mx-6 lg:-mx-10 -mb-20 pt-2 overflow-hidden">
        <img
          src="/assets/opd/opd-bottom-wave.png"
          alt=""
          aria-hidden="true"
          className="w-full h-14 sm:h-[72px] object-cover object-bottom opacity-95 block"
        />
      </div>
    </div>
  );
}
