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
    <section className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Swarm Mesh</h1>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => setRevision((value) => value + 1)}
          >
            Refresh
          </Button>
          {canManage && (
            <Button disabled={pending} onClick={() => void simulate()}>
              Run mesh simulation
            </Button>
          )}
        </div>
      </header>
      {statusError && <InlineBanner tone="critical" title={statusError} />}
      {status?.status === "UNAVAILABLE" && (
        <InlineBanner tone="warning" title="Live agent status unavailable">
          The activity below comes from synthetic checks run inside JEEVIKA.
        </InlineBanner>
      )}
      {error && <InlineBanner tone="critical" title={error} />}
      {notice && <InlineBanner tone="success" title={notice} />}
      {pending && <p role="status">Running simulation…</p>}
      {!status && !statusError && <p role="status">Loading agents…</p>}
      <div className="grid gap-4 md:grid-cols-3">
        {status?.agents.map((agent) => (
          <Card key={agent.id}>
            <CardHeader className="space-y-2">
              <CardTitle>{agent.name}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {agent.description}
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <StatusChip tone="warning">Live status unavailable</StatusChip>
              <p className="text-sm">
                {agent.simulation
                  ? `${agent.simulation.runs} simulations · ${agent.simulation.findings} ${findingLabels[agent.id] ?? "findings"}`
                  : "No simulations recorded"}
              </p>
              {agent.simulation && (
                <p className="text-sm text-muted-foreground">
                  Last simulation{" "}
                  <time dateTime={agent.simulation.last_run}>
                    {new Date(agent.simulation.last_run).toLocaleString()}
                  </time>
                </p>
              )}
              {canManage && (
                <Button
                  variant="outline"
                  className="whitespace-normal"
                  disabled={pending}
                  onClick={() => void simulate(agent.id)}
                >
                  Simulate {agent.name}
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      <h2 className="text-lg font-semibold">Agent activity</h2>
      {activityError && <InlineBanner tone="critical" title={activityError} />}
      {!activity && !activityError && (
        <p role="status">Loading agent activity…</p>
      )}
      {activity?.logs.length === 0 && (
        <EmptyState
          title="No agent activity recorded"
          description="Completed simulations appear here."
        />
      )}
      {!!activity?.logs.length && (
        <ul className="divide-y rounded-lg border bg-card">
          {activity.logs.map((log) => (
            <li
              key={log.id}
              className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm"
            >
              <div>
                <p className="font-medium">{log.agent_id}</p>
                <time dateTime={log.occurred_at}>
                  {new Date(log.occurred_at).toLocaleString()}
                </time>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span>
                  {log.findings} {findingLabels[log.agent_id] ?? "findings"} ·{" "}
                  {log.latency_ms} ms
                </span>
                <StatusChip>Simulation</StatusChip>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
