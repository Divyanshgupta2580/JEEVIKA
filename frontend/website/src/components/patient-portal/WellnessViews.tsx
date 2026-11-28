import { WellnessShareControls } from "./WellnessShareControls";
import { useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  Calendar,
  Eye,
  Flower2,
  HeartPulse,
  Leaf,
  ShieldAlert,
  Sparkles,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";
import { Button, Input } from "@/components/ui/basic";
import { EmptyState, InlineBanner } from "@/components/ui/design-primitives";
import { patientRequest, patientToken, usePatientData } from "@/lib/patientApi";
import { PortalLoaded } from "./PatientPortalViews";
import "@/design-system/her-wellness.css";

const ENDPOINT = "/home/companion";

const dateFmt = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeZone: "Asia/Kolkata",
});
const formatDate = (value: string) => dateFmt.format(new Date(value));

const selectStyle =
  "min-h-11 w-full rounded-xl border border-[#BBD8CC] bg-[#EDF7F1] pl-3.5 pr-4 py-2 text-[15px] font-medium text-[#0E2420] shadow-xs transition-colors focus:bg-white focus:border-[#047C61]";
const inputStyle =
  "h-11 rounded-xl border-[#D5D0C3] bg-white text-[#0E2420] focus-visible:border-[#047C61]";

export const WELLNESS_SERVICES = [
  {
    route: "her",
    label: "HER Wellness",
    description: "Track menstrual health, cycle symptoms, flow, and wellness notes.",
    icon: Flower2,
    tone: "mint" as const,
  },
  {
    route: "vitalis",
    label: "Vitalis",
    description: "Log resting heart rate, sleep duration, and activity observations.",
    icon: HeartPulse,
    tone: "amber" as const,
  },
  {
    route: "yoga",
    label: "Gentle Yoga",
    description: "Answer safety questions before viewing gentle movement options.",
    icon: Sparkles,
    tone: "mint" as const,
  },
  {
    route: "prakriti",
    label: "Prakriti & Agni",
    description: "View Ayurvedic constitution and Agni findings from your clinic visits.",
    icon: Leaf,
    tone: "amber" as const,
  },
] as const;

type WellnessRoute = (typeof WELLNESS_SERVICES)[number]["route"];

function SparkleIconBadge({
  icon: Icon,
  tone = "mint",
}: {
  icon: LucideIcon;
  tone?: "mint" | "amber";
}) {
  const palette =
    tone === "amber"
      ? "bg-[#FBF1DA] text-[#1D493D] border-[#EFE0B8]"
      : "bg-[#E5F3EA] text-[#047C61] border-[#CBE2D4]";

  return (
    <span className="relative inline-flex shrink-0">
      <svg
        aria-hidden="true"
        viewBox="0 0 24 20"
        fill="none"
        className="pointer-events-none absolute -top-2 -right-2 size-4 text-[#E5A736]"
      >
        <path
          d="M5 12L9 4M12 13L17 7M15 17L21 15"
          stroke="currentColor"
          strokeWidth="2.1"
          strokeLinecap="round"
        />
      </svg>
      <span
        aria-hidden="true"
        className={`inline-flex size-12 items-center justify-center rounded-2xl border ${palette}`}
      >
        <Icon className="size-5" strokeWidth={2} />
      </span>
    </span>
  );
}

function useWellnessAction() {
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

/** Shared 2x2 wellness service switcher highlighting the active destination in deep teal + gold accent. */
export function WellnessSubNav({ current }: { current: WellnessRoute }) {
  return (
    <nav
      aria-label="More patient services"
      className="mb-5 grid grid-cols-2 gap-2.5 sm:gap-3"
    >
      {WELLNESS_SERVICES.map(({ route, label, icon: Icon }) => {
        const active = route === current;
        return (
          <Link
            key={route}
            to={`/app/home/${route}`}
            aria-current={active ? "page" : undefined}
            className={`relative overflow-hidden min-h-12 flex items-center justify-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs sm:text-sm font-semibold transition-colors ${
              active
                ? "border-[#047C61] bg-gradient-to-b from-[#047C61] to-[#025D4B] text-white shadow-[0_6px_16px_rgba(4,124,97,0.22)]"
                : "border-[#E4DFD3] bg-[#FFFDF9] text-[#182E29] shadow-[0_2px_8px_rgba(14,36,32,0.03)] hover:bg-[#F3EFE5]"
            }`}
          >
            <Icon
              aria-hidden="true"
              className={`size-4 shrink-0 ${active ? "text-white" : "text-[#047C61]"}`}
            />
            <span className="truncate">{label}</span>
            {active && (
              <svg
                aria-hidden="true"
                viewBox="0 0 180 10"
                fill="none"
                preserveAspectRatio="none"
                className="pointer-events-none absolute inset-x-0 bottom-0 h-2 w-full"
              >
                <path
                  d="M4 9C52 3 118 4 176 8.5L180 10H0L4 9Z"
                  fill="#E5A736"
                  fillOpacity="0.88"
                />
              </svg>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

/** MORE SERVICES HUB (#/app/home/more) */
export function MoreView() {
  return (
    <div className="jvk-her-wellness space-y-5">
      <nav
        aria-label="More patient services"
        className="grid grid-cols-1 sm:grid-cols-2 gap-4"
      >
        {WELLNESS_SERVICES.map(({ route, label, description, icon, tone }, index) => (
          <Link
            key={route}
            to={`/app/home/${route}`}
            aria-label={label}
            data-jvk-reveal={index}
            className={`jvk-motion-card jvk-motion-card-shadow group flex items-start gap-4 p-5 sm:p-6 ${
              tone === "mint" ? "jvk-her-field-sage" : "jvk-her-field-gold"
            }`}
          >
            <SparkleIconBadge icon={icon} tone={tone} />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base sm:text-lg font-bold text-[#0E2420] group-hover:text-[#047C61] transition-colors">
                  {label}
                </h2>
                <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-[#D4E3DA] bg-[#EEF8F3] text-[#047C61] group-hover:bg-[#047C61] group-hover:text-white transition-colors">
                  <ArrowRight aria-hidden="true" className="jvk-motion-arrow size-4" />
                </span>
              </div>
              <p className="text-xs sm:text-[13.5px] leading-relaxed text-[#4B5D57]">
                {description}
              </p>
            </div>
          </Link>
        ))}
      </nav>
    </div>
  );
}

/** VITALIS (#/app/home/vitalis) */
export function VitalisView() {
  const [revision, setRevision] = useState(0);
  const action = useWellnessAction();
  const result = usePatientData<{
    consent: boolean;
    observations: Array<{
      id: string;
      metric_name: string;
      value_numeric: number;
      unit: string;
      observed_start_utc: string;
      source_type: string;
    }>;
    index: { status: string; score: number | null; coverage: number } | null;
  }>(`${ENDPOINT}/vitalis`, revision);

  function setConsent(granted: boolean) {
    void action.run(async () => {
      await patientRequest(`${ENDPOINT}/vitalis/consent`, {
        method: "POST",
        body: { granted },
        token: patientToken(),
      });
      setRevision((value) => value + 1);
      return granted
        ? "Vitalis tracking enabled."
        : "Vitalis tracking consent withdrawn.";
    });
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void action.run(async () => {
      await patientRequest(`${ENDPOINT}/vitalis`, {
        method: "POST",
        body: { metric: form.get("metric"), value: Number(form.get("value")) },
        token: patientToken(),
      });
      setRevision((value) => value + 1);
      return "Observation saved.";
    });
  }

  return (
    <div className="jvk-her-wellness space-y-5">
      <WellnessSubNav current="vitalis" />
      {action.error && <InlineBanner tone="critical" title={action.error} />}
      {action.message && <InlineBanner tone="success" title={action.message} />}

      <PortalLoaded result={result}>
        {({ consent, observations, index }) =>
          consent ? (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
              <div className="lg:col-span-7 space-y-4">
                <div className="jvk-her-field-sage p-5 flex items-start gap-3.5">
                  <SparkleIconBadge icon={HeartPulse} tone="mint" />
                  <div className="space-y-1">
                    <h2 className="text-base font-bold text-[#0E2420]">
                      Healthspan progress
                    </h2>
                    <p className="text-xs sm:text-[13.5px] leading-relaxed text-[#465953]">
                      {index?.score === null || index?.score === undefined
                        ? "There are not enough verified observations for a score."
                        : `Index ${index.score}. Verified coverage ${Math.round(index.coverage * 100)}%.`}
                    </p>
                  </div>
                </div>

                <form className="space-y-3.5" onSubmit={save}>
                  <div className="jvk-her-field-sage p-4 sm:p-4.5 flex items-start gap-3.5 sm:gap-4">
                    <SparkleIconBadge icon={Activity} tone="mint" />
                    <label className="flex-1 min-w-0 flex flex-col gap-1.5 text-sm font-bold text-[#0E2420]">
                      <span>Observation</span>
                      <select className={selectStyle} name="metric" required>
                        <option value="resting_heart_rate">
                          Resting heart rate (bpm)
                        </option>
                        <option value="sleep_duration">
                          Sleep duration (hours)
                        </option>
                        <option value="activity_minutes">
                          Activity (minutes)
                        </option>
                      </select>
                    </label>
                  </div>

                  <div className="jvk-her-field-gold p-4 sm:p-4.5 flex items-start gap-3.5 sm:gap-4">
                    <SparkleIconBadge icon={HeartPulse} tone="amber" />
                    <label
                      className="flex-1 min-w-0 flex flex-col gap-1.5 text-sm font-bold text-[#0E2420]"
                      htmlFor="vitalis-value"
                    >
                      <span>Value</span>
                      <Input
                        id="vitalis-value"
                        name="value"
                        type="number"
                        min={0}
                        max={1440}
                        step="any"
                        required
                        className={inputStyle}
                      />
                    </label>
                  </div>

                  <Button
                    type="submit"
                    disabled={action.pending}
                    className="min-h-11 w-full sm:w-auto rounded-xl bg-gradient-to-b from-[#047C61] to-[#026452] hover:from-[#036B54] hover:to-[#025546] text-white font-semibold px-7 shadow-[0_6px_18px_rgba(4,124,97,0.22)]"
                  >
                    {action.pending ? "Saving…" : "Save observation"}
                  </Button>
                </form>
              </div>

              <div className="lg:col-span-5 space-y-4">
                {observations.length ? (
                  <ul className="space-y-3">
                    {observations.map((row) => (
                      <li
                        key={row.id}
                        className="jvk-her-field-gold p-4 space-y-1.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-sm sm:text-base font-bold text-[#0E2420]">
                            {row.metric_name}
                          </h3>
                          {row.source_type === "patient_reported" && (
                            <span className="rounded-full border border-[#CBE2D4] bg-[#E5F3EA] px-2.5 py-0.5 text-xs font-semibold text-[#047C61]">
                              Patient reported
                            </span>
                          )}
                        </div>
                        <p className="text-xs sm:text-sm font-medium text-[#2F453E]">
                          {row.value_numeric} {row.unit} ·{" "}
                          {formatDate(row.observed_start_utc)}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="jvk-her-empty-card p-6 sm:p-7 text-center space-y-2.5">
                    <SparkleIconBadge icon={HeartPulse} tone="mint" />
                    <h2 className="text-base sm:text-lg font-bold text-[#0E2420]">
                      No Vitalis observations
                    </h2>
                    <p className="text-xs sm:text-[13px] text-[#4B5D57] leading-relaxed">
                      Recorded observations appear here.
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
                  Withdraw Vitalis consent
                </Button>
              </div>
            </div>
          ) : (
            <div className="jvk-her-empty-card p-6 sm:p-8 text-center space-y-4">
              <div className="mx-auto flex justify-center">
                <SparkleIconBadge icon={HeartPulse} tone="mint" />
              </div>
              <EmptyState
                title="Enable Vitalis tracking"
                description="Choose whether to store your sleep, activity and heart-rate observations."
                action={
                  <Button
                    disabled={action.pending}
                    onClick={() => setConsent(true)}
                    className="min-h-11 rounded-xl bg-gradient-to-b from-[#047C61] to-[#026452] hover:from-[#036B54] hover:to-[#025546] text-white font-semibold px-6"
                  >
                    Allow Vitalis tracking
                  </Button>
                }
              />
            </div>
          )
        }
      </PortalLoaded>
      {result.data?.consent && <WellnessShareControls kind="vitalis" consent={result.data.consent} />}
    </div>
  );
}

const YOGA_SCREENING_QUESTIONS = [
  {
    field: "cardiovascularRestriction",
    label: "High blood pressure or a heart condition?",
    icon: HeartPulse,
    tone: "amber" as const,
  },
  {
    field: "eyePressureRestriction",
    label: "Glaucoma or an eye pressure restriction?",
    icon: Eye,
    tone: "mint" as const,
  },
  {
    field: "spineRestriction",
    label: "A current spinal disc problem?",
    icon: Activity,
    tone: "mint" as const,
  },
  {
    field: "acuteSymptoms",
    label: "Acute symptoms or advice to avoid exercise?",
    icon: ShieldAlert,
    tone: "amber" as const,
  },
] as const;

/** GENTLE YOGA (#/app/home/yoga) */
export function YogaView() {
  const [result, setResult] = useState<{
    restricted: boolean;
    items: Array<{
      id: string;
      title: string;
      description: string;
      disclaimer?: string;
    }>;
  }>();
  const action = useWellnessAction();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const fields = YOGA_SCREENING_QUESTIONS.map((q) => q.field);
    setResult(undefined);
    void action.run(async () => {
      const response = await patientRequest<NonNullable<typeof result>>(
        `${ENDPOINT}/yoga`,
        {
          method: "POST",
          body: Object.fromEntries(
            fields.map((field) => [field, form.get(field) !== "no"]),
          ),
          token: patientToken(),
        },
      );
      setResult(response);
      return "";
    });
  }

  return (
    <div className="jvk-her-wellness space-y-5">
      <WellnessSubNav current="yoga" />

      <div className="jvk-her-field-sage p-4 sm:p-5 flex items-center gap-3.5">
        <SparkleIconBadge icon={Sparkles} tone="mint" />
        <p className="text-sm font-medium text-[#182E29]">
          Answer these questions before viewing gentle movement options.
        </p>
      </div>

      <form className="space-y-4" onSubmit={submit}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
          {YOGA_SCREENING_QUESTIONS.map(({ field, label, icon, tone }) => (
            <div
              key={field}
              className={`${tone === "amber" ? "jvk-her-field-gold" : "jvk-her-field-sage"} p-4 sm:p-4.5 flex items-start gap-3.5`}
            >
              <SparkleIconBadge icon={icon} tone={tone} />
              <label className="flex-1 min-w-0 flex flex-col gap-1.5 text-sm font-bold text-[#0E2420]">
                <span>{label}</span>
                <select
                  name={field}
                  required
                  defaultValue=""
                  className={selectStyle}
                >
                  <option value="" disabled hidden>
                    Select
                  </option>
                  <option value="yes">Yes or unsure</option>
                  <option value="no">No</option>
                </select>
              </label>
            </div>
          ))}
        </div>

        <Button
          type="submit"
          disabled={action.pending}
          className="min-h-11 w-full sm:w-auto rounded-xl bg-gradient-to-b from-[#047C61] to-[#026452] hover:from-[#036B54] hover:to-[#025546] text-white font-semibold px-7 shadow-[0_6px_18px_rgba(4,124,97,0.22)]"
        >
          {action.pending ? "Checking…" : "Review movement options"}
        </Button>
      </form>

      {action.error && <InlineBanner tone="critical" title={action.error} />}
      {action.message && <InlineBanner tone="success" title={action.message} />}

      {result?.restricted && (
        <InlineBanner
          tone="warning"
          title="Check with your care team before starting"
        />
      )}

      {result &&
        !result.restricted &&
        (result.items.length ? (
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {result.items.map((item) => (
              <li
                key={item.id}
                className="jvk-her-field-sage p-5 space-y-2"
              >
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex size-8 items-center justify-center rounded-xl bg-[#E5F3EA] text-[#047C61]">
                    <Sparkles aria-hidden="true" className="size-4" />
                  </span>
                  <h2 className="text-base font-bold text-[#0E2420]">
                    {item.title}
                  </h2>
                </div>
                <p className="text-sm leading-relaxed text-[#2F453E]">
                  {item.description}
                </p>
                {item.disclaimer && (
                  <p className="rounded-xl bg-[#FBF1DA]/65 px-3 py-2 text-xs font-medium text-[#5B4510]">
                    {item.disclaimer}
                  </p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div className="jvk-her-empty-card p-6 sm:p-7 text-center">
            <EmptyState
              title="No options available"
              description="Ask your practitioner about exercises suited to you."
            />
          </div>
        ))}
    </div>
  );
}

/** PRAKRITI & AGNI (#/app/home/prakriti) */
export function PrakritiView() {
  const result = usePatientData<{
    assessment: {
      agni: string;
      prakriti: string;
      dosha: Record<string, number | null> | null;
      updated_at: string;
    } | null;
  }>(`${ENDPOINT}/prakriti`);

  return (
    <div className="jvk-her-wellness space-y-5">
      <WellnessSubNav current="prakriti" />

      <PortalLoaded result={result}>
        {({ assessment }) =>
          assessment ? (
            <div className="jvk-her-field-sage p-5 sm:p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#DCE6DD] pb-4">
                <div className="flex items-center gap-3">
                  <SparkleIconBadge icon={Stethoscope} tone="mint" />
                  <div>
                    <span className="inline-flex items-center rounded-full border border-[#CBE2D4] bg-[#E5F3EA] px-3 py-1 text-xs font-semibold text-[#047C61]">
                      Practitioner assessment
                    </span>
                    <div className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-[#4B5D57]">
                      <Calendar aria-hidden="true" className="size-3.5" />
                      <time dateTime={assessment.updated_at}>
                        {formatDate(assessment.updated_at)}
                      </time>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {assessment.prakriti && (
                  <div className="rounded-xl border border-[#EAE6DC] bg-white/80 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#53655F]">
                      Prakriti
                    </p>
                    <p className="mt-1 text-base font-bold text-[#0E2420]">
                      {assessment.prakriti}
                    </p>
                  </div>
                )}
                {assessment.agni && (
                  <div className="rounded-xl border border-[#EAE6DC] bg-white/80 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#53655F]">
                      Agni
                    </p>
                    <p className="mt-1 text-base font-bold text-[#0E2420]">
                      Agni: {assessment.agni}
                    </p>
                  </div>
                )}
              </div>

              {assessment.dosha && (
                <ul className="flex flex-wrap gap-2.5 pt-1">
                  {Object.entries(assessment.dosha)
                    .filter(([, value]) => value !== null)
                    .map(([name, value]) => (
                      <li
                        key={name}
                        className="capitalize rounded-xl border border-[#CBE2D4] bg-[#EEF8F3] px-3.5 py-2 text-sm font-semibold text-[#0E3F33]"
                      >
                        {name}: {value}
                      </li>
                    ))}
                </ul>
              )}
            </div>
          ) : (
            <div className="jvk-her-empty-card relative overflow-hidden p-7 sm:p-9 text-center space-y-3">
              <img
                src="/assets/patient/botanical-corner-leaf.png"
                alt=""
                aria-hidden="true"
                width={86}
                height={106}
                className="pointer-events-none select-none mix-blend-multiply absolute -bottom-2 -left-1 h-16 w-auto opacity-30"
              />
              <img
                src="/assets/patient/botanical-corner-leaf.png"
                alt=""
                aria-hidden="true"
                width={86}
                height={106}
                className="pointer-events-none select-none mix-blend-multiply absolute -bottom-2 -right-1 h-16 w-auto -scale-x-100 opacity-30"
              />
              <div className="relative z-10 space-y-2.5">
                <div className="mx-auto flex justify-center">
                  <SparkleIconBadge icon={Leaf} tone="mint" />
                </div>
                <h2 className="text-lg font-bold text-[#0E2420]">
                  No practitioner assessment
                </h2>
                <p className="text-sm text-[#4B5D57] max-w-md mx-auto">
                  Prakriti and Agni findings from an eligible AYUSH encounter
                  will appear here.
                </p>
              </div>
            </div>
          )
        }
      </PortalLoaded>
    </div>
  );
}
