import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  Calendar,
  CalendarCheck,
  CalendarDays,
  CalendarRange,
  Camera,
  ChevronDown,
  ClipboardCheck,
  Droplet,
  Flower2,
  HeartPulse,
  Info,
  Leaf,
  MonitorSmartphone,
  NotebookPen,
  Pill,
  Siren,
  Smile,
  Sparkles,
  Stethoscope,
  Store,
  User,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { checkInSchema } from "../../../../../packages/shared/patient-experience";
import { Button, Input } from "@/components/ui/basic";
import { EmptyState, InlineBanner } from "@/components/ui/design-primitives";
import { DocumentReview, VoiceControls } from "@/features/patient/capture";
import { patientRequest, patientToken, usePatientData } from "@/lib/patientApi";
import { PatientGoldUnderline } from "./PatientPortalShell";

const ENDPOINT = "/home/companion";

const dateFmt = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeZone: "Asia/Kolkata",
});
const formatDate = (value: string) => dateFmt.format(new Date(value));
const todayIso = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(
    new Date(),
  );

const questionCardStyle = "jvk-card p-4 sm:p-5 flex items-start gap-3.5 sm:gap-4";
const questionLabelStyle =
  "flex-1 min-w-0 flex flex-col gap-2 text-sm font-bold text-[#0E2420]";
const selectStyle =
  "min-h-12 w-full rounded-xl border border-[#D4DFD8] bg-[#FFFDF9] pl-3.5 pr-4 py-2.5 text-[15px] font-medium text-[#0E2420] shadow-xs transition-colors focus:bg-white focus:border-[#047C61]";
const inputFieldStyle =
  "h-11 rounded-xl border-[#D5D0C3] bg-white text-[#0E2420] focus-visible:border-[#047C61] focus-visible:ring-[#047C61]/20";

/** Soft pastel icon badge matching the approved patient portal card anatomy. */
function PastelIconBadge({
  icon: Icon,
  tone = "mint",
}: {
  icon: LucideIcon;
  tone?: "mint" | "amber" | "rose";
}) {
  const colors =
    tone === "rose"
      ? "bg-[#FDECEF] text-[#B60020] border-[#F6CDD6]"
      : tone === "amber"
        ? "bg-[#FBF1DA] text-[#17463B] border-[#EFE0B8]"
        : "bg-[#E5F3EA] text-[#047C61] border-[#CBE2D4]";

  return (
    <span
      aria-hidden="true"
      className={`inline-flex size-12 shrink-0 items-center justify-center rounded-2xl border ${colors}`}
    >
      <Icon className="size-5" strokeWidth={2} />
    </span>
  );
}

/** Shared loading & error state renderer in the isolated patient design system. */
export function PortalLoaded<T>({
  result,
  children,
}: {
  result: { data?: T; error?: string };
  children: (data: T) => ReactNode;
}) {
  if (result.error)
    return <InlineBanner tone="critical" title={result.error} />;
  if (!result.data) {
    return (
      <div className="jvk-card p-6 text-center">
        <p role="status" className="text-sm font-medium text-[#465953]">
          Loading your records…
        </p>
      </div>
    );
  }
  return <>{children(result.data)}</>;
}

/** Shared action state scoped individually per view so feedback never leaks across routes. */
function useViewAction() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const busy = useRef(false);

  async function run(action: () => Promise<string>) {
    if (busy.current) return;
    busy.current = true;
    setError("");
    setMessage("");
    setPending(true);
    try {
      setMessage(await action());
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Unable to save. Try again.",
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return { pending, message, error, run };
}

/** Shared action feedback banners (preserved with non-obscured high contrast). */
function ActionFeedback({
  error,
  message,
}: {
  error: string;
  message: string;
}) {
  return (
    <>
      {error && <InlineBanner tone="critical" title={error} />}
      {message && <InlineBanner tone="success" title={message} animateEntrance />}
    </>
  );
}

function getThreadMeta(title: string, source: string) {
  const normalized = title.toLowerCase();
  if (normalized.includes("check-in")) {
    return {
      icon: ClipboardCheck,
      tone: "mint" as const,
      sourceIcon: User,
      subtitle: "A quick update on your health and well-being.",
      featured: true,
    };
  }
  if (normalized.includes("kiosk")) {
    return {
      icon: MonitorSmartphone,
      tone: "amber" as const,
      sourceIcon: Store,
      subtitle: "Health intake completed at a clinic kiosk.",
      featured: false,
    };
  }
  if (normalized.includes("prescription")) {
    return {
      icon: Pill,
      tone: "mint" as const,
      sourceIcon: Stethoscope,
      subtitle: "Signed prescription recorded for your care plan.",
      featured: false,
    };
  }
  if (normalized.includes("review")) {
    return {
      icon: Stethoscope,
      tone: "mint" as const,
      sourceIcon: Stethoscope,
      subtitle: "Clinical review recorded by your care team.",
      featured: false,
    };
  }
  return {
    icon: source === "Patient" ? User : Store,
    tone: source === "Patient" ? ("mint" as const) : ("amber" as const),
    sourceIcon: source === "Patient" ? User : Store,
    subtitle: "Care interaction recorded on your health thread.",
    featured: false,
  };
}

/** PAGE 01 — HEALTH THREAD (#/app/home/thread) */
export function ThreadView() {
  const result = usePatientData<{
    events: Array<{
      id: string;
      title: string;
      source: string;
      occurredAt: string;
    }>;
    nextAction: "check-in" | null;
  }>(`${ENDPOINT}/thread`);

  return (
    <PortalLoaded result={result}>
      {({ events, nextAction }) => (
        <div
          className={
            nextAction
              ? "grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start"
              : "space-y-5"
          }
        >
          {nextAction && (
            <div className="lg:col-span-4 lg:order-2">
              <div className="jvk-card-sage relative overflow-hidden p-5 sm:p-6 space-y-4">
                <div className="flex items-start gap-3.5">
                  <PastelIconBadge icon={CalendarCheck} tone="mint" />
                  <div className="space-y-1">
                    <h2 className="text-base font-bold text-[#0E2420]">
                      Next action
                    </h2>
                    <p className="text-xs leading-relaxed text-[#465953]">
                      Share today&apos;s recovery update with your care team.
                    </p>
                  </div>
                </div>
                <Button
                  asChild
                  className="min-h-11 w-full rounded-xl bg-gradient-to-b from-[#047C61] to-[#026452] hover:from-[#036B54] hover:to-[#025546] text-white font-semibold shadow-sm"
                >
                  <Link
                    to="/app/home/check-in"
                    className="inline-flex items-center justify-center gap-2"
                  >
                    <span>Complete today’s check-in</span>
                    <ArrowRight aria-hidden="true" className="size-4" />
                  </Link>
                </Button>
              </div>
            </div>
          )}

          <div className={nextAction ? "lg:col-span-8 lg:order-1" : "w-full"}>
            {events.length ? (
              <ol className="relative pl-6 sm:pl-7 space-y-4 before:absolute before:left-2 sm:before:left-2.5 before:top-4 before:bottom-4 before:w-px before:bg-[#D2DFD7]">
                {events.map((event) => {
                  const meta = getThreadMeta(event.title, event.source);
                  const SourceIcon = meta.sourceIcon;
                  return (
                    <li key={event.id} className="relative">
                      {/* Connected timeline circular node */}
                      <span
                        aria-hidden="true"
                        className="absolute -left-[22px] sm:-left-[24px] top-6 flex size-4 items-center justify-center rounded-full border border-[#CBE2D4] bg-[#E5F3EA]"
                      >
                        <span className="size-2 rounded-full bg-[#047C61]" />
                      </span>

                      <article
                        className={`relative overflow-hidden p-4 sm:p-5 ${
                          meta.featured ? "jvk-card-sage" : "jvk-card"
                        }`}
                      >
                        {meta.featured && (
                          <img
                            src="/assets/patient/botanical-corner-leaf.png"
                            alt=""
                            aria-hidden="true"
                            width={86}
                            height={106}
                            style={{
                              WebkitMaskImage:
                                "radial-gradient(ellipse at 70% 80%, #000 35%, transparent 80%)",
                              maskImage:
                                "radial-gradient(ellipse at 70% 80%, #000 35%, transparent 80%)",
                            }}
                            className="pointer-events-none select-none mix-blend-multiply absolute -bottom-2 right-0 h-16 w-auto -scale-x-100 opacity-45"
                          />
                        )}
                        <div className="relative z-10 flex items-start gap-3.5 sm:gap-4">
                          <PastelIconBadge icon={meta.icon} tone={meta.tone} />
                          <div className="min-w-0 flex-1 space-y-2">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <h2 className="text-[15.5px] sm:text-base font-bold text-[#0E2420] leading-snug">
                                  {event.title}
                                </h2>
                                <p className="mt-0.5 text-xs sm:text-[13px] text-[#4D6059]">
                                  {meta.subtitle}
                                </p>
                              </div>

                              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#CBE2D4] bg-[#E8F4EC] px-2.5 py-1 text-xs font-semibold text-[#0E3F33]">
                                <SourceIcon
                                  aria-hidden="true"
                                  className="size-3.5 text-[#047C61]"
                                />
                                <span>{event.source}</span>
                              </span>
                            </div>

                            <div className="inline-flex items-center gap-1.5 rounded-lg bg-[#EDF4EF] px-2.5 py-1 text-xs font-semibold text-[#234139]">
                              <Calendar
                                aria-hidden="true"
                                className="size-3.5 text-[#047C61]"
                              />
                              <time dateTime={event.occurredAt}>
                                {formatDate(event.occurredAt)}
                              </time>
                            </div>
                          </div>
                        </div>
                      </article>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <div className="jvk-card p-6 sm:p-8">
                <EmptyState
                  title="No health events yet"
                  description="Clinic visits, prescriptions, dispensing and completed check-ins appear here."
                />
              </div>
            )}
          </div>
        </div>
      )}
    </PortalLoaded>
  );
}

/** PAGE 02 — DAILY CHECK-IN (#/app/home/check-in) */
export function CheckInView() {
  const action = useViewAction();
  const [urgent, setUrgent] = useState(false);
  const [note, setNote] = useState("");
  const [imageText, setImageText] = useState("");
  const [bp, setBp] = useState({ systolic: "", diastolic: "" });

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const number = (key: string) =>
      values.get(key) ? Number(values.get(key)) : undefined;
    const body = checkInSchema.safeParse({
      recovery: values.get("recovery"),
      medication: values.get("medication"),
      distress: values.get("distress") === "yes",
      systolic: number("systolic"),
      diastolic: number("diastolic"),
      pulse: number("pulse"),
      spo2: number("spo2"),
      glucose: number("glucose"),
      note: note.trim() || undefined,
    });
    setUrgent(
      values.get("distress") === "yes" ||
        (number("systolic") ?? 0) >= 180 ||
        (number("spo2") ?? 100) <= 90,
    );
    void action.run(async () => {
      if (!body.success)
        throw new Error("Review your readings and the required answers.");
      const result = await patientRequest<{ urgent: boolean }>(
        `${ENDPOINT}/check-in`,
        { method: "POST", body: body.data, token: patientToken() },
      );
      setUrgent(result.urgent);
      return "Check-in saved.";
    });
  }

  const detectedBp = imageText.match(/\b(\d{2,3})\s*[/|]\s*(\d{2,3})\b/);

  return (
    <form className="space-y-5 pb-4" onSubmit={save}>
      {urgent && (
        <InlineBanner tone="critical" title="Get urgent help">
          Seek immediate in-person care. This check-in does not dispatch an
          emergency response.
        </InlineBanner>
      )}
      <ActionFeedback error={action.error} message={action.message} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:items-start">
        {/* Primary Required Check-In Questions */}
        <div className="lg:col-span-6 space-y-4">
          <div className={questionCardStyle}>
            <PastelIconBadge icon={Smile} tone="mint" />
            <label className={questionLabelStyle}>
              <span>How are you feeling today?</span>
              <select
                className={selectStyle}
                required
                name="recovery"
                defaultValue=""
              >
                <option value="" disabled hidden>
                  Select an answer
                </option>
                <option value="better">Better</option>
                <option value="same">About the same</option>
                <option value="worse">Worse</option>
              </select>
            </label>
          </div>

          <div className={questionCardStyle}>
            <PastelIconBadge icon={Pill} tone="amber" />
            <label className={questionLabelStyle}>
              <span>Did you take your scheduled medicines?</span>
              <select
                className={selectStyle}
                required
                name="medication"
                defaultValue=""
              >
                <option value="" disabled hidden>
                  Select an answer
                </option>
                <option value="taken">Yes</option>
                <option value="missed">Missed a dose</option>
                <option value="not-applicable">No medicines scheduled</option>
              </select>
            </label>
          </div>

          <div className={questionCardStyle}>
            <PastelIconBadge icon={Siren} tone={urgent ? "rose" : "mint"} />
            <label className={questionLabelStyle}>
              <span>Do you need urgent help right now?</span>
              <select
                className={selectStyle}
                required
                name="distress"
                defaultValue=""
                onChange={(event) => setUrgent(event.target.value === "yes")}
              >
                <option value="" disabled hidden>
                  Select an answer
                </option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </label>
          </div>

          {/* Desktop Submit Placement (remains in DOM flow below for mobile as well) */}
          <div className="hidden lg:block pt-1">
            <Button
              type="submit"
              className="min-h-12 w-full rounded-xl bg-gradient-to-b from-[#047C61] to-[#026452] hover:from-[#036B54] hover:to-[#025546] text-white font-semibold text-base shadow-[0_8px_20px_rgba(4,124,97,0.22)]"
              disabled={action.pending}
            >
              {action.pending ? "Saving…" : "Save check-in"}
            </Button>
          </div>
        </div>

        {/* Optional Readings, Photo OCR, and Note */}
        <div className="lg:col-span-6 space-y-4">
          <details open className="jvk-card group overflow-hidden">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 sm:px-5 font-bold text-[#0E2420] hover:bg-[#F7F4EB]/70 transition-colors">
              <span className="flex items-center gap-3">
                <span className="inline-flex size-9 items-center justify-center rounded-xl bg-[#E5F3EA] text-[#047C61]">
                  <Camera aria-hidden="true" className="size-4" />
                </span>
                <span>Add a reading or photo</span>
              </span>
              <ChevronDown
                aria-hidden="true"
                className="size-4 text-[#4B5D57] transition-transform group-open:rotate-180"
              />
            </summary>

            <div className="border-t border-[#EAE6DC] px-4 py-4 sm:px-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(
                  [
                    ["systolic", "Systolic (mmHg)"],
                    ["diastolic", "Diastolic (mmHg)"],
                  ] as const
                ).map(([field, label]) => (
                  <label
                    key={field}
                    htmlFor={`check-in-${field}`}
                    className="flex flex-col gap-1 text-xs font-semibold text-[#2E433D]"
                  >
                    <span>{label}</span>
                    <Input
                      id={`check-in-${field}`}
                      min={field === "systolic" ? 50 : 25}
                      max={field === "systolic" ? 300 : 230}
                      type="number"
                      name={field}
                      value={bp[field]}
                      onChange={(event) =>
                        setBp({ ...bp, [field]: event.target.value })
                      }
                      className={inputFieldStyle}
                    />
                  </label>
                ))}
                {(
                  [
                    ["pulse", "Pulse (bpm)", 25, 250],
                    ["spo2", "SpO₂ (%)", 40, 100],
                    ["glucose", "Glucose (mg/dL)", 20, 700],
                  ] as const
                ).map(([field, label, min, max]) => (
                  <label
                    key={field}
                    htmlFor={`check-in-${field}`}
                    className="flex flex-col gap-1 text-xs font-semibold text-[#2E433D]"
                  >
                    <span>{label}</span>
                    <Input
                      id={`check-in-${field}`}
                      type="number"
                      name={field}
                      min={min}
                      max={max}
                      className={inputFieldStyle}
                    />
                  </label>
                ))}
              </div>

              <div className="jvk-capture-slot rounded-2xl border border-[#EAE6DC] bg-[#F8F5EC]/75 p-4 space-y-3">
                <DocumentReview
                  value={imageText}
                  label="Review extracted device text"
                  onChange={setImageText}
                />
                {detectedBp && (
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl border-[#BBD8CC] bg-white text-xs font-semibold text-[#047C61] hover:bg-[#E7F2E8]"
                    onClick={() =>
                      setBp({
                        systolic: detectedBp[1] ?? "",
                        diastolic: detectedBp[2] ?? "",
                      })
                    }
                  >
                    Use reviewed blood pressure values
                  </Button>
                )}
              </div>
            </div>
          </details>

          <details className="jvk-motion-details jvk-card group overflow-hidden">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 sm:px-5 font-bold text-[#0E2420] hover:bg-[#F7F4EB]/70 transition-colors">
              <span className="flex items-center gap-3">
                <span className="inline-flex size-9 items-center justify-center rounded-xl bg-[#FBF1DA] text-[#17463B]">
                  <NotebookPen aria-hidden="true" className="size-4" />
                </span>
                <span>Add a note</span>
              </span>
              <ChevronDown
                aria-hidden="true"
                className="size-4 text-[#4B5D57] transition-transform group-open:rotate-180"
              />
            </summary>

            <div className="jvk-motion-details-body jvk-capture-slot border-t border-[#EAE6DC] px-4 py-4 sm:px-5 space-y-3">
              <VoiceControls
                locale="en-IN"
                caption="Tell us how you are feeling today."
                onTranscript={(text) => setNote(text.slice(0, 1000))}
              />
              <label
                className="flex flex-col gap-1.5 text-xs font-semibold text-[#2E433D]"
                htmlFor="vitalis-value"
              >
                <span>Check-in note</span>
                <textarea
                  id="vitalis-value"
                  className="block w-full rounded-xl border border-[#D5D0C3] bg-white p-3 text-sm text-[#0E2420]"
                  rows={3}
                  maxLength={1000}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
              </label>
            </div>
          </details>
        </div>
      </div>

      {/* Mobile & Tablet Submit Button (always above bottom navigation) */}
      <div className="lg:hidden pt-1">
        <Button
          type="submit"
          className="min-h-12 w-full rounded-xl bg-gradient-to-b from-[#047C61] to-[#026452] hover:from-[#036B54] hover:to-[#025546] text-white font-semibold text-base shadow-[0_8px_20px_rgba(4,124,97,0.22)]"
          disabled={action.pending}
        >
          {action.pending ? "Saving…" : "Save check-in"}
        </Button>
      </div>
    </form>
  );
}

/** PAGE 03 — DRIFT RADAR (#/app/home/drift) */
export function DriftView() {
  const result = usePatientData<{
    readings: Array<{ day: string; systolic?: number; spo2?: number }>;
    baseline: number | null;
    alert: boolean;
    urgent: boolean;
    status: "urgent" | "no-readings" | "missing-systolic" | "outside-trend-range" | "learning" | "trend-change" | "sustained" | "monitoring";
    recoveryHandoff: "checked" | "unavailable" | null;
  }>(`${ENDPOINT}/drift`);

  return (
    <PortalLoaded result={result}>
      {({ readings, baseline, alert, urgent, status, recoveryHandoff }) => (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
          {/* Baseline / Alert Status Panel */}
          <div className="lg:col-span-5">
            {urgent ? (
              <InlineBanner tone="critical" title="Urgent reading">
                Seek immediate in-person care.
              </InlineBanner>
            ) : alert ? (
              <InlineBanner tone="warning" title="A change was detected">
                Discuss recent readings with your care team.
                {status === "trend-change" && " The change has been flagged on one check-in."}
                {recoveryHandoff === "unavailable" && " The recovery handoff is unavailable. Refresh to retry."}
              </InlineBanner>
            ) : (
              <div className="jvk-card-sage relative overflow-hidden p-5 sm:p-6">
                <img
                  src="/assets/patient/botanical-corner-leaf.png"
                  alt=""
                  aria-hidden="true"
                  width={86}
                  height={106}
                  style={{
                    WebkitMaskImage:
                      "radial-gradient(ellipse at 70% 80%, #000 35%, transparent 80%)",
                    maskImage:
                      "radial-gradient(ellipse at 70% 80%, #000 35%, transparent 80%)",
                  }}
                  className="pointer-events-none select-none mix-blend-multiply absolute -bottom-2 right-0 h-20 w-auto -scale-x-100 opacity-50"
                />
                <div className="relative z-10 flex items-start gap-3.5">
                  <PastelIconBadge icon={Activity} tone="mint" />
                  <div className="space-y-1">
                    <h2 className="text-base sm:text-lg font-bold text-[#0E2420]">
                      {status === "outside-trend-range" ? "Reading outside trend range" :
                        status === "missing-systolic" && baseline !== null ? "Latest systolic reading missing" :
                        baseline === null || status === "learning" ? "Learning your baseline" : "Baseline available"}
                    </h2>
                    <p className="text-xs sm:text-[13.5px] leading-relaxed text-[#465953]">
                      {baseline === null
                        ? "Log seven systolic readings on different days to establish a baseline."
                        : `Systolic baseline ${baseline} mmHg.`}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Reading History / Clipboard Illustration Empty State */}
          <div className="lg:col-span-7">
            {readings.length ? (
              <ul className="space-y-3.5">
                {[...readings].reverse().map((reading) => {
                  const summary = [
                    reading.systolic === undefined
                      ? ""
                      : `Systolic ${reading.systolic} mmHg`,
                    reading.spo2 === undefined ? "" : `SpO₂ ${reading.spo2}%`,
                  ]
                    .filter(Boolean)
                    .join(" · ");

                  if (!summary) {
                    return (
                      <li
                        key={reading.day}
                        className="jvk-card overflow-hidden p-5 sm:p-6"
                      >
                        <div className="flex items-center gap-2.5 border-b border-[#EAE6DC] pb-3.5">
                          <span className="inline-flex size-8 items-center justify-center rounded-xl bg-[#E5F3EA] text-[#047C61]">
                            <CalendarDays aria-hidden="true" className="size-4" />
                          </span>
                          <time
                            className="text-sm font-bold text-[#0E2420]"
                            dateTime={reading.day}
                          >
                            {formatDate(reading.day)}
                          </time>
                        </div>
                        <div className="pt-5 pb-2 text-center space-y-2">
                          <img
                            src="/assets/patient/drift-clipboard.png"
                            alt=""
                            aria-hidden="true"
                            width={288}
                            height={144}
                            className="jvk-illustration-blend mx-auto h-32 w-auto select-none object-contain"
                          />
                          <p className="relative inline-block text-base sm:text-lg font-bold text-[#0E2420] pb-1.5">
                            No drift reading recorded
                            <PatientGoldUnderline className="absolute bottom-0 left-1/2 -translate-x-1/2 h-2 w-40 opacity-85" />
                          </p>
                        </div>
                      </li>
                    );
                  }

                  return (
                    <li
                      key={reading.day}
                      className="jvk-card p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="inline-flex size-9 items-center justify-center rounded-xl bg-[#E5F3EA] text-[#047C61]">
                          <CalendarDays aria-hidden="true" className="size-4" />
                        </span>
                        <time
                          className="text-sm font-bold text-[#0E2420]"
                          dateTime={reading.day}
                        >
                          {formatDate(reading.day)}
                        </time>
                      </div>
                      <p className="rounded-xl border border-[#CBE2D4] bg-[#EEF8F3] px-3 py-1.5 text-xs sm:text-sm font-semibold text-[#0E3F33]">
                        {summary}
                      </p>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="jvk-card p-6 sm:p-8 text-center space-y-3">
                <img
                  src="/assets/patient/drift-clipboard.png"
                  alt=""
                  aria-hidden="true"
                  width={288}
                  height={144}
                  className="jvk-illustration-blend mx-auto h-32 w-auto select-none object-contain"
                />
                <div className="space-y-1">
                  <h2 className="text-lg font-bold text-[#0E2420]">
                    No readings yet
                  </h2>
                  <p className="text-sm text-[#4B5D57]">
                    Your confirmed check-in readings will appear here.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </PortalLoaded>
  );
}

type Prescription = {
  id: string;
  lineId: string;
  refillEligible: 0 | 1 | null;
  refillRequestId: string | null;
  refillStatus: "requested" | "held" | "released" | null;
  refillHeldUntil: string | null;
  medicine: string;
  units: number;
  directions: string;
  course_end: string;
  signed_at: string;
  dispensed: number;
};

/** PAGE 04 — MEDICINES & REFILL (#/app/home/refill & #/app/home/prescriptions) */
export function MedicinesView({ view }: { view: "refill" | "prescriptions" }) {
  const [revision, setRevision] = useState(0);
  const action = useViewAction();
  const result = usePatientData<{ prescriptions: Prescription[] }>(`${ENDPOINT}/prescriptions`, revision);

  function updateRefill(rx: Prescription, cancel = false) {
    void action.run(async () => {
      await patientRequest(cancel ? `${ENDPOINT}/refills/${rx.refillRequestId}/cancel` : `${ENDPOINT}/refills`, {
        method: "POST",
        token: patientToken(),
        body: cancel ? { confirmed: true } : { lineId: rx.lineId },
      });
      setRevision(value => value + 1);
      return cancel ? "Refill request cancelled." : "Refill request sent for pharmacy review.";
    });
  }

  return (
    <div className="space-y-5">
      {/* Segmented Pill Switcher matching approved Medicines screen */}
      <nav
        aria-label="Medicines"
        className="inline-flex rounded-2xl border border-[#E5E0D4] bg-[#FFFDF9] p-1 shadow-xs"
      >
        {(
          [
            ["refill", "Refill"],
            ["prescriptions", "Prescriptions"],
          ] as const
        ).map(([route, label]) => {
          const active = view === route;
          return (
            <Link
              key={route}
              to={`/app/home/${route}`}
              aria-current={active ? "page" : undefined}
              className={`min-h-10 inline-flex items-center justify-center rounded-xl px-5 py-2 text-sm font-semibold transition-colors ${
                active
                  ? "bg-gradient-to-b from-[#047C61] to-[#026452] text-white shadow-xs"
                  : "text-[#182E29] hover:bg-[#F3EFE5]"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Preserves semantic exact-name section heading for Refill / Prescriptions */}
      <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-[#465953]">
        {view === "refill" ? "Refill" : "Prescriptions"}
      </h2>

      <ActionFeedback error={action.error} message={action.message} />
      <PortalLoaded result={result}>
        {({ prescriptions }) => {
          const rows =
            view === "refill"
              ? prescriptions.filter(({ dispensed }) => Boolean(dispensed))
              : prescriptions;

          return (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:items-start">
              {view === "refill" && (
                <div className="lg:col-span-5">
                  <div className="jvk-card-sage relative overflow-hidden p-5">
                    <img
                      src="/assets/patient/botanical-corner-leaf.png"
                      alt=""
                      aria-hidden="true"
                      width={86}
                      height={106}
                      style={{
                        WebkitMaskImage:
                          "radial-gradient(ellipse at 70% 80%, #000 35%, transparent 80%)",
                        maskImage:
                          "radial-gradient(ellipse at 70% 80%, #000 35%, transparent 80%)",
                      }}
                      className="pointer-events-none select-none mix-blend-multiply absolute -bottom-2 right-0 h-16 w-auto -scale-x-100 opacity-55"
                    />
                    <div className="relative z-10 flex items-start gap-3">
                      <Info
                        aria-hidden="true"
                        className="mt-0.5 size-5 shrink-0 text-[#047C61]"
                      />
                      <div className="space-y-1">
                        <p className="text-sm sm:text-base font-bold text-[#0E2420]">
                          Refills require clinician approval
                        </p>
                        <p className="text-xs sm:text-[13px] leading-relaxed text-[#465953]">
                          Request an approved refill here. Pharmacy staff review stock before placing a temporary hold.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className={view === "refill" ? "lg:col-span-7" : "lg:col-span-12"}>
                {rows.length ? (
                  <ul className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
                    {rows.map((rx) => (
                      <li
                        key={rx.lineId}
                        className="jvk-card p-5 space-y-2.5"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <span className="inline-flex size-9 items-center justify-center rounded-xl bg-[#E5F3EA] text-[#047C61]">
                              <Pill aria-hidden="true" className="size-4" />
                            </span>
                            <h3 className="text-base font-bold text-[#0E2420]">
                              {rx.medicine}
                            </h3>
                          </div>
                          <span
                            className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                              rx.dispensed
                                ? "border-[#CBE2D4] bg-[#E5F3EA] text-[#047C61]"
                                : "border-[#EAE2C6] bg-[#FBF1DA] text-[#6B4A00]"
                            }`}
                          >
                            {rx.dispensed ? "Dispensed" : "Signed"}
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm font-medium text-[#2F453E]">
                          {rx.units} units · Course through{" "}
                          {formatDate(rx.course_end)}
                        </p>
                        {rx.directions && (
                          <p className="rounded-xl bg-[#F7F4EC] px-3 py-2 text-xs sm:text-sm text-[#435650]">
                            {rx.directions}
                          </p>
                        )}
                        {view === "refill" && (
                          <div className="space-y-2">
                            {rx.refillStatus && (
                              <p className="text-xs font-semibold text-[#0E2420]">
                                {rx.refillStatus === "held" && rx.refillHeldUntil
                                  ? `Stock held until ${new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(rx.refillHeldUntil))} IST`
                                  : rx.refillStatus === "requested" ? "Awaiting pharmacy review" : "Request closed"}
                              </p>
                            )}
                            {rx.refillEligible === 1 && (
                              <Button type="button" disabled={action.pending} onClick={() => updateRefill(rx)}>
                                Request refill
                              </Button>
                            )}
                            {rx.refillRequestId && (rx.refillStatus === "requested" || rx.refillStatus === "held") && (
                              <Button type="button" variant="outline" disabled={action.pending} onClick={() => updateRefill(rx, true)}>
                                Cancel refill request
                              </Button>
                            )}
                            {!rx.refillStatus && !rx.refillEligible && (
                              <p className="text-xs text-[#465953]">Refill approval unavailable for this prescription.</p>
                            )}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="jvk-card p-7 sm:p-9 text-center space-y-3">
                    <img
                      src="/assets/patient/medicines-bottle.png"
                      alt=""
                      aria-hidden="true"
                      width={316}
                      height={160}
                      className="jvk-illustration-blend mx-auto h-36 w-auto select-none object-contain"
                    />
                    <div className="space-y-1 max-w-sm mx-auto">
                      <h3 className="text-lg font-bold text-[#0E2420]">
                        {view === "refill"
                          ? "No dispensing history"
                          : "No signed prescriptions"}
                      </h3>
                      <p className="text-sm text-[#4B5D57]">
                        Your linked pharmacy records will appear here as they
                        become available.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        }}
      </PortalLoaded>
    </div>
  );
}

const HER_NAV_ITEMS = [
  { route: "her", label: "HER Wellness", icon: Flower2 },
  { route: "vitalis", label: "Vitalis", icon: HeartPulse },
  { route: "yoga", label: "Gentle Yoga", icon: Sparkles },
  { route: "prakriti", label: "Prakriti & Agni", icon: Leaf },
] as const;

/** PAGE 05 — HER WELLNESS (#/app/home/her) */
export function HerView() {
  const action = useViewAction();
  const [revision, setRevision] = useState(0);
  const [urgent, setUrgent] = useState(false);
  const result = usePatientData<{
    consent: boolean;
    records: Array<{
      id: string;
      log_date: string;
      pelvic_pain: number;
      mood: string;
      tags: string[];
    }>;
    cycle: {
      lastStart: string | null;
      phase: string | null;
      status: string;
      irregular: boolean;
    } | null;
  }>(`${ENDPOINT}/her`, revision);

  function setConsent(granted: boolean) {
    void action.run(async () => {
      await patientRequest(`${ENDPOINT}/her/consent`, {
        method: "POST",
        body: { granted },
        token: patientToken(),
      });
      setRevision((value) => value + 1);
      return granted
        ? "Symptom tracking enabled."
        : "Symptom tracking consent withdrawn.";
    });
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void action.run(async () => {
      const response = await patientRequest<{ urgent: boolean }>(
        `${ENDPOINT}/her`,
        {
          method: "POST",
          body: {
            date: form.get("date"),
            flow: form.get("flow"),
            pain: Number(form.get("pain")),
            mood: form.get("mood"),
            periodStarted: form.has("periodStarted"),
            periodLength: form.get("periodLength")
              ? Number(form.get("periodLength"))
              : undefined,
          },
          token: patientToken(),
        },
      );
      setUrgent(response.urgent);
      setRevision((value) => value + 1);
      return "Symptom entry saved.";
    });
  }

  return (
    <div className="space-y-5">
      {/* Sub-navigation redesigned strictly within HER Wellness; destination pages remain unmodified */}
      <nav
        aria-label="More patient services"
        className="grid grid-cols-2 lg:grid-cols-4 gap-2.5"
      >
        {HER_NAV_ITEMS.map(({ route, label, icon: Icon }) => {
          const active = route === "her";
          return (
            <Link
              key={route}
              to={`/app/home/${route}`}
              aria-current={active ? "page" : undefined}
              className={`min-h-12 flex items-center justify-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition-colors ${
                active
                  ? "border-[#047C61] bg-gradient-to-b from-[#047C61] to-[#026452] text-white shadow-[0_6px_16px_rgba(4,124,97,0.2)]"
                  : "border-[#E4DFD3] bg-[#FFFDF9] text-[#182E29] hover:bg-[#F3EFE5]"
              }`}
            >
              <Icon
                aria-hidden="true"
                className={`size-4 shrink-0 ${active ? "text-white" : "text-[#047C61]"}`}
              />
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
      </nav>

      <ActionFeedback error={action.error} message={action.message} />
      {urgent && (
        <InlineBanner tone="critical" title="Seek urgent clinical care" />
      )}

      <PortalLoaded result={result}>
        {({ consent, records, cycle }) =>
          consent ? (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
              {/* Symptom Entry Form */}
              <form className="lg:col-span-7 space-y-3.5" onSubmit={save}>
                {cycle?.lastStart && (
                  <div className="jvk-card-sage p-4 sm:p-5 space-y-2">
                    <h2 className="text-base font-bold text-[#0E2420]">
                      Cycle history
                    </h2>
                    <p className="text-sm text-[#2F453E]">
                      Last logged start {formatDate(cycle.lastStart)}.
                    </p>
                    <p className="text-sm text-[#465953]">
                      {cycle.phase
                        ? `Estimated phase: ${cycle.phase}`
                        : "More cycle history is needed for a phase estimate."}
                    </p>
                    {cycle.irregular && (
                      <InlineBanner
                        tone="warning"
                        title="Cycle pattern changed"
                      />
                    )}
                  </div>
                )}

                <div className={questionCardStyle}>
                  <PastelIconBadge icon={Calendar} tone="mint" />
                  <label
                    className="flex-1 min-w-0 flex flex-col gap-1.5 text-sm font-bold text-[#0E2420]"
                    htmlFor="her-date"
                  >
                    <span>Entry date</span>
                    <Input
                      id="her-date"
                      type="date"
                      name="date"
                      max={todayIso()}
                      defaultValue={todayIso()}
                      required
                      className={inputFieldStyle}
                    />
                  </label>
                </div>

                <div className={questionCardStyle}>
                  <PastelIconBadge icon={Droplet} tone="amber" />
                  <label className={questionLabelStyle}>
                    <span>Flow</span>
                    <select name="flow" className={selectStyle}>
                      <option value="none">None</option>
                      <option value="light">Light</option>
                      <option value="medium">Medium</option>
                      <option value="heavy">Heavy</option>
                    </select>
                  </label>
                </div>

                <div className={questionCardStyle}>
                  <PastelIconBadge icon={Zap} tone="mint" />
                  <label
                    className="flex-1 min-w-0 flex flex-col gap-1.5 text-sm font-bold text-[#0E2420]"
                    htmlFor="her-pain"
                  >
                    <span>Pelvic pain (0–10)</span>
                    <Input
                      id="her-pain"
                      type="number"
                      min={0}
                      max={10}
                      name="pain"
                      required
                      className={inputFieldStyle}
                    />
                  </label>
                </div>

                <div className={questionCardStyle}>
                  <PastelIconBadge icon={Smile} tone="amber" />
                  <label
                    className="flex-1 min-w-0 flex flex-col gap-1.5 text-sm font-bold text-[#0E2420]"
                    htmlFor="her-mood"
                  >
                    <span>Mood</span>
                    <Input
                      id="her-mood"
                      name="mood"
                      maxLength={60}
                      className={inputFieldStyle}
                    />
                  </label>
                </div>

                <div className="jvk-card px-4 py-3 sm:px-5">
                  <label className="flex min-h-11 items-center gap-3 text-sm font-medium text-[#0E2420] cursor-pointer">
                    <input
                      type="checkbox"
                      name="periodStarted"
                      className="size-4 accent-[#047C61] rounded"
                    />
                    <span>A period started on this date</span>
                  </label>
                </div>

                <div className={questionCardStyle}>
                  <PastelIconBadge icon={CalendarRange} tone="mint" />
                  <label
                    className="flex-1 min-w-0 flex flex-col gap-1.5 text-sm font-bold text-[#0E2420]"
                    htmlFor="her-length"
                  >
                    <span>Period length in days, if known</span>
                    <Input
                      id="her-length"
                      type="number"
                      name="periodLength"
                      min={2}
                      max={10}
                      className={inputFieldStyle}
                    />
                  </label>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <Button
                    type="submit"
                    disabled={action.pending}
                    className="min-h-11 rounded-xl bg-gradient-to-b from-[#047C61] to-[#026452] hover:from-[#036B54] hover:to-[#025546] text-white font-semibold px-6 shadow-[0_6px_16px_rgba(4,124,97,0.2)]"
                  >
                    Save symptom entry
                  </Button>
                </div>
              </form>

              {/* Symptom Entry History / Calendar Empty State + Consent Control */}
              <div className="lg:col-span-5 space-y-4">
                {records.length ? (
                  <ul className="space-y-3">
                    {records.map((record) => (
                      <li key={record.id} className="jvk-card p-4 space-y-1.5">
                        <div className="flex items-center gap-2 text-xs font-semibold text-[#047C61]">
                          <Calendar aria-hidden="true" className="size-3.5" />
                          <time dateTime={record.log_date}>
                            {formatDate(record.log_date)}
                          </time>
                        </div>
                        <p className="text-sm font-medium text-[#0E2420]">
                          Flow: {record.tags[0] ?? "Unspecified"} · Pelvic pain{" "}
                          {record.pelvic_pain}/10
                          {record.mood ? ` · ${record.mood}` : ""}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="jvk-card-sage p-6 sm:p-7 text-center space-y-2.5">
                    <img
                      src="/assets/patient/her-calendar.png"
                      alt=""
                      aria-hidden="true"
                      width={210}
                      height={70}
                      className="jvk-illustration-blend mx-auto h-16 w-auto select-none object-contain"
                    />
                    <h2 className="text-base sm:text-lg font-bold text-[#0E2420]">
                      No symptom entries
                    </h2>
                    <p className="text-xs sm:text-sm text-[#4B5D57] leading-relaxed">
                      Entries you save will appear here.
                    </p>
                  </div>
                )}

                <Button
                  type="button"
                  variant="outline"
                  disabled={action.pending}
                  onClick={() => setConsent(false)}
                  className="min-h-11 w-full rounded-xl border-[#D5D0C3] bg-[#FFFDF9] text-sm font-semibold text-[#3B4E48] hover:bg-[#F3EFE5]"
                >
                  Withdraw tracking consent
                </Button>
              </div>
            </div>
          ) : (
            <div className="jvk-card-sage p-6 sm:p-8 text-center space-y-4">
              <img
                src="/assets/patient/her-calendar.png"
                alt=""
                aria-hidden="true"
                width={210}
                height={70}
                className="jvk-illustration-blend mx-auto h-16 w-auto select-none object-contain"
              />
              <EmptyState
                title="Enable symptom tracking"
                description="Choose whether to store flow, mood and pain entries in your patient account."
                action={
                  <Button
                    disabled={action.pending}
                    onClick={() => setConsent(true)}
                    className="min-h-11 rounded-xl bg-gradient-to-b from-[#047C61] to-[#026452] hover:from-[#036B54] hover:to-[#025546] text-white font-semibold px-6"
                  >
                    Allow symptom tracking
                  </Button>
                }
              />
            </div>
          )
        }
      </PortalLoaded>
    </div>
  );
}
