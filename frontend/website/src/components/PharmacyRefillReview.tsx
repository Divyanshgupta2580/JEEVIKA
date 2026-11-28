import { useState } from "react";
import { Button } from "@/components/ui/basic";
import { InlineBanner } from "@/components/ui/design-primitives";
import { staffApi, useStaffData } from "@/lib/staffApi";

type Item = {
  id: string;
  medicine: string;
  units: number;
  status: "requested" | "held";
  heldUntil: string | null;
};

export function PharmacyRefillReview({ revision, onChanged }: { revision: number; onChanged: () => void }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const path = "/clinical/refills";
  const result = useStaffData<{ items: Item[] }>(path, revision);
  async function change(id: string, action: "hold" | "release") {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      await staffApi(`${path}/${encodeURIComponent(id)}/${action}`, {
        method: "POST", body: JSON.stringify({ confirmed: true }),
      });
      onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Refill update unavailable.");
    } finally {
      setPending(false);
    }
  }
  return (
    <details className="jvk-clinic-ops-card px-5 py-4" open={result.data?.items.length ? true : undefined}>
      <summary className="cursor-pointer text-sm font-bold text-[#103B32]">Refill requests</summary>
      <div className="mt-3 space-y-2.5">
        {(error || result.error) && <InlineBanner tone="critical" title={error || result.error || "Refills unavailable"} />}
        {result.data?.items.length === 0 && <p className="text-sm text-[#52685F]">No active refill requests for this clinic.</p>}
        {!result.data && !result.error && <p role="status">Loading refill requests…</p>}
        {result.data?.items.map(item => (
          <div key={item.id} className="rounded-xl border border-[#E4E5DA] bg-[#FFFDF8] p-3">
            <p className="text-sm font-bold text-[#103B32]">{item.medicine} · {item.units} units</p>
            <p className="break-all font-mono text-xs text-[#52685F]">Request {item.id}</p>
            {item.heldUntil ? (
              <p className="text-xs text-[#52685F]">Stock held until {new Date(item.heldUntil).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST.</p>
            ) : (
              <p className="text-xs text-[#52685F]">Clinician-approved request. Confirm to hold eligible stock for up to 24 hours.</p>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              {item.status === "requested" && <Button type="button" disabled={pending} onClick={() => void change(item.id, "hold")}>Confirm stock hold</Button>}
              <Button type="button" variant="outline" disabled={pending} onClick={() => void change(item.id, "release")}>Release request</Button>
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}
