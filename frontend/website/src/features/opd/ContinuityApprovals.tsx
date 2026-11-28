import { useState, type FormEvent } from "react";
import { Button, Input } from "@/components/ui/basic";
import { InlineBanner } from "@/components/ui/design-primitives";
import { staffApi, useStaffData } from "@/lib/staffApi";

type Line = {
  lineId: string;
  medicine: string;
  units: number;
  requestThrough: string | null;
  courseEnd: string | null;
};

export function ContinuityApprovals({ encounterId }: { encounterId: string }) {
  const [revision, setRevision] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const path = `/clinical/recovery/${encodeURIComponent(encounterId)}`;
  const refills = "/clinical/refills/approval";
  const recovery = useStaffData<{ eligible: boolean; expiresOn: string | null }>(path, revision);
  const lines = useStaffData<{ items: Line[] }>(`${refills}/${encodeURIComponent(encounterId)}`, revision);

  async function submit(event: FormEvent<HTMLFormElement>, lineId?: string) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    const body = lineId
      ? { requestThrough: data.get("requestThrough"), courseEnd: data.get("courseEnd"), confirmedNewReview: data.get("confirm") === "on" }
      : { expiresOn: data.get("expiresOn"), criterion: "sustained-systolic-v1" };
    setPending(true);
    setError("");
    try {
      await staffApi(lineId ? `${refills}/${encodeURIComponent(lineId)}` : path, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setRevision(value => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Approval could not be confirmed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <details className="rounded-2xl border border-[#E5E0D4] bg-[#FFFDF8] px-4 py-3.5 sm:px-5">
      <summary className="cursor-pointer text-sm font-bold text-[#103B32]">Recovery and refill approvals</summary>
      <div className="mt-4 space-y-4">
        {(error || recovery.error || lines.error) && (
          <InlineBanner tone="critical" title={error || recovery.error || lines.error || "Approval service unavailable."} />
        )}
        {recovery.data?.expiresOn ? (
          <p className="text-sm text-[#103B32]">Recovery plan approved through {recovery.data.expiresOn} (IST).</p>
        ) : recovery.data?.eligible ? (
          <form className="space-y-2.5" onSubmit={event => void submit(event)}>
            <p className="text-sm text-[#52685F]">Approve nurse outreach after Drift Radar flags two successive nonurgent systolic check-ins.</p>
            <label className="block text-sm">
              Recovery through (IST)
              <Input type="date" name="expiresOn" required />
            </label>
            <Button type="submit" disabled={pending}>Approve recovery outreach</Button>
          </form>
        ) : recovery.data ? (
          <p className="text-sm text-[#52685F]">Recovery approval requires a reviewed OPD encounter and remote follow-up consent.</p>
        ) : null}
        {lines.data?.items.length === 0 && (
          <p className="text-sm text-[#52685F]">A refill review requires a completed dispense from your signed prescription.</p>
        )}
        {lines.data?.items.map(line => (
          <section key={line.lineId} className="space-y-2.5 border-t border-[#E5E0D4] pt-3">
            <h3 className="text-sm font-bold text-[#103B32]">{line.medicine} · {line.units} units</h3>
            {line.requestThrough ? (
              <p className="text-sm text-[#52685F]">One refill approved through {line.requestThrough} (IST).</p>
            ) : (
              <form className="space-y-2.5" onSubmit={event => void submit(event, line.lineId)}>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="text-sm">Accept requests through (IST)<Input type="date" name="requestThrough" required /></label>
                  <label className="text-sm">Refill course ends (IST)<Input type="date" name="courseEnd" required /></label>
                </div>
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" name="confirm" required />
                  I reviewed the patient and authorize one refill at the signed quantity.
                </label>
                <Button type="submit" disabled={pending}>Approve one refill</Button>
              </form>
            )}
          </section>
        ))}
        {!recovery.data && !recovery.error && !lines.data && !lines.error && <p role="status">Loading approval status…</p>}
      </div>
    </details>
  );
}
