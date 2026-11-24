import { useState } from "react";
import { Button, Card, CardContent } from "@/components/ui/basic";
import {
  EmptyState,
  InlineBanner,
  Slider,
  StatusChip,
} from "@/components/ui/design-primitives";
import { staffApi, useStaffData } from "@/lib/staffApi";

const plannedMinutesPerCall = 10;
const actions = {
  stable: "Patient reassured",
  "medication-reviewed": "Medication concern reviewed",
  "opd-requested": "OPD review requested",
  "transfer-reported": "Emergency transfer reported",
} as const;

type Call = {
  admissionId: string;
  patientName: string;
  day: string;
  priority: "urgent" | "review";
};

export function NurseCallQueue() {
  const [callMinutes, setCallMinutes] = useState(60);
  const [revision, setRevision] = useState(0);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const [failure, setFailure] = useState("");
  const { data, error } = useStaffData<{ items: Call[] }>(
    "/clinical/nurse-calls",
    revision,
  );
  async function record(call: Call, outcome: keyof typeof actions) {
    if (pending) return;
    setPending(true);
    setNotice("");
    setFailure("");
    try {
      await staffApi("/clinical/nurse-calls/outcomes", {
        method: "POST",
        body: JSON.stringify({
          admissionId: call.admissionId,
          day: call.day,
          outcome,
        }),
      });
      setNotice("Outreach outcome recorded.");
      setRevision((value) => value + 1);
    } catch (failure) {
      setFailure(
        failure instanceof Error
          ? failure.message
          : "Outreach outcome could not be confirmed.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Nurse Call Queue</h1>
        <Button
          variant="outline"
          onClick={() => setRevision((value) => value + 1)}
        >
          Refresh
        </Button>
      </header>
      <Slider
        label="Available call minutes"
        value={callMinutes}
        min={0}
        max={240}
        step={10}
        onChange={setCallMinutes}
      />
      <p className="text-sm text-[var(--ds-text-secondary)]">
        Plan for {plannedMinutesPerCall} minutes per call. All eligible patients
        remain in the queue.
      </p>
      {(error || failure) && (
        <InlineBanner tone="critical" title={failure || error || ""} />
      )}
      {notice && <InlineBanner tone="success" title={notice} />}
      {!data && !error && <p role="status">Loading outreach queue…</p>}
      {data?.items.length === 0 && (
        <EmptyState
          title="No outreach items"
          description="Eligible post-discharge check-ins with follow-up consent will appear here."
        />
      )}
      {data?.items.map((call, index) => (
        <Card key={call.admissionId}>
          <CardContent className="space-y-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold">{call.patientName}</h2>
              <StatusChip
                tone={call.priority === "urgent" ? "critical" : "warning"}
              >
                {call.priority === "urgent"
                  ? "Urgent check-in"
                  : "Follow-up review"}
              </StatusChip>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <time dateTime={call.day}>{call.day}</time>
              <StatusChip>
                {(index + 1) * plannedMinutesPerCall <= callMinutes
                  ? "Within call budget"
                  : "Beyond call budget"}
              </StatusChip>
            </div>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(actions) as Array<keyof typeof actions>).map(
                (outcome) => (
                  <Button
                    key={outcome}
                    variant="outline"
                    disabled={pending}
                    onClick={() => void record(call, outcome)}
                  >
                    {actions[outcome]}
                  </Button>
                ),
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
