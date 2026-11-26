import { useMemo } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Clock,
  FileText,
  RefreshCw,
  Search,
  Stethoscope,
  Users,
  X,
} from "lucide-react";
import { OpdPatientInitials, OpdSubpageHeader } from "./OpdChrome";
import { useOpdWorkspace } from "./opdContext";
import { opdQueueIdentity } from "./opdMetricsAndAlerts";

export function OpdPatientQueue() {
  const {
    queue,
    queueRequest,
    selectedPatientId,
    filter,
    setFilter,
    searchQuery,
    setSearchQuery,
    refreshQueue,
    selectPatient,
    navigateOpd,
  } = useOpdWorkspace();

  const filteredQueue = useMemo(() => {
    return queue.filter((item) => {
      if (filter === "stat" && item.status !== "STAT_ALERT") return false;
      if (filter === "waiting" && item.status !== "WAITING") return false;
      if (filter === "in_consult" && item.status !== "IN_CONSULT") return false;
      if (filter === "dispensed" && item.prescriptionStatus !== "dispensed" && item.status !== "DISPENSED") return false;
      if (filter === "pmjay" && !item.pmjayEligible) return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = item.name.toLowerCase().includes(query);
        const matchesToken = item.token.toLowerCase().includes(query);
        const matchesAbha = item.abhaId.toLowerCase().includes(query);
        const matchesSymptoms = item.symptoms.some((s) => s.toLowerCase().includes(query));
        return matchesName || matchesToken || matchesAbha || matchesSymptoms;
      }

      return true;
    });
  }, [queue, filter, searchQuery]);

  const statCount = queue.filter((q) => q.status === "STAT_ALERT").length;
  const waitingCount = queue.filter((q) => q.status === "WAITING").length;
  const inConsultCount = queue.filter((q) => q.status === "IN_CONSULT").length;
  const dispensedCount = queue.filter(
    (q) => q.prescriptionStatus === "dispensed" || q.status === "DISPENSED",
  ).length;

  return (
    <div id="tour-clinical-overview" className="jvk-opd-subpage space-y-4">
      <OpdSubpageHeader
        sectionTitle="Patient Intake Queue"
        subtitle="Filter encounters by urgency or status and select a patient to open clinical consultation."
        activeTab="queue"
      />

      <section id="tour-clinical-queue" className="jvk-opd-card p-3.5 sm:p-5 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#E5F2EA] text-[#047C61]">
              <Users className="w-4 h-4" aria-hidden="true" />
            </span>
            <div>
              <h3 className="jvk-opd-panel-title">Clinic Queue</h3>
              <p className="text-xs text-[#586C64]">
                Ordered by clinical urgency (emergency encounters prioritized)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <span
              role="status"
              className="inline-flex items-center gap-1.5 rounded-full border border-[#C6E0D1] bg-[#EEF6EF] px-2.5 py-1 text-xs font-semibold text-[#175B4B]"
            >
              <span className="h-2 w-2 rounded-full bg-current" aria-hidden="true" />
              {queueRequest === "loading" ? "Refreshing queue" : queueRequest === "loaded" ? "Queue loaded" : "Queue refresh failed"}
            </span>
            <button
              type="button"
              onClick={refreshQueue}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#D4DFD8] bg-white px-3.5 py-2 text-xs font-bold text-[#0E2420] hover:border-[#047C61] transition-colors"
            >
              <RefreshCw
                aria-hidden="true"
                className={`h-3.5 w-3.5 ${queueRequest === "loading" ? "animate-spin text-[#047C61]" : ""}`}
              />
              <span>Refresh queue</span>
            </button>
          </div>
        </div>

        {/* Instant Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-[#6B7E76] absolute left-3.5 top-3" aria-hidden="true" />
          <input
            type="text"
            aria-label="Search patient queue"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search patient, token, ABHA, symptom..."
            className="w-full min-h-10 pl-10 pr-9 py-2 text-sm bg-white border border-[#DCD5C5] rounded-xl text-[#0E2420] placeholder:text-[#788880] focus:outline-none focus:ring-2 focus:ring-[#047C61]"
          />
          {searchQuery && (
            <button
              type="button"
              aria-label="Clear queue search"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-2.5 p-1 text-[#6B7E76] hover:text-[#0E2420]"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap gap-2 text-xs font-bold" role="group" aria-label="Queue status filters">
          <button
            type="button"
            onClick={() => setFilter("all")}
            aria-pressed={filter === "all"}
            className={`px-3 py-1.5 rounded-xl border transition ${
              filter === "all"
                ? "bg-[#0E2420] text-white border-[#0E2420]"
                : "bg-white text-[#3F554D] border-[#DDD7C8] hover:border-[#047C61]"
            }`}
          >
            All ({queue.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("stat")}
            aria-pressed={filter === "stat"}
            className={`px-3 py-1.5 rounded-xl border transition inline-flex items-center gap-1.5 ${
              filter === "stat"
                ? "bg-rose-600 text-white border-rose-600"
                : "bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100"
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
            <span>STAT ({statCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilter("waiting")}
            aria-pressed={filter === "waiting"}
            className={`px-3 py-1.5 rounded-xl border transition ${
              filter === "waiting"
                ? "bg-amber-600 text-white border-amber-600"
                : "bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100"
            }`}
          >
            Waiting ({waitingCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter("in_consult")}
            aria-pressed={filter === "in_consult"}
            className={`px-3 py-1.5 rounded-xl border transition ${
              filter === "in_consult"
                ? "bg-[#047C61] text-white border-[#047C61]"
                : "bg-[#EAF5EE] text-[#175B4B] border-[#C9E2D4] hover:bg-[#DCF0E3]"
            }`}
          >
            In Consult ({inConsultCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter("dispensed")}
            aria-pressed={filter === "dispensed"}
            className={`px-3 py-1.5 rounded-xl border transition ${
              filter === "dispensed"
                ? "bg-emerald-700 text-white border-emerald-700"
                : "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
            }`}
          >
            Dispensed ({dispensedCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter("pmjay")}
            aria-pressed={filter === "pmjay"}
            className={`px-3 py-1.5 rounded-xl border transition ${
              filter === "pmjay"
                ? "bg-indigo-700 text-white border-indigo-700"
                : "bg-indigo-50 text-indigo-800 border-indigo-200 hover:bg-indigo-100"
            }`}
          >
            PM-JAY
          </button>
        </div>

        {/* Feedback states */}
        {queueRequest === "loading" && queue.length === 0 && (
          <p role="status" className="text-sm text-[#4F635B] py-4">
            Loading your clinic’s queue…
          </p>
        )}
        {queueRequest === "error" && (
          <p role="alert" className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-900">
            The clinic queue could not be refreshed.
          </p>
        )}
        {queueRequest === "loaded" && queue.length === 0 && (
          <div className="rounded-2xl border border-[#DCE6DD] bg-white p-8 text-center space-y-2">
            <p className="text-base font-bold text-[#0E2420]">No patient encounters for your clinic.</p>
            <p className="text-sm text-[#586C64]">
              New kiosk intakes and referred encounters will appear here once submitted.
            </p>
          </div>
        )}

        {/* Queue Cards */}
        {queue.length > 0 && (
          <div className="space-y-2.5">
            {filteredQueue.length === 0 ? (
              <div className="rounded-xl border border-[#E6DFD0] bg-white py-10 text-center text-sm text-[#586C64]">
                No matching patients found.
              </div>
            ) : (
              filteredQueue.map((item, idx) => {
                const identity = opdQueueIdentity(item);
                const isSelected = identity === selectedPatientId;
                const isStat = item.status === "STAT_ALERT";
                const itemKey = `${item.encounterId || item.cbcEncounterId || item.patientId}-${item.token || idx}`;

                return (
                  <div
                    key={itemKey}
                    className="jvk-opd-queue-row"
                    data-selected={isSelected}
                    data-urgent={isStat}
                  >
                    <button
                      type="button"
                      onClick={() => selectPatient(identity, true)}
                      className="flex flex-1 items-center gap-3 text-left min-w-0 cursor-pointer"
                    >
                      <OpdPatientInitials name={item.name} className="jvk-opd-queue-avatar" />
                      <div className="min-w-0 break-words">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-bold text-[#0E2420]">
                            {item.token}
                          </span>
                          {isStat && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-800">
                              <AlertTriangle className="w-3 h-3" aria-hidden="true" />
                              <span>STAT Alert</span>
                            </span>
                          )}
                          {item.status === "WAITING" && (
                            <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900">
                              Waiting
                            </span>
                          )}
                          {item.status === "IN_CONSULT" && (
                            <span className="inline-flex items-center rounded-full border border-[#C6E0D1] bg-[#E1F0E7] px-2 py-0.5 text-[11px] font-bold text-[#175B4B]">
                              In Consult
                            </span>
                          )}
                          {(item.prescriptionStatus === "dispensed" || item.status === "DISPENSED") && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                              <Check className="w-3 h-3" aria-hidden="true" />
                              <span>Dispensed</span>
                            </span>
                          )}
                          {item.outreachReviewRequested && (
                            <span className="inline-flex items-center rounded-full border border-orange-200 bg-orange-100 px-2 py-0.5 text-[11px] font-bold text-orange-900">
                              Outreach OPD Review
                            </span>
                          )}
                          {item.pmjayEligible && (
                            <span className="inline-flex items-center rounded border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-800">
                              ₹5L PM-JAY
                            </span>
                          )}
                        </div>

                        <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <h3 className="text-base font-bold text-[#0E2420]">{item.name}</h3>
                          <span className="text-xs text-[#586C64]">
                            {item.age === null ? "Age not recorded" : `${item.age}Y`} • {item.gender}
                          </span>
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1">
                          {item.symptoms.length > 0 && <FileText className="h-3.5 w-3.5 text-[#175B4B]" aria-hidden="true" />}
                          {item.symptoms.slice(0, 3).map((s, sIdx) => (
                            <span
                              key={sIdx}
                              className="text-xs font-medium text-[#354E45]"
                            >
                              {s}
                            </span>
                          ))}
                          {item.symptoms.length > 3 && (
                            <span className="rounded-md bg-[#F4F2EB] px-2 py-0.5 text-xs text-[#586C64]">
                              +{item.symptoms.length - 3}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>

                    <div className="flex flex-wrap sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0">
                      <span className="inline-flex items-center gap-1 text-xs text-[#586C64]">
                        <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{item.checkInTime}</span>
                      </span>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => selectPatient(identity, true)}
                          className="jvk-opd-primary-btn inline-flex min-h-10 items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold"
                        >
                          <Stethoscope className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>{isSelected ? "Open Consultation" : "Consult"}</span>
                          <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (selectPatient(identity, false)) navigateOpd("/app/doctor/rx");
                          }}
                          className="inline-flex min-h-10 items-center rounded-xl border border-[#D4DFD8] bg-white px-3 py-1.5 text-xs font-bold text-[#0E2420] hover:border-[#047C61]"
                        >
                          Rx
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </section>
    </div>
  );
}
