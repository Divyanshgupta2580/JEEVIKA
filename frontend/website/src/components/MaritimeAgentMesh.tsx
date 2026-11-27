import { useRef, useState } from "react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/basic";
import {
  EmptyState,
  InlineBanner,
  StatusChip,
} from "@/components/ui/design-primitives";
import { staffApi, useStaffData } from "@/lib/staffApi";

type Status = {
  status: "UNAVAILABLE";
  agents: Array<{
    id: string;
    name: string;
    description: string;
    status: "UNAVAILABLE";
    simulation: { runs: number; findings: number; last_run: string } | null;
  }>;
};
type Activity = {
  logs: Array<{
    id: string;
    agent_id: string;
    occurred_at: string;
    latency_ms: number;
    findings: number;
  }>;
};

const findingLabels: Record<string, string> = {
  "agent-sentinel-01": "interaction matches",
  "agent-vernacular-02": "transcript red flags",
  "agent-supply-03": "ineligible batches",
};

export function MaritimeAgentMesh({ canManage }: { canManage: boolean }) {
  const [revision, setRevision] = useState(0);
  const { data: status, error: statusError } = useStaffData<Status>(
    "/maritime/status",
    revision,
  );
  const { data: activity, error: activityError } = useStaffData<Activity>(
    "/maritime/telemetry",
    revision,
  );
  const [pending, setPending] = useState(false);
  const request = useRef(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function simulate(agentId?: string) {
    if (request.current) return;
    request.current = true;
    setPending(true);
    setNotice("");
    setError("");
    try {
      const path = agentId
        ? `/maritime/agents/${agentId}/run`
        : "/maritime/mesh/audit-all";
      await staffApi(path, {
        method: "POST",
        body: JSON.stringify({ mode: "simulation" }),
      });
      setNotice("Simulation recorded.");
      setRevision((value) => value + 1);
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "The simulation failed.",
      );
    } finally {
      request.current = false;
      setPending(false);
    }
  }

  return (
    <section className="jvk-admin-page mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <header className="jvk-admin-card-hero flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-5 overflow-hidden relative">
        <div className="space-y-1.5 z-10 max-w-2xl">
          <div className="flex items-center gap-2.5">
            <span className="h-7 w-1.5 rounded-full bg-[#047C61]" aria-hidden="true" />
            <h1 className="jvk-admin-serif text-2xl sm:text-3xl font-bold tracking-tight text-[#0E2420]">
              Swarm Mesh
            </h1>
          </div>
          <p className="text-sm text-[#556C63] pl-4">
            Autonomous agents for clinical safety, documentation and supply chain operations.
          </p>
          <div className="flex flex-wrap items-center gap-2.5 pt-2 pl-4">
            <button
              type="button"
              onClick={() => setRevision((value) => value + 1)}
              className="jvk-admin-secondary-btn"
            >
              Refresh
            </button>
            {canManage && (
              <button
                type="button"
                disabled={pending}
                onClick={() => void simulate()}
                className="jvk-admin-primary-btn"
              >
                Run mesh simulation
              </button>
            )}
          </div>
        </div>
        <div className="hidden md:flex shrink-0 items-center justify-end z-0">
          <img
            src="/assets/admin/swarm-hero.svg"
            alt=""
            aria-hidden="true"
            width={240}
            height={146}
            className="jvk-admin-artwork w-56 lg:w-64 h-auto"
          />
        </div>
      </header>

      {statusError && <InlineBanner tone="critical" title={statusError} />}
      {status?.status === "UNAVAILABLE" && (
        <div className="jvk-admin-card-amber flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4" role="status">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#F5E6C4] text-[#855A10]">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
                <path d="M12 8v4" />
                <path d="M12 16h.01" />
              </svg>
            </span>
            <div>
              <p className="text-sm font-bold text-[#6E490B]">Live agent status unavailable</p>
              <p className="text-xs sm:text-sm text-[#7B5D27] mt-0.5">
                The activity below comes from synthetic checks run inside JEEVIKA.
              </p>
            </div>
          </div>
        </div>
      )}
      {error && <InlineBanner tone="critical" title={error} />}
      {notice && <InlineBanner tone="success" title={notice} />}
      {pending && (
        <p role="status" className="text-sm font-medium text-[#047C61] px-1">
          Running simulation…
        </p>
      )}
      {!status && !statusError && (
        <p role="status" className="text-sm text-[#556C63] px-1">
          Loading agents…
        </p>
      )}

      <div className="grid gap-5 md:grid-cols-3">
        {status?.agents.map((agent) => (
          <article key={agent.id} className="jvk-admin-card jvk-admin-card-interactive flex flex-col justify-between p-5 gap-4">
            <div className="space-y-3.5">
              <div className="flex items-start gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#DFF4ED] text-[#047C61] border border-[#C6E5D7]">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
                    {agent.id.includes("scribe") || agent.id.includes("vernacular") ? (
                      <>
                        <path d="m5 8 6 6" />
                        <path d="m4 14 6-6 2-3" />
                        <path d="M2 5h12" />
                        <path d="M7 2h1" />
                        <path d="m22 22-5-10-5 10" />
                        <path d="M14 18h6" />
                      </>
                    ) : agent.id.includes("supply") || agent.id.includes("stock") ? (
                      <>
                        <path d="m7.5 4.27 9 5.15" />
                        <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
                        <path d="m3.3 7 8.7 5 8.7-5" />
                        <path d="M12 22V12" />
                      </>
                    ) : (
                      <path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2" />
                    )}
                  </svg>
                </div>
                <div className="min-w-0">
                  <h2 className="jvk-admin-serif text-lg font-bold text-[#0E2420] leading-snug">
                    {agent.name}
                  </h2>
                  <p className="text-xs sm:text-sm text-[#556C63] mt-1 leading-relaxed">
                    {agent.description}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-[#FDF3DC] border border-[#EEDBB0] px-2.5 py-0.5 text-[11px] font-semibold text-[#855A10]">
                  Live status unavailable
                </span>
                <span className="inline-flex items-center rounded-full bg-[#DFF4ED] border border-[#C3E5D6] px-2.5 py-0.5 text-[11px] font-semibold text-[#065F46]">
                  Synthetic (JEEVIKA)
                </span>
              </div>

              <div className="rounded-xl border border-[#E5ECE6] bg-[#F7FBF8] px-3.5 py-3">
                <p className="text-sm font-semibold text-[#0E2420]">
                  {agent.simulation
                    ? `${agent.simulation.runs} simulations · ${agent.simulation.findings} ${findingLabels[agent.id] ?? "findings"}`
                    : "No simulations recorded"}
                </p>
                <p className="text-xs text-[#556C63] mt-1">
                  {agent.simulation ? (
                    <>
                      Last simulation{" "}
                      <time dateTime={agent.simulation.last_run}>
                        {new Date(agent.simulation.last_run).toLocaleString()}
                      </time>
                    </>
                  ) : (
                    "No completed runs in the active window"
                  )}
                </p>
              </div>
            </div>

            {canManage && (
              <div className="pt-2 border-t border-[#EAEFEA]">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void simulate(agent.id)}
                  className="jvk-admin-secondary-btn w-full whitespace-normal"
                >
                  Simulate {agent.name}
                </button>
              </div>
            )}
          </article>
        ))}
      </div>

      <div className="space-y-3 pt-1">
        <h2 className="jvk-admin-serif text-xl font-bold text-[#0E2420] flex items-center gap-2">
          <span className="h-5 w-1 rounded-full bg-[#047C61]" aria-hidden="true" />
          Agent activity
        </h2>
        {activityError && <InlineBanner tone="critical" title={activityError} />}
        {!activity && !activityError && (
          <p role="status" className="text-sm text-[#556C63]">
            Loading agent activity…
          </p>
        )}
        {activity?.logs.length === 0 && (
          <div className="jvk-admin-card flex flex-col items-center justify-center px-6 py-10 text-center">
            <img
              src="/assets/admin/swarm-hero.svg"
              alt=""
              aria-hidden="true"
              width={132}
              height={80}
              className="jvk-admin-artwork w-32 h-auto opacity-85 mb-3"
            />
            <h3 className="text-base font-bold text-[#0E2420]">No agent activity recorded</h3>
            <p className="mt-1 max-w-md text-sm text-[#556C63]">
              Completed simulations appear here.
            </p>
          </div>
        )}
        {!!activity?.logs.length && (
          <ul className="jvk-admin-card divide-y divide-[#EAEFEA] overflow-hidden">
            {activity.logs.map((log) => (
              <li
                key={log.id}
                className="flex flex-wrap items-center justify-between gap-2 px-5 py-4 text-sm hover:bg-[#F7FBF8] transition-colors"
              >
                <div>
                  <p className="font-semibold text-[#0E2420]">{log.agent_id}</p>
                  <time dateTime={log.occurred_at} className="text-xs text-[#556C63]">
                    {new Date(log.occurred_at).toLocaleString()}
                  </time>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-[#3C544C]">
                  <span className="rounded-full bg-[#DFF4ED] px-2.5 py-0.5 font-semibold text-[#065F46]">
                    {log.findings} {findingLabels[log.agent_id] ?? "findings"}
                  </span>
                  <span>{log.latency_ms} ms</span>
                  <StatusChip>Simulation</StatusChip>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
