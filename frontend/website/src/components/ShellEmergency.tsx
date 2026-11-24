import { useEffect, useRef, useState } from "react";
import { AlertOctagon } from "lucide-react";
import { Button } from "@/components/ui/basic";
import {
  Drawer,
  InlineBanner,
  StatusChip,
} from "@/components/ui/design-primitives";
import { staffApi } from "@/lib/staffApi";

export const distressChanged = "jeevika:distress-changed";

export type ShellEmergencyEvent = {
  id: string;
  room: string;
  bed: string;
  patientName: string | null;
  diagnosis: string | null;
  reason: string | null;
  triggeredAt: string;
  acknowledgedAt: string | null;
  latencyMs: number | null;
  attending: 0 | 1;
};

function fullBanner(role: string | undefined, view: string) {
  if (role === "DOCTOR")
    return ["doctor-consultation", "emergency-triage", "ipd"].includes(view);
  if (role === "NURSE")
    return ["ipd", "emergency-triage", "nurse-calls"].includes(view);
  return role === "STAT_NURSE" && view === "emergency-triage";
}

export function ShellEmergency({
  role,
  view,
  userId,
}: {
  role?: string;
  view: string;
  userId?: string;
}) {
  const [events, setEvents] = useState<ShellEmergencyEvent[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const prompted = useRef(new Set<string>());
  const supported = [
    "DOCTOR",
    "NURSE",
    "STAT_NURSE",
    "HOSPITAL_ADMIN",
    "CLINIC_ADMIN",
  ].includes(role ?? "");
  const compactAdmin = role === "HOSPITAL_ADMIN" || role === "CLINIC_ADMIN";
  const attending =
    role === "DOCTOR"
      ? events.find((event) => event.attending && !event.acknowledgedAt)
      : undefined;
  const opened =
    role === "DOCTOR"
      ? events.find((event) => event.id === openId && event.attending)
      : undefined;
  const displayed = opened ?? attending ?? events[0];
  const modalSeenKey = `jeevika-attending-${userId ?? ""}`;

  useEffect(() => {
    setEvents([]);
    setOpenId(null);
    if (!supported) return;
    const lifetime = new AbortController();
    let inFlight = false;
    const refresh = async () => {
      if (
        document.visibilityState === "hidden" ||
        inFlight ||
        lifetime.signal.aborted
      )
        return;
      inFlight = true;
      try {
        const { events } = await staffApi<{ events: ShellEmergencyEvent[] }>(
          "/clinical/ipd/distress/active",
          { signal: lifetime.signal },
        );
        if (!lifetime.signal.aborted) {
          setEvents(events);
          setError("");
        }
      } catch {
        if (!lifetime.signal.aborted)
          setError("Emergency alert updates unavailable.");
      } finally {
        inFlight = false;
      }
    };
    const listener = () => {
      void refresh();
    };
    listener();
    const interval = window.setInterval(listener, 4000);
    document.addEventListener("visibilitychange", listener);
    window.addEventListener(distressChanged, listener);
    return () => {
      lifetime.abort();
      clearInterval(interval);
      document.removeEventListener("visibilitychange", listener);
      window.removeEventListener(distressChanged, listener);
    };
  }, [supported, role, userId]);

  useEffect(() => {
    if (role !== "DOCTOR" || opened) return;
    const next = events.find((event) => {
      if (
        !event.attending ||
        event.acknowledgedAt ||
        prompted.current.has(event.id)
      )
        return false;
      try {
        return (
          sessionStorage.getItem(`${modalSeenKey}-${event.id}`) !== "shown"
        );
      } catch {
        return true;
      }
    });
    if (!next) return;
    prompted.current.add(next.id);
    try {
      sessionStorage.setItem(`${modalSeenKey}-${next.id}`, "shown");
    } catch {}
    setOpenId(next.id);
  }, [events, opened, role, modalSeenKey]);

  const triggeredAt = opened?.triggeredAt;
  const awaiting = Boolean(opened && !opened.acknowledgedAt);
  useEffect(() => {
    if (!triggeredAt || !awaiting) return;
    const update = () =>
      setElapsed(
        Math.max(0, Math.floor((Date.now() - Date.parse(triggeredAt)) / 1000)),
      );
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [triggeredAt, awaiting]);

  async function acknowledge(event: ShellEmergencyEvent) {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const result = await staffApi<{
        acknowledgedAt: string;
        latencyMs: number;
      }>(`/clinical/ipd/distress/${event.id}/acknowledge`, { method: "POST" });
      setEvents((current) =>
        current.map((row) =>
          row.id === event.id ? { ...row, ...result } : row,
        ),
      );
      window.dispatchEvent(new Event(distressChanged));
    } catch {
      setError("Acknowledgement could not be confirmed. Try again.");
    } finally {
      setPending(false);
    }
  }

  const mayResolve = (event: ShellEmergencyEvent) =>
    role === "NURSE" || Boolean(event.attending);
  async function resolve(event: ShellEmergencyEvent) {
    if (pending || !mayResolve(event)) return;
    setPending(true);
    setError("");
    try {
      await staffApi(`/clinical/ipd/distress/${event.id}/resolve`, {
        method: "POST",
      });
      setEvents((current) => current.filter(({ id }) => id !== event.id));
      setOpenId(null);
      window.dispatchEvent(new Event(distressChanged));
    } catch {
      setError("Code Blue resolution could not be confirmed. Try again.");
    } finally {
      setPending(false);
    }
  }

  if (!supported) return null;

  const full = displayed && !opened && fullBanner(role, view);
  const compact = displayed && !full && (compactAdmin || opened || attending);

  return (
    <>
      {full && (
        <section
          role="alert"
          aria-label="Code Blue banner"
          className="mx-4 mt-3 flex min-h-14 flex-wrap items-center justify-between gap-3 rounded-xl bg-[var(--ds-emergency)] px-4 py-2 text-white"
        >
          <div className="flex min-w-0 items-center gap-3">
            <AlertOctagon aria-hidden="true" size={20} />
            <div className="min-w-0 break-words">
              <strong>Code Blue</strong>
              <p>
                {displayed.room} · {displayed.bed}
                {displayed.patientName ? ` · ${displayed.patientName}` : ""}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {!!displayed.attending && (
              <Button
                variant="outline"
                className="bg-white text-[var(--ds-text-primary)]"
                onClick={() => setOpenId(displayed.id)}
              >
                Open En Route
              </Button>
            )}
            {mayResolve(displayed) && (
              <Button
                variant="outline"
                className="bg-white text-[var(--ds-text-primary)]"
                disabled={pending}
                onClick={() => void resolve(displayed)}
              >
                Resolve Code Blue
              </Button>
            )}
          </div>
        </section>
      )}
      {compact && (
        <div
          className="mx-4 mt-3 flex flex-wrap items-center gap-2"
          role="status"
        >
          <StatusChip tone="emergency">
            Code Blue · {displayed.room} · {displayed.bed}
          </StatusChip>
          {!opened && attending && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOpenId(attending.id)}
            >
              Open En Route
            </Button>
          )}
        </div>
      )}
      {error && !opened && (compactAdmin || fullBanner(role, view)) && (
        <p className="mx-4 mt-2 text-sm" role="status">
          {error}
        </p>
      )}
      {opened && (
        <Drawer
          open
          onClose={() => setOpenId(null)}
          title="Attending doctor · En Route"
          description={`${opened.room} · ${opened.bed} · ${new Date(opened.triggeredAt).toLocaleTimeString()}`}
        >
          <dl className="space-y-2">
            <div>
              <dt className="font-semibold">Patient</dt>
              <dd>{opened.patientName ?? "Restricted"}</dd>
            </div>
            {opened.diagnosis && (
              <div>
                <dt className="font-semibold">Admission reason</dt>
                <dd>{opened.diagnosis}</dd>
              </div>
            )}
            {opened.reason && (
              <div>
                <dt className="font-semibold">Reported distress</dt>
                <dd>{opened.reason}</dd>
              </div>
            )}
          </dl>
          {error && <InlineBanner tone="critical" title={error} />}
          <div className="mt-4">
            {opened.acknowledgedAt ? (
              <>
                <InlineBanner tone="success" title="En Route recorded">
                  {opened.latencyMs === null
                    ? "Response time unavailable."
                    : `Response time ${opened.latencyMs} ms.`}
                </InlineBanner>
                <Button
                  variant="outline"
                  className="mt-3"
                  disabled={pending}
                  onClick={() => void resolve(opened)}
                >
                  Resolve Code Blue
                </Button>
              </>
            ) : (
              <>
                {elapsed !== null && (
                  <p className="mb-2 tabular-nums">Elapsed {elapsed} seconds</p>
                )}
                <Button
                  disabled={pending}
                  onClick={() => void acknowledge(opened)}
                >
                  {pending ? "Saving…" : "Acknowledge & En Route"}
                </Button>
              </>
            )}
          </div>
        </Drawer>
      )}
    </>
  );
}
