import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/basic";
import { InlineBanner } from "@/components/ui/design-primitives";
import { patientRequest, patientToken, usePatientData } from "@/lib/patientApi";

const path = "/home/companion/wellness/shares";
const date = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" });

export function WellnessShareControls({ kind, consent }: { kind: "her" | "vitalis"; consent: boolean }) {
  const [revision, setRevision] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const result = usePatientData<{
    encounters: { encounterId: string; clinicName: string; reviewedAt: string }[];
    shares: { id: string; kind: "her" | "vitalis"; encounterId: string; expiresAt: string }[];
  }>(path, revision);
  const [notice, setNotice] = useState("");

  async function update(encounterId: string, shareId?: string) {
    if (pending) return;
    setPending(true);
    setError("");
    setNotice("");
    try {
      await patientRequest(shareId ? `${path}/${encodeURIComponent(shareId)}/revoke` : path, {
        token: patientToken(),
        method: "POST",
        body: shareId ? {} : { kind, encounterId },
      });
      setRevision(value => value + 1);
      setNotice(shareId ? "Summary access revoked." : "Summary shared with the reviewing clinician.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Summary sharing unavailable.");
    } finally {
      setPending(false);
    }
  }
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void update(String(new FormData(event.currentTarget).get("encounter") ?? ""));
  };

  if (!consent) return null;
  const label = kind === "her" ? "HER" : "Vitalis";
  return (
    <details className="jvk-card p-4 sm:p-5">
      <summary className="cursor-pointer text-sm font-bold text-[#103B32]">Share {label} summary</summary>
      <div className="mt-3 space-y-2.5">
        {(error || result.error) && <InlineBanner tone="critical" title={error || result.error || "Sharing unavailable"} />}
        {notice && <InlineBanner tone="success" title={notice} />}
        {result.data?.encounters.length ? (
          <form className="space-y-2.5" onSubmit={submit}>
            <label className="flex flex-col gap-1 text-sm font-semibold text-[#103B32]">
              Reviewed clinic visit
              <select required name="encounter" className="min-h-11 rounded-xl border border-[#D4DFD8] bg-[#FFFDF9] px-3 text-sm">
                <option value="">Select a visit</option>
                {result.data.encounters.map(visit => (
                  <option key={visit.encounterId} value={visit.encounterId}>
                    {visit.clinicName} · {date.format(new Date(visit.reviewedAt))}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-xs text-[#52685F]">Share recent tracking records for seven days with the clinician who reviewed this visit.</p>
            <Button type="submit" disabled={pending}>Share with reviewing clinician</Button>
          </form>
        ) : result.data ? (
          <p className="text-sm text-[#52685F]">A reviewed clinic visit is required.</p>
        ) : !result.error && <p role="status">Loading sharing options…</p>}
        {result.data?.shares.filter(share => share.kind === kind).map(share => (
          <div key={share.id} className="flex flex-wrap items-center gap-2 text-sm text-[#103B32]">
            <span>{result.data?.encounters.find(visit => visit.encounterId === share.encounterId)?.clinicName ?? "Clinic visit"} · Shared through {date.format(new Date(share.expiresAt))}</span>
            <Button type="button" variant="outline" disabled={pending} onClick={() => void update(share.encounterId, share.id)}>
              Revoke summary access
            </Button>
          </div>
        ))}
      </div>
    </details>
  );
}
