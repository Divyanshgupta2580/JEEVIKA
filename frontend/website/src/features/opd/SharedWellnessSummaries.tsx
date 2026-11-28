import { useState } from "react";
import { Button } from "@/components/ui/basic";
import { useStaffData } from "@/lib/staffApi";

type Summary = {
  expiresAt: string;
} & (
  { kind: "her"; cycles: { day: string; periodLength: number | null }[]; records: { day: string; pain: number }[] } |
  { kind: "vitalis"; records: { metric: string; value: number; unit: string; source: string; quality: string; at: string }[] }
);

const iso = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" });

export function SharedWellnessSummaries({ encounterId }: { encounterId: string }) {
  const [revision, setRevision] = useState(0);
  const { data, error } = useStaffData<{ summaries: Summary[] }>(`/clinical/wellness/${encodeURIComponent(encounterId)}`, revision);
  return (
    <details className="rounded-2xl border border-[#E5E0D4] bg-[#FFFDF8] px-4 py-3.5 sm:px-5">
      <summary className="cursor-pointer text-sm font-bold text-[#103B32]">Patient-shared wellness summaries</summary>
      <div className="mt-3 space-y-3 text-sm text-[#52685F]">
        <Button type="button" variant="outline" onClick={() => setRevision(value => value + 1)}>Refresh shared summaries</Button>
        {error && <p role="alert">{error}</p>}
        {!data && !error && <p role="status">Loading shared summaries…</p>}
        {data?.summaries.length === 0 && <p>No active patient shares for this visit.</p>}
        {data?.summaries.map(summary => (
          <section key={summary.kind} className="space-y-2">
            <h3 className="font-bold text-[#103B32]">{summary.kind === "her" ? "HER" : "Vitalis"} tracking summary</h3>
            <p>Access expires {iso.format(new Date(summary.expiresAt))}.</p>
            {summary.kind === "her" ? (
              <ul className="list-disc pl-5">
                {summary.cycles.map((cycle, index) => <li key={`${cycle.day}:${index}`}>Period recorded {cycle.day}{cycle.periodLength === null ? "" : ` · ${cycle.periodLength} days`}</li>)}
                {summary.records.map((record, index) => <li key={`${record.day}:${index}`}>Patient-reported pain on {record.day} · {record.pain}/10</li>)}
              </ul>
            ) : (
              <ul className="list-disc pl-5">
                {summary.records.map((record, index) => <li key={`${record.at}:${index}`}>{record.metric} · {record.value} {record.unit} · {record.source.replace(/_/g, " ")} · {iso.format(new Date(record.at))}</li>)}
              </ul>
            )}
            {summary.records.length === 0 && <p>No recent tracking observations in this summary.</p>}
          </section>
        ))}
      </div>
    </details>
  );
}
