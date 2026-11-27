"use client";

import { type FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Lock, Mail } from "lucide-react";
import { Label } from "@/components/ui/basic";
import { InlineBanner } from "@/components/ui/design-primitives";
import { patientRequest, usePatientData } from "@/lib/patientApi";
import {
  AuthFormCard,
  AuthHeader,
  AuthInput,
  AuthLayout,
  AuthPasswordInput,
  AuthSubmitButton,
} from "@/components/auth/AuthShell";

export function PasswordRecoveryForm({ account }: { account: "staff" | "patient" }) {
  const { data, error: availabilityError } = usePatientData<{ available: boolean }>("/auth/password-reset/capabilities", 0, false);
  const [confirming, setConfirming] = useState(false);
  const [finished, setFinished] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const orgId = account === "staff"
    ? import.meta.env.VITE_STAFF_ORG_ID || "demo"
    : import.meta.env.VITE_PATIENT_ORG_ID || "org_default";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const fields = new FormData(event.currentTarget);
    const password = fields.get("password");
    if (confirming && password !== fields.get("passwordConfirmation")) {
      setError("Enter the same password in both fields.");
      return;
    }
    setError("");
    setPending(true);
    try {
      const result = await patientRequest<{ message: string }>(
        `/auth/password-reset/${confirming ? "confirm" : "request"}`,
        { method: "POST", body: confirming
          ? { account, orgId, token: String(fields.get("token") ?? "").trim(), password }
          : { account, orgId, email: fields.get("email") } },
      );
      setMessage(result.message);
      if (confirming) setFinished(true);
      else setConfirming(true);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Password recovery is unavailable.");
    } finally {
      setPending(false);
    }
  }

  if (availabilityError || data?.available === false) return (
    <InlineBanner title="Password recovery unavailable">
      Contact your clinic for account recovery.
    </InlineBanner>
  );
  if (!data) return <p role="status" className="text-xs text-[#53655F]">Checking recovery availability…</p>;
  return (
    <div className="space-y-4">
      {message && <p role="status" className="text-xs text-[#53655F]">{message}</p>}
      {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
      {!finished && (
        <form onSubmit={(event) => void submit(event)} className="space-y-4">
          {confirming ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="recovery-code" className="text-xs font-semibold text-[#182E29]">Reset code</Label>
                <AuthInput id="recovery-code" name="token" autoComplete="one-time-code" required maxLength={72} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reset-new-password" className="text-xs font-semibold text-[#182E29]">New Password</Label>
                <AuthPasswordInput id="reset-new-password" name="password" icon={Lock}
                  autoComplete="new-password" required minLength={12} maxLength={128} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reset-confirm-password" className="text-xs font-semibold text-[#182E29]">Confirm Password</Label>
                <AuthPasswordInput id="reset-confirm-password" name="passwordConfirmation" icon={Lock}
                  autoComplete="new-password" required minLength={12} maxLength={128} />
              </div>
            </>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="recovery-email" className="text-xs font-semibold text-[#182E29]">Verified recovery email</Label>
              <AuthInput id="recovery-email" name="email" icon={Mail} type="email" autoComplete="email" required maxLength={254} />
            </div>
          )}
          <AuthSubmitButton loading={pending} loadingText={confirming ? "Updating…" : "Requesting…" }>
            <CheckCircle2 aria-hidden="true" className="size-4" />
            <span>{confirming ? "Update Password" : "Request reset code"}</span>
          </AuthSubmitButton>
        </form>
      )}
    </div>
  );
}

export function ResetPasswordPage() {
  return (
    <AuthLayout header={<AuthHeader variant="compact" />}>
      <div className="mx-auto w-full max-w-md px-4 py-10">
        <AuthFormCard className="p-6 sm:p-8">
          <div className="text-center space-y-2.5 mb-6">
            <div className="mx-auto inline-flex size-12 items-center justify-center rounded-full border border-[#D4E7DC] bg-[#E7F2E8] text-[#047C61]">
              <Lock aria-hidden="true" className="size-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[#0E2420]">Reset Password</h1>
            <p className="text-xs sm:text-sm text-[#53655F]">Recover access to your staff account.</p>
          </div>
          <PasswordRecoveryForm account="staff" />
          <div className="mt-5 text-center">
            <Link to="/login" className="text-xs font-semibold text-[#53655F] hover:text-[#0E2420] hover:underline">
              Cancel &amp; Return to Sign-In
            </Link>
          </div>
        </AuthFormCard>
      </div>
    </AuthLayout>
  );
}
