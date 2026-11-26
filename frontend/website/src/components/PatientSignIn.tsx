import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CreditCard,
  FolderPlus,
  HeartPulse,
  Info,
  Lock,
  Mail,
  Pill,
  Smartphone,
  User,
  UserPlus,
} from "lucide-react";
import { patientReturnPath } from "@/lib/rbac";
import { Button, Label } from "@/components/ui/basic";
import { InlineBanner } from "@/components/ui/design-primitives";
import { demoPatientIdentity } from "../../../../packages/shared/patient-experience";
import {
  patientRequest,
  setPatientToken,
  usePatientData,
} from "@/lib/patientApi";
import {
  AuthBenefitsStrip,
  AuthDecorativeWave,
  AuthFormCard,
  AuthIllustrationPanel,
  AuthInput,
  AuthPasswordInput,
  AuthSubmitButton,
  GoldUnderline,
  type AuthBenefitItem,
} from "@/components/auth/AuthShell";

type Challenge = { id: string; demoCode: string };
type IdentityMethod = keyof typeof demoPatientIdentity;

const PATIENT_BENEFITS: AuthBenefitItem[] = [
  {
    icon: FolderPlus,
    title: "Your Records",
    description: "Safely access reports & history",
  },
  {
    icon: Pill,
    title: "Prescriptions",
    description: "View and manage your medicines",
  },
  {
    icon: HeartPulse,
    title: "Your Recovery Journey",
    description: "Track progress and stay on care plan",
  },
];

export function IdentityVerification({
  purpose,
  onVerified,
  initialAbha = "",
  secondaryActions,
}: {
  purpose: "home" | "kiosk";
  onVerified: (result: { token?: string; verifiedIdentityId?: string }) => void;
  initialAbha?: string;
  secondaryActions?: ReactNode;
}) {
  const { data, error: providerError } = usePatientData<{ demoOtp: boolean }>(
    "/auth/patient/otp/capabilities",
    0,
    false,
  );
  const [method, setMethod] = useState<IdentityMethod>("abha");
  const [value, setValue] = useState(initialAbha);
  const [challenge, setChallenge] = useState<Challenge>();
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setPending(true);
    setError("");
    try {
      if (challenge) {
        const result = await patientRequest<{
          token?: string;
          verifiedIdentityId?: string;
        }>("/auth/patient/otp/verify", {
          method: "POST",
          body: { id: challenge.id, code, purpose },
        });
        onVerified(result);
      } else {
        setChallenge(
          await patientRequest<Challenge>("/auth/patient/otp/start", {
            method: "POST",
            body: { method, identifier: value, purpose },
          }),
        );
      }
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Verification failed.",
      );
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  if (providerError)
    return <InlineBanner tone="critical" title={providerError} />;
  if (!data)
    return (
      <p role="status" className="text-sm text-[#4B5D57] py-2">
        Checking verification availability…
      </p>
    );
  if (!data.demoOtp)
    return (
      <InlineBanner tone="warning" title="OTP verification is unavailable">
        Contact the clinic for help accessing your patient account.
      </InlineBanner>
    );

  const isKiosk = purpose === "kiosk";

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => void submit(event)}
      aria-label="Patient identity verification"
    >
      {isKiosk ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-[#C6DDF5] bg-[#EAF3FD] px-4 py-3 text-[#184878]"
        >
          <Info aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-[#2367AA]" />
          <div className="min-w-0">
            <p className="text-sm font-bold leading-snug text-[#164270]">
              Simulated verification
            </p>
            <p className="jvk-kiosk-meta-text mt-0.5 text-[#225689]">
              Use only the synthetic identifier shown below. No message will be sent.
            </p>
          </div>
        </div>
      ) : (
        <InlineBanner title="Simulated verification">
          Use only the synthetic identifier shown below. No message will be sent.
        </InlineBanner>
      )}

      <fieldset disabled={pending || Boolean(challenge)} className="space-y-3">
        <legend className="text-xs font-semibold uppercase tracking-wide text-[#4B5D57]">
          Verification method
        </legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {(["abha", "mobile"] as const).map((choice) => {
            const active = method === choice;
            return (
              <label
                key={choice}
                className={`flex min-h-12 items-center gap-2.5 rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors cursor-pointer ${
                  active
                    ? "border-[#047C61] bg-[#EDF7F1] text-[#0E2420]"
                    : "border-[#DFE5DC] bg-white text-[#2F453E] hover:border-[#8DC5B1] hover:bg-[#F5FAF7]"
                }`}
              >
                <input
                  type="radio"
                  name={`identity-${purpose}`}
                  checked={active}
                  onChange={() => {
                    setMethod(choice);
                    setValue("");
                    setError("");
                  }}
                  className="size-4 accent-[#047C61]"
                />
                <span>{choice === "abha" ? "14-digit ABHA" : "Mobile number"}</span>
              </label>
            );
          })}
        </div>

        <div className="space-y-1.5">
          <Label
            htmlFor={`patient-identity-${purpose}`}
            className="text-xs font-semibold text-[#182E29]"
          >
            {method === "abha" ? "ABHA number" : "Mobile number"}
          </Label>
          <AuthInput
            id={`patient-identity-${purpose}`}
            icon={
              isKiosk
                ? method === "abha"
                  ? CreditCard
                  : Smartphone
                : undefined
            }
            inputMode="numeric"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="next"
            placeholder={
              method === "abha"
                ? "Enter 14-digit ABHA number"
                : "Enter 10-digit mobile number"
            }
            pattern={method === "abha" ? "[0-9]{14}" : "[0-9]{10}"}
            maxLength={method === "abha" ? 14 : 10}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            required
          />
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={() => setValue(demoPatientIdentity[method])}
          className={
            isKiosk
              ? "jvk-kiosk-compact-btn h-10 rounded-xl border-[#DCE6D9] bg-[#EDF3EB] px-4 text-[13.5px] font-semibold text-[#056851] hover:bg-[#E1EDE0]"
              : "h-9 rounded-xl border-[#C6D5CE] bg-[#FAF8F2] text-xs font-semibold text-[#047C61] hover:bg-[#E7F2E8]"
          }
        >
          Use synthetic identifier
        </Button>
      </fieldset>

      {challenge && (
        <div className="space-y-2 rounded-xl border border-[#CBE2D4] bg-[#EEF8F3] p-3.5">
          <p role="status" className="text-xs font-medium text-[#182E29]">
            Demo verification code{" "}
            <strong className="font-bold text-[#047C61]">{challenge.demoCode}</strong>
          </p>
          <Label
            htmlFor={`patient-otp-${purpose}`}
            className="text-xs font-semibold text-[#182E29]"
          >
            Verification code
          </Label>
          <AuthInput
            id={`patient-otp-${purpose}`}
            inputMode="numeric"
            autoComplete="one-time-code"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="done"
            placeholder="Enter 6-digit code"
            minLength={6}
            maxLength={6}
            pattern="[0-9]{6}"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            required
          />
        </div>
      )}

      {error && <InlineBanner tone="critical" title={error} />}

      <div className="space-y-2.5">
        <div className="flex flex-wrap gap-2.5">
          <AuthSubmitButton loading={pending} loadingText="Please wait…">
            <span>{challenge ? "Verify code" : "Request demo code"}</span>
            <ArrowRight aria-hidden="true" className="size-4" />
          </AuthSubmitButton>
          {challenge && (
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => {
                setChallenge(undefined);
                setCode("");
                setError("");
              }}
              className="h-10 w-full rounded-xl border-[#D8D3C6] bg-[#FAF8F2] text-[#182E29] hover:bg-[#EFECE3]"
            >
              Start again
            </Button>
          )}
        </div>
        {secondaryActions}
      </div>
    </form>
  );
}

export function PatientSignIn({
  mode = "sign-in",
}: {
  mode?: "sign-in" | "register" | "reset";
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const next = patientReturnPath(location.state?.from);
  const [passwordMode, setPasswordMode] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const values = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    try {
      const { token } = await patientRequest<{ token: string }>(
        "/auth/patient/login",
        {
          method: "POST",
          body: {
            identifier: values.get("identifier"),
            password: values.get("password"),
          },
        },
      );
      setPatientToken(token);
      navigate(next, { replace: true });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Sign-in failed.");
    } finally {
      setPending(false);
    }
  }

  const cardContent = (
    <AuthFormCard className="p-6 sm:p-8">
      <div className="text-center space-y-2 mb-6">
        <div className="mx-auto inline-flex size-12 items-center justify-center rounded-full border border-[#D4E7DC] bg-[#E7F2E8] text-[#047C61]">
          <User aria-hidden="true" className="size-5" />
        </div>
        <h1 data-jvk-entrance="right" className="text-2xl font-bold tracking-tight text-[#0E2420]">
          {mode === "register"
            ? "Patient Registration"
            : mode === "reset"
              ? "Reset Patient Password"
              : "Patient Sign-In"}
        </h1>
        <p className="text-xs sm:text-[13px] text-[#53655F]">
          {mode === "register"
            ? "Verify your synthetic trial identity or contact your clinic"
            : mode === "reset"
              ? "Account recovery guidance for JEEVIKA patients"
              : "Access your JEEVIKA health account"}
        </p>
      </div>

      <div className="space-y-4">
        {mode === "register" && (
          <InlineBanner title="Registration availability">
            Self-registration is available for the synthetic trial identity.
            Contact the clinic to register a real patient account.
          </InlineBanner>
        )}
        {mode === "reset" && (
          <InlineBanner title="Password reset unavailable">
            OTP accounts are passwordless. For a password-based account, contact
            your clinic to recover access.
          </InlineBanner>
        )}

        {mode !== "reset" &&
          (passwordMode ? (
            <form
              className="space-y-4"
              onSubmit={(event) => void login(event)}
            >
              <div className="space-y-1.5">
                <Label
                  htmlFor="patient-password-id"
                  className="text-xs font-semibold text-[#182E29]"
                >
                  Registered Email or Mobile Number
                </Label>
                <AuthInput
                  id="patient-password-id"
                  name="identifier"
                  icon={Mail}
                  placeholder="Enter your email or mobile number"
                  required
                  autoComplete="username"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="patient-password"
                    className="text-xs font-semibold text-[#182E29]"
                  >
                    Password
                  </Label>
                  {mode === "sign-in" && (
                    <Link
                      className="text-xs font-semibold text-[#047C61] hover:text-[#035442] hover:underline"
                      to="/home/reset-password"
                    >
                      Forgot Password?
                    </Link>
                  )}
                </div>
                <AuthPasswordInput
                  id="patient-password"
                  name="password"
                  icon={Lock}
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
                />
              </div>

              {error && <InlineBanner tone="critical" title={error} />}

              <AuthSubmitButton loading={pending} loadingText="Signing in…">
                <span>Sign in with password</span>
                <ArrowRight aria-hidden="true" className="size-4" />
              </AuthSubmitButton>
            </form>
          ) : (
            <IdentityVerification
              purpose="home"
              onVerified={({ token }) => {
                if (token) {
                  setPatientToken(token);
                  navigate(next, { replace: true });
                }
              }}
            />
          ))}

        {mode === "sign-in" && (
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPasswordMode((value) => !value)}
              className="h-10 w-full rounded-xl border-[#D8D3C6] bg-[#FAF8F2] text-xs font-semibold text-[#182E29] hover:bg-[#EFECE3]"
            >
              {passwordMode
                ? "Use verification code"
                : "Use an existing password"}
            </Button>

            <div className="relative flex items-center py-1">
              <div className="flex-grow border-t border-[#EAE6DC]" />
              <span className="mx-3 shrink text-xs font-medium text-[#6A7B75]">
                New to JEEVIKA?
              </span>
              <div className="flex-grow border-t border-[#EAE6DC]" />
            </div>

            <Link
              to="/home/register"
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#BBD8CC] bg-[#FFFDF9] px-4 text-sm font-semibold text-[#047C61] transition-colors hover:bg-[#EEF8F3]"
            >
              <UserPlus aria-hidden="true" className="size-4" />
              <span>Create Patient Account</span>
            </Link>
          </>
        )}

        {mode !== "sign-in" && (
          <div className="pt-2 text-center">
            <Link
              className="text-xs font-semibold text-[#047C61] hover:underline"
              to="/home/sign-in"
            >
              Back to Patient sign-in
            </Link>
          </div>
        )}
      </div>
    </AuthFormCard>
  );

  // Secondary intermediate screens (register / reset) stay clean & compact without repeating the large illustration
  if (mode !== "sign-in") {
    return (
      <div className="flex flex-1 flex-col justify-between">
        <main
          id="public-main"
          tabIndex={-1}
          className="mx-auto flex w-full max-w-lg flex-1 items-center px-4 py-10 focus:outline-none"
        >
          <div className="w-full">{cardContent}</div>
        </main>
        <AuthDecorativeWave />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col justify-between overflow-x-clip">
      <main
        id="public-main"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-7xl flex-1 items-center px-4 pt-6 pb-2 sm:px-6 lg:px-8 lg:pt-8 focus:outline-none"
      >
        <div className="grid w-full grid-cols-1 items-center gap-8 lg:grid-cols-12 lg:gap-10">
          {/* Left Column on Desktop: Editorial Headline, Benefits Strip & Patient Illustration */}
          <div className="order-2 lg:order-1 lg:col-span-7 relative space-y-5">
            <img
              src="/assets/auth/botanical-sprig.png"
              alt=""
              aria-hidden="true"
              width={132}
              height={118}
              style={{
                WebkitMaskImage:
                  "radial-gradient(ellipse at 65% 45%, #000 35%, transparent 74%)",
                maskImage:
                  "radial-gradient(ellipse at 65% 45%, #000 35%, transparent 74%)",
              }}
              className="pointer-events-none hidden lg:block absolute -top-2 right-2 h-28 w-auto select-none opacity-90 mix-blend-multiply"
            />

            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#EBE1CC] bg-[#F5EFE2] px-3.5 py-1.5 text-xs font-semibold text-[#233731]">
                <span aria-hidden="true" className="size-2 rounded-full bg-[#047C61]" />
                <span>Welcome to JEEVIKA</span>
              </div>

              <h2
                data-jvk-entrance="left"
                className="font-bold tracking-tight text-[#0E2420] leading-[1.08]"
                style={{ fontSize: "clamp(2.1rem, 3.4vw, 3.25rem)" }}
              >
                Your health,
                <br />
                always{" "}
                <span className="relative inline-block jeevika-serif-italic pr-1">
                  connected.
                  <GoldUnderline className="absolute -bottom-1 left-0 h-2.5 w-full" />
                </span>
              </h2>

              <p className="max-w-xl text-[14.5px] sm:text-[15.5px] leading-relaxed text-[#435650]">
                Sign in to access your health records, prescriptions, daily
                check-ins, and personalized care journey — all in one place.
              </p>
            </div>

            <AuthBenefitsStrip items={PATIENT_BENEFITS} />

            <AuthIllustrationPanel
              src="/assets/auth/patient-care-journey.png"
              alt="Clinician reviewing care plan on a tablet with a smiling elderly couple near a rural health clinic"
              width={615}
              height={238}
              className="mx-auto max-w-2xl lg:max-w-none"
            />
          </div>

          {/* Right Column on Desktop (First on Mobile): Patient Sign-In Card */}
          <div className="order-1 lg:order-2 lg:col-span-5">{cardContent}</div>
        </div>
      </main>
      <AuthDecorativeWave />
    </div>
  );
}
