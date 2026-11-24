import { useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/basic";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  EmptyState,
  InlineBanner,
  StatusChip,
} from "@/components/ui/design-primitives";
import { staffApi, useStaffData } from "@/lib/staffApi";

const sections = [
  { route: "/app/prune", label: "Overview" },
  { route: "/app/prune/cache", label: "Cache" },
  { route: "/app/prune/waf", label: "Firewall" },
  { route: "/app/prune/redaction", label: "Redaction" },
] as const;
type Route = (typeof sections)[number]["route"];
type Status = {
  configured: boolean;
  requests: number;
  cacheHits: number;
  wafBlocks: number;
  averageLatencyMs: number | null;
  measuredSavingsPaise: number | null;
};
type Cache = { entries: number; lastCachedAt: string | null };
type Firewall = {
  rules: string[];
  fallback: string;
  events: Array<{
    id: string;
    occurred_at: string;
    category: string;
    latency_ms: number;
    simulated: 0 | 1;
  }>;
};

export function PruneGatewayDashboard({
  route,
  canManage,
}: {
  route: Route;
  canManage: boolean;
}) {
  return (
    <section className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6">
      <h1 className="text-2xl font-bold">Prune AI Gateway</h1>
      <nav aria-label="Gateway sections" className="flex flex-wrap gap-2">
        {sections
          .filter(({ route }) => canManage || route !== "/app/prune/redaction")
          .map((item) => (
            <Button
              key={item.route}
              variant={route === item.route ? "default" : "outline"}
              asChild
            >
              <Link
                to={item.route}
                aria-current={route === item.route ? "page" : undefined}
              >
                {item.label}
              </Link>
            </Button>
          ))}
      </nav>
      {route === "/app/prune" && <GatewayOverview canManage={canManage} />}
      {route === "/app/prune/cache" && (
        <CacheManagement canManage={canManage} />
      )}
      {route === "/app/prune/waf" && (
        <FirewallMonitoring canManage={canManage} />
      )}
      {route === "/app/prune/redaction" && canManage && <RedactionPreview />}
    </section>
  );
}

function useGatewayAction() {
  const active = useRef(false);
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  async function run(action: () => Promise<string>) {
    if (active.current) return;
    active.current = true;
    setPending(true);
    setSuccess("");
    setError("");
    try {
      setSuccess(await action());
      setRevision((value) => value + 1);
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "The operation failed.",
      );
    } finally {
      active.current = false;
      setPending(false);
    }
  }

  return {
    pending,
    success,
    error,
    revision,
    run,
    refresh: () => setRevision((value) => value + 1),
  };
}

function OperationFeedback({
  success,
  error,
}: {
  success: string;
  error: string;
}) {
  return (
    <>
      {error && <InlineBanner tone="critical" title={error} />}
      {success && <InlineBanner tone="success" title={success} />}
    </>
  );
}

function GatewayOverview({ canManage }: { canManage: boolean }) {
  const action = useGatewayAction();
  const { data, error } = useStaffData<Status>(
    "/prune/status",
    action.revision,
  );
  return (
    <div className="space-y-4">
      <Button
        variant="outline"
        disabled={action.pending}
        onClick={action.refresh}
      >
        Refresh
      </Button>
      <OperationFeedback
        success={action.success}
        error={action.error || error || ""}
      />
      {!data && !error && <p role="status">Loading gateway status…</p>}
      {data && (
        <>
          <StatusChip tone={data.configured ? "info" : "warning"}>
            {data.configured ? "Provider configured" : "Provider unavailable"}
          </StatusChip>
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Measured requests", data.requests],
              [
                "Cache hit rate",
                data.requests
                  ? `${((100 * data.cacheHits) / data.requests).toFixed(1)}%`
                  : "No requests recorded",
              ],
              ["Firewall blocks", data.wafBlocks],
              [
                "Average latency",
                data.averageLatencyMs === null
                  ? "Unavailable"
                  : `${data.averageLatencyMs} ms`,
              ],
              [
                "Measured savings",
                data.measuredSavingsPaise === null
                  ? "Unavailable"
                  : new Intl.NumberFormat("en-IN", {
                      style: "currency",
                      currency: "INR",
                    }).format(data.measuredSavingsPaise / 100),
              ],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border bg-card p-4">
                <dt className="text-sm">{label}</dt>
                <dd className="text-lg font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
          {canManage && (
            <Button
              disabled={action.pending || !data.configured}
              onClick={() =>
                void action.run(async () => {
                  const result = await staffApi<{ cached: boolean }>(
                    "/prune/gateway/check",
                    { method: "POST" },
                  );
                  return result.cached
                    ? "Gateway check served from cache."
                    : "Prune returned a response.";
                })
              }
            >
              {action.pending ? "Checking…" : "Run gateway check"}
            </Button>
          )}
        </>
      )}
    </div>
  );
}

function CacheManagement({ canManage }: { canManage: boolean }) {
  const [confirm, setConfirm] = useState(false);
  const action = useGatewayAction();
  const { data, error } = useStaffData<Cache>("/prune/cache", action.revision);
  return (
    <div className="space-y-4">
      <Button
        variant="outline"
        disabled={action.pending}
        onClick={action.refresh}
      >
        Refresh
      </Button>
      <OperationFeedback
        success={action.success}
        error={action.error || error || ""}
      />
      {!data && !error && <p role="status">Loading cache…</p>}
      {data?.entries === 0 && (
        <EmptyState
          title="Edge cache is empty"
          description="Responses from gateway checks can be cached for this organization."
        />
      )}
      {!!data?.entries && (
        <Card>
          <CardHeader>
            <CardTitle>Organization edge cache</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{data.entries} entries</p>
            {data.lastCachedAt && (
              <p>
                Most recent entry{" "}
                <time dateTime={data.lastCachedAt}>
                  {new Date(data.lastCachedAt).toLocaleString()}
                </time>
              </p>
            )}
          </CardContent>
        </Card>
      )}
      {canManage && !!data?.entries && (
        <Button
          variant="destructive"
          disabled={action.pending}
          onClick={() => setConfirm(true)}
        >
          Clear edge cache
        </Button>
      )}
      {canManage && (
        <Dialog open={confirm} onOpenChange={setConfirm}>
          <DialogContent>
            <DialogTitle>Clear the organization’s edge cache?</DialogTitle>
            <DialogDescription>
              Future requests may need to reach the upstream provider.
            </DialogDescription>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirm(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  setConfirm(false);
                  void action.run(async () => {
                    const result = await staffApi<{ cleared: number }>(
                      "/prune/cache",
                      { method: "DELETE" },
                    );
                    return `Removed ${result.cleared} cache entries.`;
                  });
                }}
              >
                Clear cache
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function FirewallMonitoring({ canManage }: { canManage: boolean }) {
  const action = useGatewayAction();
  const { data, error } = useStaffData<Firewall>("/prune/waf", action.revision);
  return (
    <div className="space-y-4">
      <Button
        variant="outline"
        disabled={action.pending}
        onClick={action.refresh}
      >
        Refresh
      </Button>
      <OperationFeedback
        success={action.success}
        error={action.error || error || ""}
      />
      {!data && !error && <p role="status">Loading firewall events…</p>}
      {data && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Active firewall rules</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="flex flex-wrap gap-2">
                {data.rules.map((rule) => (
                  <li key={rule}>
                    <StatusChip>{rule}</StatusChip>
                  </li>
                ))}
              </ul>
              <p className="text-sm">
                {data.fallback} Event records contain the classification and
                timing.
              </p>
            </CardContent>
          </Card>
          {canManage && (
            <Button
              disabled={action.pending}
              onClick={() =>
                void action.run(async () => {
                  const result = await staffApi<{ blocked: boolean }>(
                    "/prune/firewall/simulate-injection",
                    { method: "POST", body: "{}" },
                  );
                  return result.blocked
                    ? "Firewall blocked the built-in test."
                    : "The built-in test passed through the firewall.";
                })
              }
            >
              {action.pending
                ? "Running check…"
                : "Run built-in firewall check"}
            </Button>
          )}
          {data.events.length === 0 ? (
            <EmptyState
              title="No firewall events"
              description="Blocked requests and built-in check results appear here."
            />
          ) : (
            <ul className="divide-y rounded-lg border bg-card">
              {data.events.map((event) => (
                <li
                  key={event.id}
                  className="flex flex-wrap justify-between gap-2 p-4 text-sm"
                >
                  <div>
                    <p className="font-medium">{event.category}</p>
                    <time dateTime={event.occurred_at}>
                      {new Date(event.occurred_at).toLocaleString()}
                    </time>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>{event.latency_ms} ms</span>
                    <StatusChip>
                      {event.simulated ? "Simulation" : "Blocked request"}
                    </StatusChip>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function RedactionPreview() {
  const action = useGatewayAction();
  const [input, setInput] = useState("");
  const [identifiers, setIdentifiers] = useState("");
  const [preview, setPreview] = useState("");
  const textarea =
    "w-full rounded-md border bg-background p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  function submit(event: FormEvent) {
    event.preventDefault();
    setPreview("");
    void action.run(async () => {
      const result = await staffApi<{ sanitized: string; changed: boolean }>(
        "/prune/redaction/preview",
        {
          method: "POST",
          body: JSON.stringify({
            text: input,
            identifiers: identifiers
              .split("\n")
              .map((name) => name.trim())
              .filter(Boolean),
          }),
        },
      );
      setPreview(result.sanitized);
      return result.changed
        ? "Redaction preview generated."
        : "The configured rules found no matches.";
    });
  }
  return (
    <form className="space-y-4" onSubmit={submit}>
      <InlineBanner title="Local redaction preview">
        Use synthetic text. Add exact names or addresses one per line to test
        masking.
      </InlineBanner>
      <OperationFeedback success={action.success} error={action.error} />
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          Original text
          <textarea
            required
            maxLength={4000}
            rows={7}
            className={textarea}
            value={input}
            disabled={action.pending}
            onChange={(event) => {
              setInput(event.target.value);
              setPreview("");
            }}
          />
        </label>
        <label className="space-y-2">
          Sanitized preview
          <textarea readOnly rows={7} className={textarea} value={preview} />
        </label>
      </div>
      <label className="block space-y-2">
        Exact identifiers
        <textarea
          maxLength={6000}
          rows={3}
          className={textarea}
          value={identifiers}
          disabled={action.pending}
          onChange={(event) => {
            setIdentifiers(event.target.value);
            setPreview("");
          }}
        />
      </label>
      <Button type="submit" disabled={action.pending}>
        {action.pending ? "Previewing…" : "Preview redaction"}
      </Button>
    </form>
  );
}
