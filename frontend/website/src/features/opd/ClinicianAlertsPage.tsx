import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  BellRing,
  CheckCircle2,
  Clock,
  Info,
  RefreshCw,
  ShieldAlert,
  Siren,
} from "lucide-react";
import { distressChanged } from "@/components/ShellEmergency";
import { staffApi } from "@/lib/staffApi";
import { OpdGoldCurve } from "./OpdChrome";
import { useOpdWorkspace } from "./opdContext";
import type { AlertSeverity, ClinicianAlert } from "./opdMetricsAndAlerts";

type AlertFilter = "ALL" | AlertSeverity;

export function ClinicianAlertsPage() {
  const location = useLocation();
  const {
    alerts,
    alertsLoading,
    alertFeedErrors,
    refreshAlerts,
    navigateFromAlert,
    navigateOpd,
  } = useOpdWorkspace();

  const [severityFilter, setSeverityFilter] = useState<AlertFilter>("ALL");
  const [highPriorityMode, setHighPriorityMode] = useState(false);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [actionMessage, setActionMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const sev = params.get("severity")?.toUpperCase();
    const prio = params.get("priority")?.toLowerCase();
    if (prio === "high") {
      setHighPriorityMode(true);
      setSeverityFilter("ALL");
    } else if (sev === "EMERGENCY" || sev === "HIGH" || sev === "MEDIUM" || sev === "INFO") {
      setHighPriorityMode(false);
      setSeverityFilter(sev);
    } else {
      setHighPriorityMode(false);
    }
  }, [location.search]);

  const counts = useMemo(
    () => ({
      ALL: alerts.length,
      EMERGENCY: alerts.filter((a) => a.severity === "EMERGENCY").length,
      HIGH: alerts.filter((a) => a.severity === "HIGH").length,
      MEDIUM: alerts.filter((a) => a.severity === "MEDIUM").length,
      INFO: alerts.filter((a) => a.severity === "INFO").length,
    }),
    [alerts],
  );

  const visibleAlerts = useMemo(() => {
    if (highPriorityMode && severityFilter === "ALL") {
      return alerts.filter((a) => a.severity === "EMERGENCY" || a.severity === "HIGH");
    }
    if (severityFilter === "ALL") return alerts;
    return alerts.filter((a) => a.severity === severityFilter);
  }, [alerts, severityFilter, highPriorityMode]);

  async function handleAcknowledgeDistress(alertItem: ClinicianAlert) {
    const ev = alertItem.distressEvent;
    if (!ev || actionBusyId) return;
    setActionBusyId(alertItem.id);
    setActionError("");
    setActionMessage("");
    try {
      await staffApi(`/clinical/ipd/distress/${ev.id}/acknowledge`, { method: "POST" });
      window.dispatchEvent(new Event(distressChanged));
      refreshAlerts();
      setActionMessage(`Code Blue acknowledged (${ev.room} · ${ev.bed}).`);
    } catch {
      setActionError("Acknowledgement could not be confirmed. Try again.");
    } finally {
      setActionBusyId(null);
    }
  }

  async function handleResolveDistress(alertItem: ClinicianAlert) {
    const ev = alertItem.distressEvent;
    if (!ev || !ev.attending || actionBusyId) return;
    setActionBusyId(alertItem.id);
    setActionError("");
    setActionMessage("");
    try {
      await staffApi(`/clinical/ipd/distress/${ev.id}/resolve`, { method: "POST" });
      window.dispatchEvent(new Event(distressChanged));
      refreshAlerts();
      setActionMessage(`Code Blue resolved (${ev.room} · ${ev.bed}).`);
    } catch {
      setActionError("Code Blue resolution could not be confirmed. Try again.");
    } finally {
      setActionBusyId(null);
    }
  }

  const allSourcesFailed = alertFeedErrors.length >= 3 && alerts.length === 0;

  return (
    <div className="space-y-6">
      {/* Header matching approved OPD palette */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <span className="inline-flex items-center rounded-full border border-[#C6E0D1] bg-[#E1F0E7] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#175B4B]">
            PORTAL 2 · CENTRALIZED ALERTS
          </span>
          <h1 className="jvk-opd-serif text-2xl sm:text-3xl font-semibold tracking-tight text-[#0E2420]">
            Clinical & Operational{" "}
            <span className="relative inline-block jvk-opd-italic">
              Alerts
              <OpdGoldCurve />
            </span>
          </h1>
          <p className="text-sm text-[#4F635B] max-w-2xl">
            Aggregated clinical, triage, Code Blue, pharmacovigilance, and intake safety warnings across your authorized clinic workflows.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => navigateOpd("/app/doctor")}
            className="inline-flex min-h-10 items-center rounded-xl border border-[#DFD8C7] bg-white px-3.5 py-2 text-xs font-bold text-[#0E2420] hover:border-[#047C61]"
          >
            Back to OPD Cockpit
          </button>
          <button
            type="button"
            onClick={refreshAlerts}
            className="jvk-opd-primary-btn inline-flex min-h-10 items-center gap-2 px-4 py-2 text-xs font-bold"
          >
            <RefreshCw
              aria-hidden="true"
              className={`w-3.5 h-3.5 ${alertsLoading ? "animate-spin" : ""}`}
            />
            <span>Refresh alerts</span>
          </button>
        </div>
      </header>

      {/* Partial or complete alert feed error banners (never pretend 0 alerts on failure) */}
      {alertFeedErrors.length > 0 && (
        <div
          role="alert"
          className="rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3.5 text-sm text-rose-900 space-y-1"
        >
          <p className="font-bold flex items-center gap-2">
            <AlertOctagon className="w-4 h-4 text-rose-700 shrink-0" aria-hidden="true" />
            <span>One or more alert sources failed to load cleanly:</span>
          </p>
          <ul className="list-disc pl-6 text-xs space-y-0.5">
            {alertFeedErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {actionError && (
        <p role="alert" className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900">
          {actionError}
        </p>
      )}
      {actionMessage && (
        <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">
          {actionMessage}
        </p>
      )}

      {/* Filter Pills */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Alert severity filters">
          {(
            [
              { key: "ALL", label: "All", activeCls: "bg-[#0E2420] text-white border-[#0E2420]" },
              { key: "EMERGENCY", label: "Emergency", activeCls: "bg-rose-700 text-white border-rose-700" },
              { key: "HIGH", label: "High", activeCls: "bg-orange-600 text-white border-orange-600" },
              { key: "MEDIUM", label: "Medium", activeCls: "bg-amber-600 text-white border-amber-600" },
              { key: "INFO", label: "Info", activeCls: "bg-[#047C61] text-white border-[#047C61]" },
            ] as const
          ).map(({ key, label, activeCls }) => {
            const isSelected = !highPriorityMode && severityFilter === key;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={isSelected}
                onClick={() => {
                  setHighPriorityMode(false);
                  setSeverityFilter(key);
                }}
                className={`inline-flex min-h-10 items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold transition ${
                  isSelected
                    ? activeCls
                    : "border-[#DDD7C8] bg-white text-[#354E45] hover:border-[#047C61]"
                }`}
              >
                <span>{label}</span>
                <span className="rounded-full bg-black/10 px-1.5 py-0.5 text-[11px] tabular-nums">
                  {counts[key]}
                </span>
              </button>
            );
          })}
        </div>

        {highPriorityMode && (
          <div className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-900">
            <span>Filtered to High Priority (Emergency + High)</span>
            <button
              type="button"
              onClick={() => setHighPriorityMode(false)}
              className="underline text-rose-700"
            >
              Show All
            </button>
          </div>
        )}
      </div>

      {/* Mutually Exclusive Loading / Error / Empty / Alerts List */}
      {alertsLoading && alerts.length === 0 ? (
        <div role="status" className="jvk-opd-card p-8 text-center text-sm font-medium text-[#4F635B]">
          Loading clinical alerts…
        </div>
      ) : allSourcesFailed ? (
        <div role="alert" className="rounded-2xl border border-rose-300 bg-rose-50 p-8 text-center space-y-2">
          <h2 className="text-base font-bold text-rose-950">Alert sources unavailable</h2>
          <p className="text-sm text-rose-800">
            Could not verify clinic alert feeds. Refresh once network or backend access is restored.
          </p>
        </div>
      ) : visibleAlerts.length === 0 ? (
        <div className="jvk-opd-card p-10 text-center space-y-2">
          <CheckCircle2 className="w-8 h-8 mx-auto text-[#047C61]" aria-hidden="true" />
          <h2 className="text-base font-bold text-[#0E2420]">
            {severityFilter === "ALL" && !highPriorityMode
              ? "No active clinical alerts"
              : "No alerts match this severity filter"}
          </h2>
          <p className="text-sm text-[#586C64]">
            {severityFilter === "ALL" && !highPriorityMode
              ? "No active STAT triage flags, Code Blue alerts, critical vitals, or prescribing warnings were detected."
              : "Select another severity filter above to review remaining alerts."}
          </p>
        </div>
      ) : (
        <div className="space-y-3" aria-label="Clinician alerts feed">
          {visibleAlerts.map((alert) => {
            const style = severityStyles(alert.severity);
            const SeverityIcon = style.Icon;
            return (
              <article
                key={alert.id}
                className={`rounded-2xl border p-4 sm:p-5 transition ${style.card}`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold ${style.badge}`}
                      >
                        <SeverityIcon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>{style.label}</span>
                      </span>
                      <span className="rounded-md bg-white/90 border border-black/10 px-2 py-0.5 text-[11px] font-mono text-[#354E45]">
                        Source severity: {alert.rawSeverity}
                      </span>
                      <span className="text-xs font-semibold text-[#4F635B]">
                        {alert.sourceModule}
                      </span>
                    </div>

                    <h2 className="text-base font-bold text-[#0E2420]">{alert.title}</h2>
                    <p className="text-sm text-[#354E45] leading-relaxed">{alert.description}</p>

                    <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-[#586C64]">
                      {alert.patientName && (
                        <span>
                          Patient: <strong className="text-[#0E2420]">{alert.patientName}</strong>
                        </span>
                      )}
                      {alert.encounterId && (
                        <span className="font-mono text-[11px]">
                          Encounter: {alert.encounterId.slice(0, 8)}
                        </span>
                      )}
                      {alert.timestamp && (
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>{formatAlertTime(alert.timestamp)}</span>
                        </span>
                      )}
                      <span className="font-semibold text-[#0E2420]">
                        Status: {alert.statusLabel}
                      </span>
                    </div>
                  </div>

                  {/* Genuine Alert Actions & Navigation */}
                  <div className="flex flex-wrap sm:flex-col items-stretch sm:items-end gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => navigateFromAlert(alert)}
                      className="jvk-opd-primary-btn inline-flex min-h-10 items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold"
                    >
                      <span>{alert.primaryActionLabel}</span>
                      <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>

                    {alert.secondaryDestination && alert.secondaryActionLabel && (
                      <button
                        type="button"
                        onClick={() => navigateFromAlert(alert, alert.secondaryDestination)}
                        className="inline-flex min-h-9 items-center justify-center rounded-xl border border-[#CFC7B5] bg-white px-3.5 py-1.5 text-xs font-bold text-[#0E2420] hover:border-[#047C61]"
                      >
                        {alert.secondaryActionLabel}
                      </button>
                    )}

                    {/* Real server-supported Code Blue actions when clinician is attending */}
                    {alert.distressEvent?.attending === 1 && !alert.distressEvent.acknowledgedAt && (
                      <button
                        type="button"
                        disabled={actionBusyId === alert.id}
                        onClick={() => void handleAcknowledgeDistress(alert)}
                        className="inline-flex min-h-9 items-center justify-center rounded-xl bg-rose-700 hover:bg-rose-800 px-3.5 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                      >
                        Acknowledge &amp; En Route
                      </button>
                    )}
                    {alert.distressEvent?.attending === 1 && (
                      <button
                        type="button"
                        disabled={actionBusyId === alert.id}
                        onClick={() => void handleResolveDistress(alert)}
                        className="inline-flex min-h-9 items-center justify-center rounded-xl border border-rose-300 bg-white px-3.5 py-1.5 text-xs font-bold text-rose-800 hover:bg-rose-50 disabled:opacity-50"
                      >
                        Resolve Code Blue
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function severityStyles(severity: AlertSeverity) {
  switch (severity) {
    case "EMERGENCY":
      return {
        label: "Emergency",
        Icon: Siren,
        card: "border-rose-300 bg-rose-50/75 shadow-xs",
        badge: "border-rose-300 bg-rose-100 text-rose-900",
      };
    case "HIGH":
      return {
        label: "High",
        Icon: AlertTriangle,
        card: "border-orange-300 bg-orange-50/75 shadow-xs",
        badge: "border-orange-300 bg-orange-100 text-orange-900",
      };
    case "MEDIUM":
      return {
        label: "Medium",
        Icon: ShieldAlert,
        card: "border-amber-300 bg-amber-50/70 shadow-xs",
        badge: "border-amber-300 bg-amber-100 text-amber-950",
      };
    default:
      return {
        label: "Info",
        Icon: Info,
        card: "border-sky-200 bg-sky-50/60 shadow-xs",
        badge: "border-sky-200 bg-sky-100 text-sky-900",
      };
  }
}

function formatAlertTime(value: string) {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return value;
  return new Date(parsed).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export { BellRing };
