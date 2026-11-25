import { useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  Input,
  Label,
} from "@/components/ui/basic";
import { InlineBanner } from "@/components/ui/design-primitives";
import { demoPatientIdentity } from "../../../../packages/shared/patient-experience";
import {
  patientRequest,
  setPatientToken,
  usePatientData,
} from "@/lib/patientApi";

type Challenge = { id: string; demoCode: string };
type IdentityMethod = keyof typeof demoPatientIdentity;

export function IdentityVerification({
  purpose,
  onVerified,
  initialAbha = "",
}: {
  purpose: "home" | "kiosk";
  onVerified: (result: { token?: string; verifiedIdentityId?: string }) => void;
  initialAbha?: string;
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
  if (!data) return <p role="status">Checking verification availability…</p>;
  if (!data.demoOtp)
    return (
      <InlineBanner tone="warning" title="OTP verification is unavailable">
        Contact the clinic for help accessing your patient account.
      </InlineBanner>
    );
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => void submit(event)}
      aria-label="Patient identity verification"
    >
      <InlineBanner title="Simulated verification">
        Use only the synthetic identifier shown below. No message will be sent.
      </InlineBanner>
      <fieldset disabled={pending || Boolean(challenge)} className="space-y-3">
        <legend className="font-semibold">Verification method</legend>
        <div className="flex flex-wrap gap-3">
          {(["abha", "mobile"] as const).map((choice) => (
            <label
              className="flex min-h-12 items-center gap-2 rounded-lg border px-4"
              key={choice}
            >
              <input
                type="radio"
                name={`identity-${purpose}`}
                checked={method === choice}
                onChange={() => {
                  setMethod(choice);
                  setValue("");
                  setError("");
                }}
              />
              {choice === "abha" ? "14-digit ABHA" : "Mobile number"}
            </label>
          ))}
        </div>
        <Label htmlFor={`patient-identity-${purpose}`}>
          {method === "abha" ? "ABHA number" : "Mobile number"}
        </Label>
        <Input
          id={`patient-identity-${purpose}`}
          inputMode="numeric"
          autoComplete="off"
          pattern={method === "abha" ? "[0-9]{14}" : "[0-9]{10}"}
          maxLength={method === "abha" ? 14 : 10}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          required
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => setValue(demoPatientIdentity[method])}
        >
          Use synthetic identifier
        </Button>
      </fieldset>
      {challenge && (
        <div className="space-y-2">
          <p role="status">
            Demo verification code <strong>{challenge.demoCode}</strong>
          </p>
          <Label htmlFor={`patient-otp-${purpose}`}>Verification code</Label>
          <Input
            id={`patient-otp-${purpose}`}
            inputMode="numeric"
            autoComplete="one-time-code"
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
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending
            ? "Please wait…"
            : challenge
              ? "Verify code"
              : "Request demo code"}
        </Button>
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
          >
            Start again
          </Button>
        )}
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
  const rawFrom = (
    location.state as { from?: string | { pathname?: string } } | null
  )?.from;
  const requestedRoute = typeof rawFrom === "string" ? rawFrom : rawFrom?.pathname;
  const next =
    typeof requestedRoute === "string" && requestedRoute.startsWith("/app/home/")
      ? requestedRoute
      : "/app/home/thread";
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

  return (
    <main id="public-main" tabIndex={-1} className="mx-auto max-w-xl px-4 py-8">
      <Card>
        <CardHeader>
          <h1 className="text-2xl font-bold">
            {mode === "register"
              ? "Patient registration"
              : mode === "reset"
                ? "Reset patient password"
                : "Patient sign-in"}
          </h1>
        </CardHeader>
        <CardContent className="space-y-4">
          {mode === "register" && (
            <InlineBanner title="Registration availability">
              Self-registration is available for the synthetic trial identity.
              Contact the clinic to register a real patient account.
            </InlineBanner>
          )}
          {mode === "reset" && (
            <InlineBanner title="Password reset unavailable">
              OTP accounts are passwordless. For a password-based account,
              contact your clinic to recover access.
            </InlineBanner>
          )}
          {mode !== "reset" &&
            (passwordMode ? (
              <form
                className="space-y-3"
                onSubmit={(event) => void login(event)}
              >
                <Label htmlFor="patient-password-id">
                  Mobile number or email
                </Label>
                <Input
                  id="patient-password-id"
                  name="identifier"
                  required
                  autoComplete="username"
                />
                <Label htmlFor="patient-password">Password</Label>
                <Input
                  id="patient-password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                />
                {error && <InlineBanner tone="critical" title={error} />}
                <Button type="submit" disabled={pending}>
                  Sign in with password
                </Button>
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
            <Button
              variant="outline"
              onClick={() => setPasswordMode((value) => !value)}
            >
              {passwordMode
                ? "Use verification code"
                : "Use an existing password"}
            </Button>
          )}
          <div className="flex flex-wrap gap-4 text-sm">
            {mode !== "sign-in" && (
              <Link className="underline" to="/home/sign-in">
                Patient sign-in
              </Link>
            )}
            {mode === "sign-in" && (
              <Link className="underline" to="/home/register">
                Patient registration
              </Link>
            )}
            {mode === "sign-in" && passwordMode && (
              <Link className="underline" to="/home/reset-password">
                Forgot password?
              </Link>
            )}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
