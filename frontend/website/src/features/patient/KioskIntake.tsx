import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { z } from "zod";
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
import { Button, Card, CardContent } from "@/components/ui/basic";
import { InlineBanner, StatusChip } from "@/components/ui/design-primitives";
import { IdentityVerification } from "@/components/PatientSignIn";
import { patientRequest, usePatientData } from "@/lib/patientApi";
import {
  AbhaQrScanner,
  DocumentReview,
  VoiceControls,
  playKioskAlert,
} from "./capture";
import { kioskClinicalCopy, kioskPrompts } from "./kiosk-copy";

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

export function KioskIntake() {
  const [locale, setLocale] = useState<Intake["locale"]>("en");
  const [step, setStep] = useState(0);
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
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [retry, setRetry] = useState<Intake>();
  const request = useRef<{ hash: string; id: string }>();
  const working = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const { data: capability, error: capabilityError } = usePatientData<{
    intakeAvailable: boolean;
  }>("/kiosk/capabilities", 0, false);
  const language = patientLanguages[locale][1];
  const copy = kioskPrompts[locale];
  const localized = kioskClinicalCopy[locale];
  const firstStemi = interceptorQuestions.find((field) => !interceptor[field]);
  const question = sentinel({ answers })
    .nextQuestion as SentinelQuestion | null;
  const caption =
    (step === 4 && firstStemi
      ? localized.stemi[interceptorQuestions.indexOf(firstStemi)]
      : step === 5 && question
        ? localized.questions[sentinelQuestions.indexOf(question)]
        : copy[step]) ?? copy[0];

  useEffect(() => {
    heading.current?.focus();
  }, [step, caption]);
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
    else setStep(needsStemiQuestions(complaint ?? "", description) ? 4 : 5);
  }

  function recordAnswer(answer: Answer) {
    if (step === 4 && firstStemi) {
      const next = { ...interceptor, [firstStemi]: answer };
      setInterceptor(next);
      if (answer === "yes") void submit(answers, next, true);
      else if (interceptorQuestions.every((key) => next[key])) setStep(5);
    } else if (question) {
      const next = { ...answers, [question]: answer };
      setAnswers(next);
      const result = sentinel({ answers: next });
      if (result.tier === "emergency") void submit(next, interceptor, true);
      else if (!result.nextQuestion) setStep(consent.care ? 6 : 7);
      if (!result.nextQuestion && result.tier !== "emergency" && !consent.care)
        void submit(next);
    }
  }

  function reset() {
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
    setError("");
    setRetry(undefined);
    request.current = undefined;
  }

  return (
    <section
      className="kiosk-intake mx-auto max-w-4xl space-y-5"
      aria-label="Public patient intake"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link to="/" className="inline-flex items-center font-bold">
          JEEVIKA
        </Link>
        {step < 7 && (
          <Button
            variant="destructive"
            onClick={() =>
              void send(
                { locale, intent: "urgent-help", consent: emptyConsent },
                true,
              )
            }
          >
            Get urgent help
          </Button>
        )}
      </header>
      <Card>
        <CardContent className="space-y-5 p-4 sm:p-8">
          <h1
            ref={heading}
            tabIndex={-1}
            lang={language}
            className="text-2xl font-bold sm:text-3xl"
          >
            {copy[step]}
          </h1>
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
          {step === 0 && (
            <>
              <p>Select the language you want to use at the kiosk.</p>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {Object.entries(patientLanguages).map(
                  ([key, [label, lang]]) => (
                    <li key={key}>
                      <Button
                        variant={key === locale ? "default" : "outline"}
                        className="w-full"
                        lang={lang}
                        aria-pressed={key === locale}
                        onClick={() => setLocale(key as Intake["locale"])}
                      >
                        {label}
                      </Button>
                    </li>
                  ),
                )}
              </ul>
              <VoiceControls caption={copy[0]} locale={language} />
              <Button lang={language} onClick={() => setStep(1)}>
                {copy[8]}
              </Button>
            </>
          )}
          {step === 1 && (
            <>
              <VoiceControls caption={copy[1]} locale={language} />
              <InlineBanner title="Synthetic intake trial">
                Use only test information. You can skip identity verification
                and continue as an anonymous walk-in.
              </InlineBanner>
              <fieldset className="space-y-2">
                <legend className="mb-2 font-semibold">Consent choices</legend>
                {consentOptions.map((key, index) => {
                  return (
                    <label
                      key={key}
                      className="flex items-center gap-3 rounded-lg border px-3"
                    >
                      <input
                        type="checkbox"
                        className="size-5 shrink-0"
                        checked={consent[key]}
                        onChange={(event) =>
                          setConsent({
                            ...consent,
                            [key]: event.target.checked,
                          })
                        }
                      />
                      <span lang={language}>{localized.consent[index]}</span>
                    </label>
                  );
                })}
              </fieldset>
              <Button
                lang={language}
                onClick={() => setStep(consent.care ? 2 : 3)}
              >
                {copy[8]}
              </Button>
            </>
          )}
          {step === 2 && (
            <>
              <AbhaQrScanner onFound={setAbha} />
              <IdentityVerification
                key={abha}
                purpose="kiosk"
                initialAbha={abha}
                onVerified={({ verifiedIdentityId }) => {
                  setVerified(verifiedIdentityId);
                  setStep(3);
                }}
              />
              <Button variant="outline" onClick={() => setStep(3)}>
                Continue without verification
              </Button>
            </>
          )}
          {step === 3 && (
            <>
              {verified && (
                <StatusChip tone="success">
                  Synthetic identity verified
                </StatusChip>
              )}
              <fieldset
                className="grid gap-3 sm:grid-cols-2"
                aria-label="Reasons for visit"
              >
                {complaints.map((option, index) => (
                  <Button
                    lang={language}
                    key={option}
                    variant={complaint === option ? "default" : "outline"}
                    aria-pressed={complaint === option}
                    onClick={() => {
                      setComplaint(option);
                      setAnswers({});
                      setInterceptor({});
                    }}
                  >
                    {localized.complaints[index]}
                  </Button>
                ))}
              </fieldset>
              <VoiceControls
                caption={copy[3]}
                locale={language}
                onTranscript={setDescription}
              />
              <label className="block">
                Describe your symptoms
                <textarea
                  className="block w-full rounded-lg border bg-background p-3"
                  maxLength={600}
                  rows={3}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </label>
              <Button
                lang={language}
                disabled={!complaint}
                onClick={continueFromComplaint}
              >
                {copy[8]}
              </Button>
            </>
          )}
          {(step === 4 || step === 5) && (
            <>
              <VoiceControls caption={caption} locale={language} />
              <fieldset className="grid grid-cols-3 gap-2" aria-label="Answer">
                {(["yes", "no", "unsure"] as const).map((option, index) => (
                  <Button
                    key={option}
                    lang={language}
                    variant="outline"
                    onClick={() => recordAnswer(option)}
                  >
                    {copy[9 + index]}
                  </Button>
                ))}
              </fieldset>
            </>
          )}
          {step === 6 && (
            <>
              <p>
                Optional. Scan a previous prescription or report and confirm the
                text before sharing it.
              </p>
              <DocumentReview
                value={doc}
                onChange={(value) => {
                  setDoc(value);
                  setDocConfirmed(false);
                }}
              />
              {doc && (
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={docConfirmed}
                    onChange={(event) => setDocConfirmed(event.target.checked)}
                  />
                  I checked the extracted text and want to share it.
                </label>
              )}
              <Button onClick={() => void submit()}>Request token</Button>
            </>
          )}
          {step === 7 && (
            <>
              {urgent && (
                <InlineBanner tone="critical" title="Urgent help">
                  <span lang={language}>{copy[12]}</span>
                </InlineBanner>
              )}
              {pending && <p role="status">Requesting your queue token…</p>}
              {error && <InlineBanner tone="critical" title={error} />}
              {token && (
                <div className="space-y-3">
                  <p className="text-4xl font-bold tabular-nums">
                    {token.token}
                  </p>
                  <p>
                    {token.triage === "emergency"
                      ? "Emergency"
                      : token.triage === "priority"
                        ? "Priority clinical review"
                        : "Routine review"}
                  </p>
                  <p>
                    Show this token at reception for your room and wait time.
                  </p>
                  <p>
                    Consent receipt{" "}
                    <code className="break-all">{token.receiptId}</code>
                  </p>
                  {qr && (
                    <img
                      src={qr}
                      width="160"
                      height="160"
                      alt="Consent receipt reference QR code"
                    />
                  )}
                  <Button
                    variant="outline"
                    className="print:hidden"
                    onClick={() => window.print()}
                  >
                    Print token
                  </Button>
                </div>
              )}
              <div className="flex flex-wrap gap-2 print:hidden">
                {error && retry && (
                  <Button
                    disabled={pending}
                    onClick={() => void send(retry, urgent)}
                  >
                    Try again
                  </Button>
                )}
                {!pending && (
                  <Button variant="outline" onClick={reset}>
                    Start a new visit
                  </Button>
                )}
              </div>
            </>
          )}
          {step > 0 && step < 7 && (
            <Button
              type="button"
              variant="outline"
              className="print:hidden"
              onClick={() => {
                if (step >= 4) {
                  setAnswers({});
                  setInterceptor({});
                  setStep(3);
                } else {
                  if (step === 3) {
                    setVerified(undefined);
                    setAbha("");
                  }
                  setStep(step === 3 && !consent.care ? 1 : step - 1);
                }
              }}
            >
              Back
            </Button>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
