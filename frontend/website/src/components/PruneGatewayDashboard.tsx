import { useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Clock,
  Coins,
  Database,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Zap,
} from "lucide-react";
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
    <section className="jvk-admin-page mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <header className="space-y-4">
        <div>
          <h1 className="jvk-admin-serif text-3xl font-bold tracking-tight text-[#0E2420]">
            Prune AI Gateway
          </h1>
          <p className="text-sm text-[#556C63] mt-1">
            Secure, efficient, and cost-aware gateway for JEEVIKA’s clinical AI services.
          </p>
        </div>

        <div className="jvk-admin-card-hero flex flex-col md:flex-row md:items-center justify-between gap-4 px-6 py-4 overflow-hidden">
          <div className="flex items-start gap-3.5 max-w-2xl z-10">
            <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#DFF4ED] border border-[#C3E5D6] text-[#047C61]">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-base font-bold text-[#0E2420]">
                Intelligent traffic control for clinical AI
              </h2>
              <p className="text-xs sm:text-sm text-[#556C63] mt-1 leading-relaxed">
                Monitor requests, improve performance with semantic cache, and enforce safety with a robust firewall for trusted, cost-efficient AI use across JEEVIKA.
              </p>
            </div>
          </div>
          <div className="hidden md:flex shrink-0 items-center justify-end">
            <img
              src="/assets/admin/prune-hero.png"
              alt=""
              aria-hidden="true"
              width={210}
              height={130}
              className="jvk-admin-artwork w-48 lg:w-52 h-auto"
            />
          </div>
        </div>

        <nav aria-label="Gateway sections" className="jvk-admin-tablist jvk-admin-tablist-light">
          {sections
            .filter(({ route: itemRoute }) => canManage || itemRoute !== "/app/prune/redaction")
            .map((item) => {
              const selected = route === item.route;
              const Icon =
                item.route === "/app/prune/cache"
                  ? Database
                  : item.route === "/app/prune/waf"
                    ? Shield
                    : item.route === "/app/prune/redaction"
                      ? ShieldAlert
                      : BarChart3;
              return (
                <Link
                  key={item.route}
                  to={item.route}
                  aria-current={selected ? "page" : undefined}
                  className={`jvk-admin-tab ${
                    selected
                      ? "!bg-[#047C61] !text-white !border-[#047C61]"
                      : "text-[#3C544C]"
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
        </nav>
      </header>

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
  const metricCards = data
    ? [
        {
          label: "Measured requests",
          value: String(data.requests),
          sublabel: "Total gateway requests recorded",
          icon: Database,
          tone: "mint" as const,
        },
        {
          label: "Cache hit rate",
          value: data.requests
            ? `${((100 * data.cacheHits) / data.requests).toFixed(1)}%`
            : "No requests recorded",
          sublabel: data.requests
            ? `${data.cacheHits} hits across ${data.requests} requests`
            : "Awaiting first cached inference",
          icon: Zap,
          tone: "mint" as const,
        },
        {
          label: "Firewall blocks",
          value: String(data.wafBlocks),
          sublabel: "Intercepted policy violations",
          icon: Shield,
          tone: data.wafBlocks > 0 ? ("rose" as const) : ("mint" as const),
        },
        {
          label: "Average latency",
          value:
            data.averageLatencyMs === null
              ? "Unavailable"
              : `${data.averageLatencyMs} ms`,
          sublabel: "Measured edge turnaround",
          icon: Clock,
          tone: "mint" as const,
        },
        {
          label: "Measured savings",
          value:
            data.measuredSavingsPaise === null
              ? "Unavailable"
              : new Intl.NumberFormat("en-IN", {
                  style: "currency",
                  currency: "INR",
                }).format(data.measuredSavingsPaise / 100),
          sublabel: "Verified inference savings",
          icon: Coins,
          tone: "mint" as const,
        },
      ]
    : [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {data && (
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
                data.configured
                  ? "bg-[#DFF4ED] border-[#BBE2D1] text-[#065F46]"
                  : "bg-[#FDF3DC] border-[#EAD49F] text-[#855A10]"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  data.configured ? "bg-[#047C61]" : "bg-[#D97706]"
                }`}
                aria-hidden="true"
              />
              {data.configured ? "Provider configured" : "Provider unavailable"}
            </span>
          )}
          <button
            type="button"
            disabled={action.pending}
            onClick={action.refresh}
            className="jvk-admin-secondary-btn !min-h-9"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Refresh</span>
          </button>
        </div>

        {data && canManage && (
          <button
            type="button"
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
            className="jvk-admin-primary-btn"
          >
            <Activity className="h-4 w-4" aria-hidden="true" />
            <span>{action.pending ? "Checking…" : "Run gateway check"}</span>
          </button>
        )}
      </div>

      <OperationFeedback
        success={action.success}
        error={action.error || error || ""}
      />
      {!data && !error && (
        <p role="status" className="text-sm text-[#556C63]">
          Loading gateway status…
        </p>
      )}
      {data && (
        <>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {metricCards.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="jvk-admin-card flex items-start gap-3.5 p-5"
                >
                  <span
                    className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl border ${
                      item.tone === "rose"
                        ? "bg-[#FDF1EF] border-[#F2D2CF] text-[#B9382C]"
                        : "bg-[#DFF4ED] border-[#C3E5D6] text-[#047C61]"
                    }`}
                  >
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <dt className="text-xs font-medium text-[#556C63]">
                      {item.label}
                    </dt>
                    <dd className="mt-1 text-xl font-bold text-[#0E2420] tabular-nums break-words">
                      {item.value}
                    </dd>
                    <p className="mt-1 text-xs text-[#6A8178]">{item.sublabel}</p>
                  </div>
                </div>
              );
            })}
          </dl>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="jvk-admin-card p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="jvk-admin-serif text-lg font-bold text-[#0E2420]">
                    Semantic Cache & Latency
                  </h3>
                  <p className="text-xs text-[#556C63]">
                    Inspect cached organization responses and purge entries when needed.
                  </p>
                </div>
                <Link
                  to="/app/prune/cache"
                  className="jvk-admin-secondary-btn !min-h-8 !px-3 text-xs shrink-0"
                >
                  <span>Open Cache</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>
              <p className="text-sm text-[#3C544C]">
                {data.requests > 0
                  ? `${data.cacheHits} cached hits out of ${data.requests} requests.`
                  : "No requests recorded in the gateway telemetry store."}
              </p>
            </div>

            <div className="jvk-admin-card p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="jvk-admin-serif text-lg font-bold text-[#0E2420]">
                    Firewall Activity & Policies
                  </h3>
                  <p className="text-xs text-[#556C63]">
                    Prompts and responses intercepted by configured clinical safety rules.
                  </p>
                </div>
                <Link
                  to="/app/prune/waf"
                  className="jvk-admin-secondary-btn !min-h-8 !px-3 text-xs shrink-0"
                >
                  <span>View Firewall</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>
              <p className="text-sm text-[#3C544C]">
                {data.wafBlocks > 0
                  ? `${data.wafBlocks} firewall block events logged.`
                  : "Zero policy violations detected across inspected prompts."}
              </p>
            </div>
          </div>
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          disabled={action.pending}
          onClick={action.refresh}
          className="jvk-admin-secondary-btn !min-h-9"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Refresh</span>
        </button>
        {canManage && !!data?.entries && (
          <Button
            variant="destructive"
            disabled={action.pending}
            onClick={() => setConfirm(true)}
          >
            Clear edge cache
          </Button>
        )}
      </div>
      <OperationFeedback
        success={action.success}
        error={action.error || error || ""}
      />
      {!data && !error && (
        <p role="status" className="text-sm text-[#556C63]">
          Loading cache…
        </p>
      )}
      {data?.entries === 0 && (
        <div className="jvk-admin-card flex flex-col items-center justify-center px-6 py-10 text-center">
          <h3 className="text-base font-bold text-[#0E2420]">Edge cache is empty</h3>
          <p className="mt-1.5 max-w-md text-sm text-[#556C63]">
            Responses from gateway checks can be cached for this organization.
          </p>
        </div>
      )}
      {!!data?.entries && (
        <Card className="jvk-admin-card border-0">
          <CardHeader>
            <CardTitle className="jvk-admin-serif text-lg">Organization edge cache</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm text-[#3C544C]">
            <p className="text-base font-bold text-[#0E2420] tabular-nums">{data.entries} entries</p>
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          disabled={action.pending}
          onClick={action.refresh}
          className="jvk-admin-secondary-btn !min-h-9"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Refresh</span>
        </button>
        {canManage && data && (
          <button
            type="button"
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
            className="jvk-admin-primary-btn"
          >
            {action.pending
              ? "Running check…"
              : "Run built-in firewall check"}
          </button>
        )}
      </div>
      <OperationFeedback
        success={action.success}
        error={action.error || error || ""}
      />
      {!data && !error && (
        <p role="status" className="text-sm text-[#556C63]">
          Loading firewall events…
        </p>
      )}
      {data && (
        <>
          <Card className="jvk-admin-card border-0">
            <CardHeader>
              <CardTitle className="jvk-admin-serif text-lg">Active firewall rules</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="flex flex-wrap gap-2">
                {data.rules.map((rule) => (
                  <li key={rule}>
                    <StatusChip tone="success">{rule}</StatusChip>
                  </li>
                ))}
              </ul>
              <p className="text-sm text-[#556C63]">
                {data.fallback} Event records contain the classification and timing.
              </p>
            </CardContent>
          </Card>
          {data.events.length === 0 ? (
            <div className="jvk-admin-card flex flex-col items-center justify-center px-6 py-10 text-center">
              <h3 className="text-base font-bold text-[#0E2420]">No firewall events</h3>
              <p className="mt-1.5 max-w-md text-sm text-[#556C63]">
                Blocked requests and built-in check results appear here.
              </p>
            </div>
          ) : (
            <ul className="jvk-admin-card divide-y divide-[#EAEFEA] overflow-hidden">
              {data.events.map((event) => (
                <li
                  key={event.id}
                  className="flex flex-wrap justify-between gap-2 px-5 py-4 text-sm hover:bg-[#F7FBF8] transition-colors"
                >
                  <div>
                    <p className="font-semibold text-[#0E2420]">{event.category}</p>
                    <time dateTime={event.occurred_at} className="text-xs text-[#556C63]">
                      {new Date(event.occurred_at).toLocaleString()}
                    </time>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-[#556C63] tabular-nums">{event.latency_ms} ms</span>
                    <StatusChip tone={event.simulated ? "neutral" : "critical"}>
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
