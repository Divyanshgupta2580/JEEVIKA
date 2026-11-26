import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { z } from "zod";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CalendarCheck,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  Info,
  Pencil,
  PhoneCall,
  Printer,
  QrCode,
  ShieldCheck,
  Siren,
  Ticket,
} from "lucide-react";
import { sentinel } from "../../../../../packages/engine";
import { getClinicalRedFlags } from "../../../../../packages/engine/clinicalIntake";
import {
  complaints,
  interceptorQuestions,
  needsStemiQuestions,
  patientLanguages,
  sentinelQuestions,
  type kioskIntakeSchema,
  type SentinelQuestion,
} from "../../../../../packages/shared/patient-experience";
import { InlineBanner } from "@/components/ui/design-primitives";
import { GoldUnderline } from "@/components/landing-public/shared";
import { IdentityVerification } from "@/components/PatientSignIn";
import { patientRequest, usePatientData } from "@/lib/patientApi";
import {
  AbhaQrScanner,
  DocumentReview,
  VoiceControls,
  playKioskAlert,
} from "./capture";
import { kioskClinicalCopy, kioskPrompts } from "./kiosk-copy";
import {
  KioskCardBottomDecor,
  KioskComplaintIcon,
  KioskConsentIcon,
  KioskInfoAlert,
  KioskLanguageGlyph,
  KioskStageHeader,
  KioskVerifiedPill,
} from "./kiosk-ui";

type Intake = z.input<typeof kioskIntakeSchema>;
type Answer = "yes" | "no" | "unsure";
type Token = {
  token: string;
  receiptId: string;
  createdAt: string;
  triage: "emergency" | "priority" | "routine";
};

const emptyConsent = {
  care: false,
  pharmacy: false,
  remote: false,
  research: false,
  guardian: false,
};
const consentOptions = [
  "care",
  "pharmacy",
  "remote",
  "research",
  "guardian",
] as const;

function formatIssuedAt(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const time = new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .format(date)
    .toUpperCase();
  const dayMonthYear = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
  return `${time}, ${dayMonthYear}`;
}

export function KioskIntake() {
  const [locale, setLocale] = useState<Intake["locale"]>("en");
  const [step, setStep] = useState(0);
  const [navDirection, setNavDirection] = useState<"forward" | "backward">(
    "forward",
  );
  const [consent, setConsent] = useState(emptyConsent);
  const [verified, setVerified] = useState<string>();
  const [abha, setAbha] = useState("");
  const [complaint, setComplaint] = useState<Intake["complaint"]>();
  const [description, setDescription] = useState("");
  const [answers, setAnswers] = useState<NonNullable<Intake["answers"]>>({});
  const [interceptor, setInterceptor] = useState<
    NonNullable<Intake["interceptor"]>
  >({});
  const [doc, setDoc] = useState("");
  const [docConfirmed, setDocConfirmed] = useState(false);
  const [token, setToken] = useState<Token>();
  const [qr, setQr] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [copiedReceipt, setCopiedReceipt] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [retry, setRetry] = useState<Intake>();
  const request = useRef<{ hash: string; id: string }>();
  const working = useRef(false);
  const copyTimer = useRef<number>();
  const heading = useRef<HTMLHeadingElement>(null);
  const { data: capability, error: capabilityError } = usePatientData<{
    intakeAvailable: boolean;
    simulatedIdentity?: boolean;
  }>("/kiosk/capabilities", 0, false);

  const language = patientLanguages[locale][1];
  const copy = kioskPrompts[locale];
  const localized = kioskClinicalCopy[locale];
  const allConsentGiven = consentOptions.every((key) => Boolean(consent[key]));
  const firstStemi = interceptorQuestions.find((field) => !interceptor[field]);
  const question = sentinel({ answers })
    .nextQuestion as SentinelQuestion | null;
  const caption =
    (step === 4 && firstStemi
      ? localized.stemi[interceptorQuestions.indexOf(firstStemi)]
      : step === 5 && question
        ? localized.questions[sentinelQuestions.indexOf(question)]
        : copy[step]) ?? copy[0];

  function goToStep(nextStep: number, direction: "forward" | "backward") {
    setNavDirection(direction);
    setStep(nextStep);
  }

  useEffect(() => {
    heading.current?.focus();
  }, [step, caption]);

  useEffect(
    () => () => {
      if (copyTimer.current) window.clearTimeout(copyTimer.current);
    },
    [],
  );

  useEffect(() => {
    let valid = true;
    if (token)
      void import("qrcode")
        .then(({ default: code }) =>
          code.toDataURL(token.receiptId, { width: 160, margin: 2 }),
        )
        .then((image) => {
          if (valid) setQr(image);
        })
        .catch(() => undefined);
    return () => {
      valid = false;
    };
  }, [token]);

  async function send(payload: Intake, emergency = false) {
    if (working.current) return;
    if (emergency && !urgent) playKioskAlert();
    setNavDirection("forward");
    setStep(7);
    setUrgent(emergency);
    setError("");
    setRetry(payload);
    const hash = JSON.stringify(payload);
    if (request.current?.hash !== hash)
      request.current = { hash, id: crypto.randomUUID() };
    working.current = true;
    setPending(true);
    try {
      const response = await patientRequest<Token>("/kiosk/intake", {
        method: "POST",
        body: payload,
        idempotencyKey: request.current.id,
      });
      setToken(response);
      setUrgent(response.triage === "emergency");
    } catch (err) {
      console.error("Kiosk intake error:", err);
      setError("A token could not be issued. Ask the reception desk for help.");
    } finally {
      working.current = false;
      setPending(false);
    }
  }

  function submit(
    nextAnswers = answers,
    nextInterceptor = interceptor,
    emergency = false,
  ) {
    return send(
      {
        locale,
        intent: "intake",
        consent,
        verifiedIdentityId: verified,
        complaint,
        description,
        answers: nextAnswers,
        interceptor: nextInterceptor,
        documentText: consent.care && docConfirmed ? doc : undefined,
      },
      emergency,
    );
  }

  function continueFromComplaint() {
    const flags = getClinicalRedFlags(description);
    const emergency =
      complaint === "chest" ||
      flags.some((flag) =>
        ["chest_pain", "fainting", "breathlessness"].includes(flag),
      );
    if (emergency) void submit(answers, interceptor, true);
    else goToStep(needsStemiQuestions(complaint ?? "", description) ? 4 : 5, "forward");
  }

  function recordAnswer(answer: Answer) {
    if (step === 4 && firstStemi) {
      const next = { ...interceptor, [firstStemi]: answer };
      setInterceptor(next);
      if (answer === "yes") void submit(answers, next, true);
      else if (interceptorQuestions.every((key) => next[key]))
        goToStep(5, "forward");
    } else if (question) {
      const next = { ...answers, [question]: answer };
      setAnswers(next);
      const result = sentinel({ answers: next });
      if (result.tier === "emergency") void submit(next, interceptor, true);
      else if (!result.nextQuestion)
        goToStep(consent.care ? 6 : 7, "forward");
      if (!result.nextQuestion && result.tier !== "emergency" && !consent.care)
        void submit(next);
    }
  }

  function handleBack() {
    if (step >= 4) {
      setAnswers({});
      setInterceptor({});
      goToStep(3, "backward");
    } else {
      if (step === 3) {
        setVerified(undefined);
        setAbha("");
      }
      goToStep(step === 3 && !consent.care ? 1 : step - 1, "backward");
    }
  }

  function reset() {
    setNavDirection("forward");
    setStep(0);
    setLocale("en");
    setConsent(emptyConsent);
    setVerified(undefined);
    setAbha("");
    setComplaint(undefined);
    setDescription("");
    setAnswers({});
    setInterceptor({});
    setDoc("");
    setDocConfirmed(false);
    setToken(undefined);
    setQr("");
    setUrgent(false);
    setCopiedReceipt(false);
    setError("");
    setRetry(undefined);
    request.current = undefined;
  }

  async function copyReceipt() {
    if (!token?.receiptId) return;
    try {
      await navigator.clipboard?.writeText(token.receiptId);
      setCopiedReceipt(true);
      if (copyTimer.current) window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopiedReceipt(false), 2000);
    } catch {
      setCopiedReceipt(false);
    }
  }

  const backButton =
    step > 0 && step < 7 ? (
      <button
        type="button"
        onClick={handleBack}
        className="jvk-motion-action jvk-kiosk-compact-btn print:hidden inline-flex items-center gap-2 rounded-xl border border-[#DCE3DA] bg-white px-5 py-2.5 text-[15px] font-semibold text-[#182E29] shadow-[0_1px_2px_rgba(14,36,32,0.03)] transition-colors hover:border-[#8DC5B1] hover:bg-[#F5FAF7] cursor-pointer"
      >
        <ArrowLeft aria-hidden="true" className="jvk-motion-arrow size-4 text-[#4B5D57]" />
        <span>Back</span>
      </button>
    ) : null;

  const triageLabel = token
    ? token.triage === "emergency"
      ? "Emergency"
      : token.triage === "priority"
        ? "Priority clinical review"
        : "Routine review"
    : "";

  const issuedAtLabel = token ? formatIssuedAt(token.createdAt) : null;

  const stageAnimationClass =
    step === 7 && urgent
      ? ""
      : navDirection === "backward"
        ? "jvk-kiosk-stage-backward"
        : "jvk-kiosk-stage-forward";

  return (
    <section
      data-no-translate="true"
      className="kiosk-intake mx-auto w-full space-y-5"
      aria-label="Public patient intake"
    >
      {/* Shared Kiosk Header preserving original JEEVIKA logo + emergency escalation */}
      <header className="flex flex-wrap items-center justify-between gap-3 px-1 print:hidden">
        <Link
          to="/"
          aria-label="JEEVIKA home"
          className="jvk-kiosk-header-logo inline-flex shrink-0 items-center rounded-xl py-1 transition-transform hover:scale-[1.01]"
        >
          <img
            src="/assets/logo-jeevika.png"
            alt="JEEVIKA"
            width={140}
            height={47}
            className="kiosk-brand-logo"
          />
        </Link>
        {step < 7 && (
          <button
            type="button"
            onClick={() =>
              void send(
                { locale, intent: "urgent-help", consent: emptyConsent },
                true,
              )
            }
            className="jvk-kiosk-urgent-btn jvk-kiosk-compact-btn inline-flex items-center gap-2 rounded-xl bg-[#EE3D3D] px-4 py-2.5 text-[15px] font-semibold text-white shadow-[0_6px_16px_rgba(238,61,61,0.22)] transition-colors hover:bg-[#D72C2C] active:bg-[#B91C1C] cursor-pointer"
          >
            <PhoneCall aria-hidden="true" className="size-4 shrink-0" />
            <span>Get urgent help</span>
          </button>
        )}
      </header>
      <div className="jvk-kiosk-card">
        {step === 7 && (
          <img
            src="/assets/kiosk/kiosk-token-botanical.png"
            alt=""
            aria-hidden="true"
            width={426}
            height={180}
            className="jvk-kiosk-artwork jvk-kiosk-decor absolute top-0 right-0 w-44 sm:w-64 h-auto opacity-95"
          />
        )}

        <div
          key={step}
          className={`relative z-10 p-5 sm:p-9 space-y-6 ${step < 7 ? "pb-8 sm:pb-11" : ""} ${stageAnimationClass}`}
        >
          {step < 7 && (!capability?.intakeAvailable || capabilityError) && (
            <InlineBanner
              tone={capabilityError ? "critical" : "info"}
              title={
                capabilityError
                  ? "Unable to check kiosk availability"
                  : capability
                    ? "Digital intake unavailable"
                    : "Checking kiosk availability…"
              }
            >
              Reception can help you check in.
            </InlineBanner>
          )}

          {/* Stage 0: Choose a language */}
          {step === 0 && (
            <>
              <KioskStageHeader
                headingRef={heading}
                title={copy[0]}
                language={language}
                subtitle="Select the language you want to use at the kiosk."
                entrance="left"
                subtitleEntrance="right"
                illustration={{
                  src: "/assets/kiosk/kiosk-clinic-watercolor.png",
                  width: 492,
                  height: 148,
                }}
                illustrationClassName="w-60 sm:w-[270px] -mt-1"
              />

              <ul
                aria-label="Kiosk languages"
                className="grid grid-cols-1 min-[420px]:grid-cols-2 md:grid-cols-3 gap-3"
              >
                {Object.entries(patientLanguages).map(([key, [label, lang]]) => {
                  const selected = key === locale;
                  return (
                    <li key={key}>
                      <button
                        type="button"
                        data-selected={selected ? "true" : "false"}
                        className="jvk-kiosk-choice-card flex w-full items-center gap-3 px-3.5 py-2.5 text-left cursor-pointer"
                        lang={lang}
                        aria-pressed={selected}
                        onClick={() => setLocale(key as Intake["locale"])}
                      >
                        <KioskLanguageGlyph selected={selected} />
                        <span
                          className={`min-w-0 flex-1 text-[16px] leading-snug ${
                            selected ? "font-semibold text-white" : "font-medium text-[#132924]"
                          }`}
                        >
                          {label}
                        </span>
                        {selected && (
                          <Check
                            aria-hidden="true"
                            className="size-4.5 shrink-0 text-white"
                          />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>

              <VoiceControls
                caption={copy[0]}
                locale={language}
                uiVariant="kiosk"
              />

              <div>
                <button
                  type="button"
                  lang={language}
                  onClick={() => goToStep(1, "forward")}
                  className="jvk-motion-action jvk-kiosk-primary-btn jvk-kiosk-compact-btn inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#047C61] to-[#02644F] px-6 py-3 text-[15px] font-semibold text-white shadow-[0_8px_18px_rgba(4,124,97,0.2)] transition-all hover:from-[#036B54] hover:to-[#025140] cursor-pointer"
                >
                  <span key={locale}>{copy[8]}</span>
                  <ArrowRight aria-hidden="true" className="jvk-motion-arrow size-4 shrink-0" />
                </button>
              </div>
            </>
          )}

          {/* Stage 1: Consent */}
          {step === 1 && (
            <>
              <KioskStageHeader
                headingRef={heading}
                title={copy[1]}
                language={language}
                illustration={{
                  src: "/assets/kiosk/kiosk-consent-clipboard.png",
                  width: 376,
                  height: 224,
                }}
                illustrationClassName="w-40 sm:w-52 -mt-1"
                belowTitle={
                  <div className="pt-2">
                    <VoiceControls
                      caption={copy[1]}
                      locale={language}
                      uiVariant="kiosk"
                    />
                  </div>
                }
              />

              {capability?.simulatedIdentity !== false && (
                <KioskInfoAlert title="Synthetic intake trial">
                  Use only test information. You can skip identity verification
                  and continue as an anonymous walk-in.
                </KioskInfoAlert>
              )}

              <fieldset className="space-y-2.5">
                <legend className="mb-2 text-[16px] font-bold text-[#0E2420]">
                  Consent choices
                </legend>
                {consentOptions.map((key, index) => {
                  const checked = consent[key];
                  return (
                    <label
                      key={key}
                      data-checked={checked ? "true" : "false"}
                      className="jvk-kiosk-consent-row flex items-center gap-3 px-4 py-2.5 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        className="jvk-kiosk-checkbox shrink-0"
                        checked={checked}
                        onChange={(event) =>
                          setConsent({
                            ...consent,
                            [key]: event.target.checked,
                          })
                        }
                      />
                      <KioskConsentIcon option={key} />
                      <span
                        lang={language}
                        className="text-[15px] font-medium text-[#162C27] leading-snug"
                      >
                        {localized.consent[index]}
                      </span>
                    </label>
                  );
                })}
              </fieldset>

              <div className="space-y-2.5">
                <button
                  type="button"
                  lang={language}
                  disabled={!allConsentGiven}
                  aria-disabled={!allConsentGiven}
                  onClick={() =>
                    goToStep(consent.care ? 2 : 3, "forward")
                  }
                  className={`jvk-motion-action jvk-kiosk-primary-btn jvk-kiosk-compact-btn flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3 text-[15px] font-semibold text-white transition-all ${
                    allConsentGiven
                      ? "bg-gradient-to-b from-[#047C61] to-[#02644F] shadow-[0_8px_18px_rgba(4,124,97,0.2)] hover:from-[#036B54] hover:to-[#025140] cursor-pointer"
                      : "bg-[#9AC0B2] cursor-not-allowed"
                  }`}
                >
                  <span>{copy[8]}</span>
                  {allConsentGiven && (
                    <ArrowRight aria-hidden="true" className="jvk-motion-arrow size-4 shrink-0" />
                  )}
                </button>
                <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                  {backButton}
                  {!allConsentGiven && (
                    <p className="jvk-kiosk-meta-text text-[#566A63]">
                      All consent choices are required to continue.
                    </p>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Stage 2: Verify your identity */}
          {step === 2 && (
            <>
              <KioskStageHeader
                headingRef={heading}
                title={copy[2]}
                language={language}
                illustration={{
                  src: "/assets/kiosk/kiosk-identity-qr.png",
                  width: 408,
                  height: 224,
                }}
                illustrationClassName="w-40 sm:w-48"
                belowTitle={
                  <div className="pt-2">
                    <AbhaQrScanner uiVariant="kiosk" onFound={setAbha} />
                  </div>
                }
              />

              <IdentityVerification
                key={abha}
                purpose="kiosk"
                initialAbha={abha}
                onVerified={({ verifiedIdentityId }) => {
                  setVerified(verifiedIdentityId);
                  goToStep(3, "forward");
                }}
                secondaryActions={
                  <div className="flex flex-wrap items-center gap-2.5 pt-0.5">
                    <button
                      type="button"
                      onClick={() => goToStep(3, "forward")}
                      className="jvk-kiosk-compact-btn inline-flex items-center justify-center rounded-xl border border-[#DCE3DA] bg-white px-4 py-2.5 text-[15px] font-semibold text-[#182E29] shadow-[0_1px_2px_rgba(14,36,32,0.03)] transition-colors hover:border-[#8DC5B1] hover:bg-[#F5FAF7] cursor-pointer"
                    >
                      Continue without verification
                    </button>
                    {backButton}
                  </div>
                }
              />
            </>
          )}

          {/* Stage 3: Tell us why you came */}
          {step === 3 && (
            <>
              <KioskStageHeader
                headingRef={heading}
                title={copy[3]}
                language={language}
                illustration={{
                  src: "/assets/kiosk/kiosk-symptoms-stethoscope.png",
                  width: 412,
                  height: 132,
                }}
                illustrationClassName="w-48 sm:w-60 -mt-1"
                belowTitle={
                  verified ? (
                    <div className="pt-1">
                      <KioskVerifiedPill label="Synthetic identity verified" />
                    </div>
                  ) : undefined
                }
              />

              <fieldset
                className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                aria-label="Reasons for visit"
              >
                {complaints.map((option, index) => {
                  const selected = complaint === option;
                  return (
                    <button
                      type="button"
                      lang={language}
                      key={option}
                      data-selected={selected ? "true" : "false"}
                      aria-pressed={selected}
                      onClick={() => {
                        setComplaint(option);
                        setAnswers({});
                        setInterceptor({});
                      }}
                      className="jvk-kiosk-symptom-card flex items-center gap-3 px-4 py-3 text-left cursor-pointer"
                    >
                      <KioskComplaintIcon
                        complaint={option}
                        selected={selected}
                      />
                      <span
                        className={`min-w-0 flex-1 text-[15px] leading-snug ${
                          selected
                            ? "font-semibold text-[#083D2F]"
                            : "font-medium text-[#162C27]"
                        }`}
                      >
                        {localized.complaints[index]}
                      </span>
                      {selected && (
                        <Check
                          aria-hidden="true"
                          className="size-4 shrink-0 text-[#047C61]"
                        />
                      )}
                    </button>
                  );
                })}
              </fieldset>

              <VoiceControls
                caption={copy[3]}
                locale={language}
                uiVariant="kiosk"
                onTranscript={(text) =>
                  setDescription((prev) =>
                    prev.trim() && !text.startsWith(prev.trim())
                      ? `${prev.trim()} ${text}`.slice(0, 600)
                      : text.slice(0, 600),
                  )
                }
              />

              <label className="block space-y-1.5">
                <span className="block text-[15px] font-semibold text-[#132924]">
                  Describe your symptoms
                </span>
                <div className="relative">
                  <Pencil
                    aria-hidden="true"
                    className="pointer-events-none absolute top-3.5 left-3.5 size-4 text-[#057C61]"
                  />
                  <textarea
                    className="jvk-motion-field block w-full rounded-xl border border-[#DCE3DA] bg-[#FAFBF8] py-3 pr-3.5 pl-10 text-[15px] text-[#0E2420] placeholder:text-[#6B7E77] focus:border-[#047C61] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#047C61]/20"
                    maxLength={600}
                    rows={3}
                    placeholder="Type or speak your symptoms here..."
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                  />
                </div>
              </label>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  lang={language}
                  disabled={!complaint}
                  onClick={continueFromComplaint}
                  className={`jvk-motion-action jvk-kiosk-primary-btn jvk-kiosk-compact-btn inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-[15px] font-semibold text-white transition-all ${
                    complaint
                      ? "bg-gradient-to-b from-[#047C61] to-[#02644F] shadow-[0_8px_18px_rgba(4,124,97,0.2)] hover:from-[#036B54] hover:to-[#025140] cursor-pointer"
                      : "bg-[#9AC0B2] cursor-not-allowed"
                  }`}
                >
                  <span>{copy[8]}</span>
                  <ArrowRight aria-hidden="true" className="jvk-motion-arrow size-4 shrink-0" />
                </button>
                {backButton}
              </div>
            </>
          )}

          {/* Stage 4 & 5: STEMI Interceptor / Dynamic Clinical Questionnaire */}
          {(step === 4 || step === 5) && (
            <>
              <KioskStageHeader
                headingRef={heading}
                title={copy[step]}
                language={language}
                subtitle="Choose the option that best matches what you are feeling right now."
                illustration={{
                  src: "/assets/kiosk/kiosk-symptoms-stethoscope.png",
                  width: 412,
                  height: 132,
                }}
                illustrationClassName="w-44 sm:w-52"
              />

              <VoiceControls
                caption={caption}
                locale={language}
                uiVariant="kiosk"
              />

              <div className="rounded-2xl border border-[#DCE6DC] bg-[#F7FAF7] p-4 sm:p-6 space-y-4">
                <p
                  lang={language}
                  className="text-lg sm:text-xl font-bold leading-snug text-[#0E2420]"
                >
                  {caption}
                </p>

                <fieldset
                  className="grid grid-cols-1 sm:grid-cols-3 gap-3"
                  aria-label="Answer"
                >
                  {(["yes", "no", "unsure"] as const).map((option, index) => (
                    <button
                      type="button"
                      key={option}
                      lang={language}
                      onClick={() => recordAnswer(option)}
                      className="jvk-kiosk-answer-btn flex items-center justify-center px-4 py-3 text-[16px] cursor-pointer"
                    >
                      <span key={locale}>{copy[9 + index]}</span>
                    </button>
                  ))}
                </fieldset>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {backButton}
              </div>
            </>
          )}

          {/* Stage 6: Review a document */}
          {step === 6 && (
            <>
              <KioskStageHeader
                headingRef={heading}
                title={copy[6]}
                language={language}
                subtitle="Optional. Scan a previous prescription or report and confirm the text before sharing it."
                illustration={{
                  src: "/assets/kiosk/kiosk-consent-clipboard.png",
                  width: 376,
                  height: 224,
                }}
                illustrationClassName="w-40 sm:w-48"
              />

              <DocumentReview
                uiVariant="kiosk"
                value={doc}
                onChange={(value) => {
                  setDoc(value);
                  setDocConfirmed(false);
                }}
              />

              {doc && (
                <label
                  data-checked={docConfirmed ? "true" : "false"}
                  className="jvk-kiosk-consent-row flex items-center gap-3 px-4 py-2.5 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    className="jvk-kiosk-checkbox shrink-0"
                    checked={docConfirmed}
                    onChange={(event) => setDocConfirmed(event.target.checked)}
                  />
                  <span className="text-[15px] font-medium text-[#162C27]">
                    I checked the extracted text and want to share it.
                  </span>
                </label>
              )}

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => void submit()}
                  className="jvk-kiosk-primary-btn jvk-kiosk-compact-btn inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#047C61] to-[#02644F] px-6 py-3 text-[15px] font-semibold text-white shadow-[0_8px_18px_rgba(4,124,97,0.2)] transition-all hover:from-[#036B54] hover:to-[#025140] cursor-pointer"
                >
                  <span>Request token</span>
                  <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
                </button>
                {backButton}
              </div>
            </>
          )}

          {/* Stage 7: Your token */}
          {step === 7 && (
            <>
              <div className="space-y-2 pr-0 sm:pr-48">
                <div className="inline-block max-w-full">
                  <h1
                    ref={heading}
                    tabIndex={-1}
                    lang={language}
                    className="jvk-kiosk-heading text-[26px] sm:text-[32px] focus:outline-none"
                  >
                    <span key={`${language}-${copy[7]}`}>{copy[7]}</span>
                  </h1>
                  <GoldUnderline className="mt-1 block h-2 w-32 sm:w-40" />
                </div>
                <p className="jvk-kiosk-subcopy text-[#4B5D57]">
                  {error
                    ? "We could not complete registration digitally."
                    : "Your registration is complete. Keep this token for your visit."}
                </p>
              </div>

              {urgent && (
                <div
                  role="alert"
                  className="flex items-center justify-between gap-3 rounded-2xl border border-[#F3C6C6] bg-[#FDF0F0] px-4 py-3.5 text-[#9B1C1C]"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <AlertTriangle
                      aria-hidden="true"
                      className="mt-0.5 size-5 shrink-0 text-[#DC2626]"
                    />
                    <div className="min-w-0">
                      <p className="text-[15px] font-bold leading-snug text-[#991B1B]">
                        Urgent help
                      </p>
                      <p
                        lang={language}
                        className="jvk-kiosk-meta-text mt-0.5 font-medium text-[#B91C1C]"
                      >
                        <span key={`${language}-${copy[12]}`}>{copy[12]}</span>
                      </p>
                    </div>
                  </div>
                  <ChevronRight
                    aria-hidden="true"
                    className="size-4 shrink-0 text-[#B91C1C]/75"
                  />
                </div>
              )}

              {pending && (
                <p
                  role="status"
                  className="rounded-xl border border-[#DCE6DC] bg-[#F7FAF7] px-4 py-3 text-sm font-semibold text-[#18312B]"
                >
                  Requesting your queue token…
                </p>
              )}

              {error && <InlineBanner tone="critical" title={error} />}

              {token && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_240px] gap-4">
                    {/* Token Metadata Summary Card */}
                    <div className="rounded-2xl border border-[#E5E8E0] bg-[#FAFBF8] p-4 sm:p-5">
                      <div className="flex flex-wrap items-center gap-2.5 pb-3.5 border-b border-[#EAECE6]">
                        <span className="inline-flex items-center rounded-lg bg-[#DCF1E4] px-3 py-1 text-lg font-bold tracking-tight text-[#075841] tabular-nums">
                          {token.token}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                            token.triage === "emergency"
                              ? "border-[#F3C6C6] bg-[#FDECEC] text-[#B91C1C]"
                              : token.triage === "priority"
                                ? "border-[#F5D692] bg-[#FEF5DF] text-[#854D0E]"
                                : "border-[#BFE0CD] bg-[#EAF6EE] text-[#0D604A]"
                          }`}
                        >
                          {token.triage === "emergency" ? (
                            <Siren aria-hidden="true" className="size-3.5 shrink-0" />
                          ) : token.triage === "priority" ? (
                            <AlertTriangle
                              aria-hidden="true"
                              className="size-3.5 shrink-0"
                            />
                          ) : (
                            <CheckCircle2
                              aria-hidden="true"
                              className="size-3.5 shrink-0"
                            />
                          )}
                          <span>{triageLabel}</span>
                        </span>
                      </div>

                      <dl className="divide-y divide-[#EBEEE6]">
                        <div className="grid grid-cols-1 sm:grid-cols-[155px_1fr] items-center gap-1 sm:gap-3 py-3">
                          <dt className="jvk-kiosk-meta-text flex items-center gap-2 font-medium text-[#5A6D66]">
                            <Ticket
                              aria-hidden="true"
                              className="size-4 shrink-0 text-[#057C61]"
                            />
                            <span>Token Type</span>
                          </dt>
                          <dd className="text-sm font-bold text-[#0E2420]">
                            {triageLabel}
                          </dd>
                        </div>

                        {issuedAtLabel && (
                          <div className="grid grid-cols-1 sm:grid-cols-[155px_1fr] items-center gap-1 sm:gap-3 py-3">
                            <dt className="jvk-kiosk-meta-text flex items-center gap-2 font-medium text-[#5A6D66]">
                              <Clock
                                aria-hidden="true"
                                className="size-4 shrink-0 text-[#057C61]"
                              />
                              <span>Issued At</span>
                            </dt>
                            <dd className="text-sm font-semibold text-[#1E332E] tabular-nums">
                              {issuedAtLabel}
                            </dd>
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-[155px_1fr] items-center gap-1 sm:gap-3 pt-3">
                          <dt className="jvk-kiosk-meta-text flex items-center gap-2 font-medium text-[#5A6D66]">
                            <ShieldCheck
                              aria-hidden="true"
                              className="size-4 shrink-0 text-[#057C61]"
                            />
                            <span>Consent Receipt</span>
                          </dt>
                          <dd className="flex items-center justify-between gap-2 min-w-0">
                            <code className="text-xs sm:text-[13px] font-medium text-[#1E332E] break-all">
                              {token.receiptId}
                            </code>
                            <button
                              type="button"
                              onClick={() => void copyReceipt()}
                              aria-label={
                                copiedReceipt
                                  ? "Copied consent receipt"
                                  : "Copy consent receipt"
                              }
                              className="jvk-kiosk-icon-btn print:hidden inline-flex shrink-0 items-center justify-center rounded-lg border border-[#DCE3DA] bg-white p-1.5 text-[#3F574F] transition-colors hover:border-[#78B9A3] hover:text-[#047C61] cursor-pointer"
                            >
                              {copiedReceipt ? (
                                <Check
                                  aria-hidden="true"
                                  className="size-4 text-[#047C61]"
                                />
                              ) : (
                                <Copy aria-hidden="true" className="size-4" />
                              )}
                            </button>
                          </dd>
                        </div>
                      </dl>
                    </div>

                    {/* Dynamic Scannable Receipt QR Card */}
                    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-[#DCE8E0] bg-gradient-to-b from-[#FFFFFF] to-[#EBF6EF] p-4">
                      {qr ? (
                        <div className="jvk-qr-frame">
                          <span
                            className="jvk-qr-corner jvk-qr-corner-tl"
                            aria-hidden="true"
                          />
                          <span
                            className="jvk-qr-corner jvk-qr-corner-tr"
                            aria-hidden="true"
                          />
                          <span
                            className="jvk-qr-corner jvk-qr-corner-bl"
                            aria-hidden="true"
                          />
                          <span
                            className="jvk-qr-corner jvk-qr-corner-br"
                            aria-hidden="true"
                          />
                          <img
                            src={qr}
                            width="160"
                            height="160"
                            alt="Consent receipt reference QR code"
                            className="block rounded"
                          />
                        </div>
                      ) : (
                        <div className="flex size-[180px] items-center justify-center rounded-xl border border-[#DCE8E0] bg-white text-xs text-[#5A6D66]">
                          Generating QR…
                        </div>
                      )}
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#163029]">
                        <QrCode
                          aria-hidden="true"
                          className="size-4 shrink-0 text-[#057C61]"
                        />
                        <span>Scan at reception</span>
                      </span>
                    </div>
                  </div>

                  <div
                    role="status"
                    className="flex items-center gap-2.5 rounded-xl border border-[#DCE8E0] bg-[#EEF7F1] px-4 py-2.5 text-sm text-[#1E3B33]"
                  >
                    <Info
                      aria-hidden="true"
                      className="size-4 shrink-0 text-[#057C61]"
                    />
                    <p className="jvk-kiosk-meta-text font-medium text-[#1E3B33]">
                      {urgent
                        ? "Show this token to nearby staff or reception immediately."
                        : "Show this token at reception for your room and wait time."}
                    </p>
                  </div>
                </>
              )}

              <div className="flex flex-wrap items-center gap-3 print:hidden">
                {token && (
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="jvk-motion-action jvk-kiosk-primary-btn jvk-kiosk-compact-btn inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#047C61] to-[#02644F] px-5 py-2.5 text-[15px] font-semibold text-white shadow-[0_6px_16px_rgba(4,124,97,0.2)] transition-all hover:from-[#036B54] hover:to-[#025140] cursor-pointer"
                  >
                    <Printer aria-hidden="true" className="size-4 shrink-0" />
                    <span>Print token</span>
                  </button>
                )}
                {error && retry && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => void send(retry, urgent)}
                    className="jvk-motion-action jvk-kiosk-primary-btn jvk-kiosk-compact-btn inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#047C61] to-[#02644F] px-5 py-2.5 text-[15px] font-semibold text-white shadow-[0_6px_16px_rgba(4,124,97,0.2)] transition-all hover:from-[#036B54] hover:to-[#025140] cursor-pointer"
                  >
                    <span>Try again</span>
                  </button>
                )}
                {!pending && (
                  <button
                    type="button"
                    onClick={reset}
                    className="jvk-motion-action jvk-kiosk-compact-btn inline-flex items-center justify-center gap-2 rounded-xl border border-[#DCE3DA] bg-white px-5 py-2.5 text-[15px] font-semibold text-[#182E29] shadow-[0_1px_2px_rgba(14,36,32,0.03)] transition-colors hover:border-[#8DC5B1] hover:bg-[#F5FAF7] cursor-pointer"
                  >
                    <CalendarCheck
                      aria-hidden="true"
                      className="size-4 shrink-0 text-[#057C61]"
                    />
                    <span>Start a new visit</span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {step < 7 && <KioskCardBottomDecor />}
      </div>
    </section>
  );
}
