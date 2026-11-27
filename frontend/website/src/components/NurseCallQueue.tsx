import { useState } from "react";
import { Phone, RefreshCw } from "lucide-react";
import { Button, Card, CardContent } from "@/components/ui/basic";
import {
  InlineBanner,
  Slider,
  StatusChip,
} from "@/components/ui/design-primitives";
import { staffApi, useStaffData } from "@/lib/staffApi";
import "@/design-system/nurse-call-queue.css";

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

function GoldBrushUnderline() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 118 8"
      className="mt-1 h-[6px] w-[108px] sm:w-[118px] overflow-visible"
      fill="none"
    >
      <path
        d="M2 5.2C32 1.8 78 1.5 116 4.4"
        stroke="#EBAA24"
        strokeWidth="2.8"
        strokeLinecap="round"
        opacity="0.92"
      />
    </svg>
  );
}

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
  const isRefreshing = !data && !error && revision > 0;

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
    <section
      aria-labelledby="nurse-call-queue-heading"
      className="jvk-nurse-page mx-auto w-full max-w-[1060px] pb-6"
    >
      <div className="jvk-nurse-main-card jvk-nurse-enter p-5 sm:p-8 space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3.5 min-w-0">
            <span
              aria-hidden="true"
              className="mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[#CFE3D7] bg-[#E3F1EA] text-[#087466]"
            >
              <Phone className="h-5 w-5 stroke-[1.9]" />
            </span>
            <div className="min-w-0">
              <h1
                id="nurse-call-queue-heading"
                className="jvk-nurse-serif text-[26px] sm:text-[31px] font-bold leading-tight text-[#103B32]"
              >
                Nurse Call Queue
              </h1>
              <GoldBrushUnderline />
            </div>
          </div>

          <button
            type="button"
            disabled={isRefreshing || pending}
            aria-busy={isRefreshing}
            onClick={() => setRevision((value) => value + 1)}
            className="jvk-nurse-refresh-btn shrink-0"
          >
            <RefreshCw
              className={`h-4 w-4 text-[#087466] ${isRefreshing ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            <span>Refresh</span>
          </button>
        </header>

        <div className="space-y-1.5 pt-1">
          <Slider
            label="Available call minutes"
            value={callMinutes}
            min={0}
            max={240}
            step={10}
            unitSuffix="min"
            onChange={setCallMinutes}
            headerClassName="mb-1.5 text-[15px] font-bold text-[#103B32]"
            outputClassName="text-[15px] font-bold text-[#103B32]"
            rangeClassName="jvk-nurse-slider"
          />
          <p className="text-sm text-[#52685F] leading-relaxed">
            Plan for {plannedMinutesPerCall} minutes per call. All eligible
            patients remain in the queue.
          </p>
        </div>

        {(error || failure) && (
          <InlineBanner tone="critical" title={failure || error || ""} />
        )}
        {notice && (
          <InlineBanner tone="success" animateEntrance title={notice} />
        )}

        {!data && !error && (
          <div
            role="status"
            className="jvk-nurse-empty-card px-6 py-10 text-center text-sm font-medium text-[#52685F]"
          >
            Loading outreach queue…
          </div>
        )}

        {data?.items.length === 0 && (
          <div className="jvk-nurse-empty-card jvk-nurse-enter flex flex-col items-center justify-center px-6 py-9 sm:py-12 text-center">
            <img
              src="/assets/nurse/nurse-outreach-empty.svg"
              alt=""
              aria-hidden="true"
              width={420}
              height={280}
              className="jvk-nurse-artwork mx-auto w-full max-w-[270px] sm:max-w-[330px] h-auto"
            />
            <h2 className="jvk-nurse-serif mt-3 text-[21px] sm:text-[24px] font-bold text-[#103B32]">
              No outreach items
            </h2>
            <p className="mt-1.5 max-w-md text-sm leading-relaxed text-[#52685F]">
              Eligible post-discharge check-ins with follow-up consent will
              appear here.
            </p>
          </div>
        )}

        {data && data.items.length > 0 && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#EAEBE0] pt-4">
              <p className="text-sm font-semibold text-[#103B32]">
                Eligible Outreach Queue ({data.items.length})
              </p>
              <span className="inline-flex items-center rounded-full border border-[#CFE3D7] bg-[#E8F3EC] px-3 py-1 text-xs font-semibold text-[#087466]">
                {Math.min(
                  data.items.length,
                  Math.floor(callMinutes / plannedMinutesPerCall),
                )}{" "}
                of {data.items.length} within {callMinutes} min budget
              </span>
            </div>

            <div className="space-y-3.5">
              {data.items.map((call, index) => {
                const withinBudget =
                  (index + 1) * plannedMinutesPerCall <= callMinutes;
                return (
                  <Card
                    key={call.admissionId}
                    className={`jvk-nurse-call-card ${
                      call.priority === "urgent"
                        ? "!border-[#EBCAC7]"
                        : "!border-[#E4E5DA]"
                    }`}
                  >
                    <CardContent className="space-y-3.5 p-4 sm:p-5">
                      <div className="flex flex-wrap items-center justify-between gap-2.5">
                        <h2 className="jvk-nurse-serif text-lg font-bold text-[#103B32]">
                          {call.patientName}
                        </h2>
                        <StatusChip
                          tone={
                            call.priority === "urgent" ? "critical" : "warning"
                          }
                        >
                          {call.priority === "urgent"
                            ? "Urgent check-in"
                            : "Follow-up review"}
                        </StatusChip>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-sm text-[#52685F]">
                        <time
                          dateTime={call.day}
                          className="font-medium text-[#243B34]"
                        >
                          {call.day}
                        </time>
                        <StatusChip tone={withinBudget ? "success" : "neutral"}>
                          {withinBudget
                            ? "Within call budget"
                            : "Beyond call budget"}
                        </StatusChip>
                      </div>
                      <div className="flex flex-wrap gap-2 pt-0.5">
                        {(
                          Object.keys(actions) as Array<keyof typeof actions>
                        ).map((outcome) => (
                          <Button
                            key={outcome}
                            variant="outline"
                            disabled={pending}
                            onClick={() => void record(call, outcome)}
                            className={`jvk-nurse-outcome-btn min-h-10 rounded-xl border-[#D5DED7] bg-[#FFFDF8] px-3.5 text-xs sm:text-sm font-semibold text-[#103B32] ${
                              outcome === "transfer-reported"
                                ? "hover:border-[#E2B5B0] hover:bg-[#FDF2F1] hover:text-[#A92B24]"
                                : "hover:border-[#99C7B7] hover:bg-[#EDF7F2] hover:text-[#087466]"
                            }`}
                          >
                            {actions[outcome]}
                          </Button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
