import { useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  Calendar,
  CalendarCheck,
  CalendarRange,
  Droplet,
  Ellipsis,
  Flower2,
  HeartPulse,
  Leaf,
  LogOut,
  Pill,
  ScrollText,
  Smile,
  Sparkles,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Button, Input } from "@/components/ui/basic";
import { EmptyState, InlineBanner } from "@/components/ui/design-primitives";
import { patientRequest, patientToken, usePatientData } from "@/lib/patientApi";
import "@/design-system/her-wellness.css";

const ENDPOINT = "/home/companion";

const NAV_TABS = [
  { label: "Thread", paths: ["thread"], icon: ScrollText },
  { label: "Check-In", paths: ["check-in"], icon: CalendarCheck },
  { label: "Drift", paths: ["drift"], icon: Activity },
  { label: "Medicines", paths: ["refill", "prescriptions"], icon: Pill },
  { label: "More", paths: ["more", "her", "vitalis", "yoga", "prakriti"], icon: Ellipsis },
] as const;

const WELLNESS_TABS = [
  { route: "her", label: "HER Wellness", icon: Flower2 },
  { route: "vitalis", label: "Vitalis", icon: HeartPulse },
  { route: "yoga", label: "Gentle Yoga", icon: Sparkles },
  { route: "prakriti", label: "Prakriti & Agni", icon: Leaf },
] as const;

const dateFmt = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeZone: "Asia/Kolkata",
});
const formatDate = (value: string) => dateFmt.format(new Date(value));
const todayIso = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(
    new Date(),
  );

function GoldUnderline({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 220 16"
      fill="none"
      preserveAspectRatio="none"
      className={className}
    >
      <path
        d="M4 11.5C64 4.2 146 3.5 216 9.5C154 10.6 74 11.6 4 11.5Z"
        fill="#E5A736"
      />
    </svg>
  );
}

/** Pastel icon badge with subtle golden radial sparkle accents matching approved HER cards. */
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

/** HER Wellness exclusive page (#/app/home/her) matching the approved visual reference. */
export function HerWellnessPage({
  headingRef,
  signout,
  signoutError,
  onLogout,
}: {
  headingRef: React.RefObject<HTMLHeadingElement>;
  signout: boolean;
  signoutError: string;
  onLogout: () => void;
}) {
  const [revision, setRevision] = useState(0);
  const [urgent, setUrgent] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const busy = useRef(false);

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

  async function runAction(action: () => Promise<string>) {
    if (busy.current) return;
    busy.current = true;
    setActionError("");
    setMessage("");
    setPending(true);
    try {
      setMessage(await action());
    } catch (failure) {
      setActionError(
        failure instanceof Error
          ? failure.message
          : "Unable to save. Try again.",
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  function setConsent(granted: boolean) {
    void runAction(async () => {
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
    void runAction(async () => {
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
    <div className="jvk-her-wellness relative min-h-dvh flex flex-col justify-between overflow-x-clip bg-[#FEFBF6] text-[#0E2420] pb-20 md:pb-0">
      <button
        type="button"
        onClick={() => document.getElementById("patient-main")?.focus()}
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-xl focus:bg-[#047C61] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg"
      >
        Skip to patient content
      </button>

      {/* Top Header: Original JEEVIKA Logo (upper left) + Sign out (upper right) */}
      <header className="sticky top-0 z-30 border-b border-[#EAE6DC] bg-[#FEFBF6]">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link
              to="/app/home/thread"
              aria-label="JEEVIKA Health Thread"
              className="inline-flex min-h-11 items-center rounded-lg px-0.5 transition-transform hover:scale-[1.02]"
            >
              <img
                src="/assets/logo-jeevika.png"
                alt="JEEVIKA"
                width={108}
                height={36}
                className="h-8 w-auto object-contain"
              />
            </Link>
            <span
              aria-hidden="true"
              className="hidden xl:inline-block h-5 w-px bg-[#DFDCD0]"
            />
            <span className="hidden xl:inline-block text-xs font-semibold tracking-wide text-[#51645E]">
              Patient Care Portal
            </span>
          </div>

          <button
            type="button"
            disabled={signout}
            onClick={onLogout}
            className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl border border-[#CBE0D5] bg-[#EEF8F3] px-3.5 py-2 text-xs sm:text-[13px] font-semibold text-[#11312B] shadow-[0_1px_2px_rgba(14,36,32,0.04)] transition-colors hover:bg-[#E1F3EA] disabled:opacity-60 cursor-pointer"
          >
            <LogOut aria-hidden="true" className="size-3.5 text-[#047C61]" />
            <span>{signout ? "Signing out…" : "Sign out"}</span>
          </button>
        </div>
      </header>

      <main
        id="patient-main"
        tabIndex={-1}
        className="relative z-10 mx-auto w-full max-w-6xl flex-1 px-4 pt-4 pb-8 sm:px-6 lg:px-8 lg:pt-6 focus:outline-none"
      >
        {/* Hero Banner */}
        <section className="relative mb-5 overflow-hidden rounded-2xl border border-[#EAE6DC]/75 bg-gradient-to-r from-[#FFFDF9] via-[#FEFBF6] to-[#F9F5EB] px-5 py-5 sm:px-7 sm:py-6">
          <img
            src="/assets/patient/rural-landscape-banner.png"
            alt=""
            aria-hidden="true"
            width={246}
            height={186}
            className="jvk-her-landscape pointer-events-none select-none absolute -top-1 -right-4 sm:right-0 h-32 sm:h-44 lg:h-48 w-auto opacity-80 sm:opacity-95"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 w-4/5 bg-gradient-to-r from-[#FFFDF9] via-[#FEFBF6]/95 to-transparent sm:w-3/5"
          />
          <div className="relative z-10 max-w-xs sm:max-w-md lg:max-w-xl space-y-2 pr-14 sm:pr-44 lg:pr-56">
            <h1
              ref={headingRef}
              tabIndex={-1}
              className="jvk-her-serif font-bold tracking-tight text-[#0E2420] leading-[1.12] focus:outline-none"
              style={{ fontSize: "clamp(1.8rem, 3vw, 2.55rem)" }}
            >
              HER{" "}
              <span className="relative inline-block jvk-her-italic pr-1">
                Wellness
                <GoldUnderline className="absolute -bottom-1 left-0 h-2 w-full" />
              </span>
            </h1>
            <p className="text-[12.5px] sm:text-sm leading-relaxed text-[#465953]">
              A supportive space to track your menstrual health, cycle symptoms,
              and overall wellness.
            </p>
          </div>
        </section>

        {signoutError && <InlineBanner tone="critical" title={signoutError} />}

        {/* 2x2 Wellness Sub-Navigation Grid */}
        <nav
          aria-label="More patient services"
          className="mb-5 grid grid-cols-2 gap-2.5 sm:gap-3"
        >
          {WELLNESS_TABS.map(({ route, label, icon: Icon }) => {
            const active = route === "her";
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

        <div className="space-y-4 mb-4">
          {actionError && <InlineBanner tone="critical" title={actionError} />}
          {message && <InlineBanner tone="success" title={message} />}
          {urgent && (
            <InlineBanner tone="critical" title="Seek urgent clinical care" />
          )}
        </div>

        {/* Data Loading / Error / Consent Gate / Symptom Form + History */}
        {result.error ? (
          <InlineBanner tone="critical" title={result.error} />
        ) : !result.data ? (
          <div className="jvk-her-field-sage p-6 text-center">
            <p role="status" className="text-sm font-medium text-[#465953]">
              Loading your records…
            </p>
          </div>
        ) : result.data.consent ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
            {/* Symptom Entry Form */}
            <form className="lg:col-span-7 space-y-3.5" onSubmit={save}>
              {result.data.cycle?.lastStart && (
                <div className="jvk-her-field-sage p-4 sm:p-5 space-y-2">
                  <h2 className="text-base font-bold text-[#0E2420]">
                    Cycle history
                  </h2>
                  <p className="text-sm text-[#2F453E]">
                    Last logged start {formatDate(result.data.cycle.lastStart)}.
                  </p>
                  <p className="text-sm text-[#465953]">
                    {result.data.cycle.phase
                      ? `Estimated phase: ${result.data.cycle.phase}`
                      : "More cycle history is needed for a phase estimate."}
                  </p>
                  {result.data.cycle.irregular && (
                    <InlineBanner
                      tone="warning"
                      title="Cycle pattern changed"
                    />
                  )}
                </div>
              )}

              {/* 1. Entry date */}
              <div className="jvk-her-field-gold p-4 sm:p-4.5 flex items-start gap-3.5 sm:gap-4">
                <SparkleIconBadge icon={Calendar} tone="mint" />
                <label
                  htmlFor="her-date"
                  className="flex-1 min-w-0 flex flex-col gap-1.5 text-sm font-bold text-[#0E2420]"
                >
                  <span>Entry date</span>
                  <Input
                    id="her-date"
                    type="date"
                    name="date"
                    max={todayIso()}
                    defaultValue={todayIso()}
                    required
                    className="h-11 rounded-xl border-[#D5D0C3] bg-white text-[#0E2420] focus-visible:border-[#047C61]"
                  />
                </label>
              </div>

              {/* 2. Flow */}
              <div className="jvk-her-field-sage p-4 sm:p-4.5 flex items-start gap-3.5 sm:gap-4">
                <SparkleIconBadge icon={Droplet} tone="amber" />
                <label className="flex-1 min-w-0 flex flex-col gap-1.5 text-sm font-bold text-[#0E2420]">
                  <span>Flow</span>
                  <select
                    name="flow"
                    className="min-h-11 w-full rounded-xl border border-[#BBD8CC] bg-[#EDF7F1] pl-3.5 pr-4 py-2 text-[15px] font-medium text-[#0E2420] shadow-xs transition-colors focus:bg-white focus:border-[#047C61]"
                  >
                    <option value="none">None</option>
                    <option value="light">Light</option>
                    <option value="medium">Medium</option>
                    <option value="heavy">Heavy</option>
                  </select>
                </label>
              </div>

              {/* 3. Pelvic pain (0-10) */}
              <div className="jvk-her-field-sage p-4 sm:p-4.5 flex items-start gap-3.5 sm:gap-4">
                <SparkleIconBadge icon={Zap} tone="mint" />
                <label
                  htmlFor="her-pain"
                  className="flex-1 min-w-0 flex flex-col gap-1.5 text-sm font-bold text-[#0E2420]"
                >
                  <span>Pelvic pain (0–10)</span>
                  <Input
                    id="her-pain"
                    type="number"
                    min={0}
                    max={10}
                    name="pain"
                    required
                    className="h-11 rounded-xl border-[#D5D0C3] bg-white text-[#0E2420] focus-visible:border-[#047C61]"
                  />
                </label>
              </div>

              {/* 4. Mood */}
              <div className="jvk-her-field-gold p-4 sm:p-4.5 flex items-start gap-3.5 sm:gap-4">
                <SparkleIconBadge icon={Smile} tone="amber" />
                <label
                  htmlFor="her-mood"
                  className="flex-1 min-w-0 flex flex-col gap-1.5 text-sm font-bold text-[#0E2420]"
                >
                  <span>Mood</span>
                  <Input
                    id="her-mood"
                    name="mood"
                    maxLength={60}
                    className="h-11 rounded-xl border-[#D5D0C3] bg-white text-[#0E2420] focus-visible:border-[#047C61]"
                  />
                </label>
              </div>

              {/* 5. A period started on this date */}
              <div className="jvk-her-field-gold p-3.5 sm:p-4 flex items-center gap-3.5 sm:gap-4">
                <SparkleIconBadge icon={CalendarCheck} tone="amber" />
                <label className="flex-1 min-h-11 flex items-center gap-3 text-sm font-semibold text-[#0E2420] cursor-pointer">
                  <input
                    type="checkbox"
                    name="periodStarted"
                    className="size-4.5 accent-[#047C61] rounded border-[#C8C1B2]"
                  />
                  <span>A period started on this date</span>
                </label>
              </div>

              {/* 6. Period length in days, if known */}
              <div className="jvk-her-field-sage p-4 sm:p-4.5 flex items-start gap-3.5 sm:gap-4">
                <SparkleIconBadge icon={CalendarRange} tone="mint" />
                <label
                  htmlFor="her-length"
                  className="flex-1 min-w-0 flex flex-col gap-1.5 text-sm font-bold text-[#0E2420]"
                >
                  <span>Period length in days, if known</span>
                  <Input
                    id="her-length"
                    type="number"
                    name="periodLength"
                    min={2}
                    max={10}
                    className="h-11 rounded-xl border-[#D5D0C3] bg-white text-[#0E2420] focus-visible:border-[#047C61]"
                  />
                </label>
              </div>

              <div className="pt-1">
                <Button
                  type="submit"
                  disabled={pending}
                  className="min-h-11 w-full sm:w-auto rounded-xl bg-gradient-to-b from-[#047C61] to-[#026452] hover:from-[#036B54] hover:to-[#025546] text-white font-semibold px-7 shadow-[0_6px_18px_rgba(4,124,97,0.22)]"
                >
                  {pending ? "Saving…" : "Save symptom entry"}
                </Button>
              </div>
            </form>

            {/* Symptom History / Illustrated Empty State + Consent Toggle */}
            <div className="lg:col-span-5 space-y-4">
              {result.data.records.length ? (
                <ul className="space-y-3">
                  {result.data.records.map((record) => (
                    <li
                      key={record.id}
                      className="jvk-her-field-sage p-4 space-y-1.5"
                    >
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
                <div className="jvk-her-empty-card relative overflow-hidden p-6 sm:p-7 text-center space-y-3">
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
                    <img
                      src="/assets/patient/her-calendar.png"
                      alt=""
                      aria-hidden="true"
                      width={210}
                      height={70}
                      className="jvk-her-art-blend mx-auto h-16 w-auto select-none object-contain"
                    />
                    <h2 className="text-lg font-bold text-[#0E2420]">
                      No symptom entries
                    </h2>
                    <p className="text-xs sm:text-[13px] text-[#4B5D57] leading-relaxed max-w-xs mx-auto">
                      Your symptom entries will appear here once you add them.
                      Start tracking to understand your wellness better.
                    </p>
                  </div>
                </div>
              )}

              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => setConsent(false)}
                className="min-h-11 w-full rounded-xl border-[#D5D0C3] bg-[#FFFDF9] text-sm font-semibold text-[#3B4E48] hover:bg-[#F3EFE5]"
              >
                Withdraw tracking consent
              </Button>
            </div>
          </div>
        ) : (
          <div className="jvk-her-empty-card p-6 sm:p-8 text-center space-y-4">
            <img
              src="/assets/patient/her-calendar.png"
              alt=""
              aria-hidden="true"
              width={210}
              height={70}
              className="jvk-her-art-blend mx-auto h-16 w-auto select-none object-contain"
            />
            <EmptyState
              title="Enable symptom tracking"
              description="Choose whether to store flow, mood and pain entries in your patient account."
              action={
                <Button
                  disabled={pending}
                  onClick={() => setConsent(true)}
                  className="min-h-11 rounded-xl bg-gradient-to-b from-[#047C61] to-[#026452] hover:from-[#036B54] hover:to-[#025546] text-white font-semibold px-6"
                >
                  Allow symptom tracking
                </Button>
              }
            />
          </div>
        )}
      </main>

      {/* Decorative Green & Gold Curved Wave + Botanical Leaf */}
      <div
        aria-hidden="true"
        className="pointer-events-none relative z-0 mt-auto w-full overflow-hidden leading-none"
      >
        <img
          src="/assets/patient/botanical-corner-leaf.png"
          alt=""
          width={86}
          height={106}
          style={{
            WebkitMaskImage:
              "radial-gradient(ellipse at 25% 78%, #000 30%, transparent 72%)",
            maskImage:
              "radial-gradient(ellipse at 25% 78%, #000 30%, transparent 72%)",
          }}
          className="select-none mix-blend-multiply absolute -bottom-1 -left-1 h-16 sm:h-20 w-auto opacity-95"
        />
        <svg
          viewBox="0 0 1440 42"
          fill="none"
          preserveAspectRatio="none"
          className="block h-7 w-full sm:h-9"
        >
          <path
            d="M0 18C260 32 540 30 880 18C1150 9 1310 5 1440 15V42H0V18Z"
            fill="#E5A736"
            fillOpacity="0.45"
          />
          <path
            d="M0 24C300 8 590 32 940 25C1190 20 1330 11 1440 19V42H0V24Z"
            fill="#026E5E"
          />
        </svg>
      </div>

      {/* Patient Home Bottom / Top Navigation scoped to HER Wellness */}
      <nav
        aria-label="Patient home navigation"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-[#E6E0D2] bg-[#FFFDF9] px-1.5 pt-1 pb-[calc(0.25rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(14,36,32,0.06)] md:inset-x-auto md:top-2.5 md:bottom-auto md:left-1/2 md:-translate-x-1/2 md:flex md:items-center md:gap-1 md:border-t-0 md:bg-transparent md:p-0 md:shadow-none"
      >
        {NAV_TABS.map(({ label, paths, icon: Icon }) => {
          const active = paths.some((path) => path === "her");
          return (
            <Link
              key={label}
              to={`/app/home/${paths[0]}`}
              aria-current={active ? "page" : undefined}
              className={`relative flex min-h-14 md:min-h-10 min-w-0 flex-col md:flex-row items-center justify-center gap-1 md:gap-1.5 rounded-xl px-1.5 md:px-2.5 lg:px-3.5 py-1.5 text-[11px] md:text-[12.5px] lg:text-[13px] font-semibold transition-colors ${
                active
                  ? "bg-[#E5F3EA] text-[#047C61]"
                  : "text-[#4B5D57] hover:bg-[#F3EFE5] hover:text-[#0E2420]"
              }`}
            >
              <Icon size={18} aria-hidden="true" className="shrink-0" />
              <span className="truncate">{label}</span>
              {active && (
                <span
                  aria-hidden="true"
                  className="absolute bottom-1 left-1/2 -translate-x-1/2 h-0.5 w-6 rounded-full bg-[#047C61] md:bottom-0.5 md:w-8"
                />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
