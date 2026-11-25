"use client";

import { useState } from "react";
import { CheckCircle2, Lock } from "lucide-react";
import { Label } from "@/components/ui/basic";
import { useToast } from "@/components/ui/use-toast";
import { useHospital } from "../context/HospitalContext";
import {
  AuthFormCard,
  AuthHeader,
  AuthLayout,
  AuthPasswordInput,
  AuthSubmitButton,
} from "@/components/auth/AuthShell";

export function ResetPasswordPage() {
  const { updateUserPassword, setIsPasswordRecovery } = useHospital();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast({
        title: "Passwords Mismatch",
        description: "Please ensure both passwords match.",
        variant: "destructive",
      });
      return;
    }
    if (password.length < 6) {
      toast({
        title: "Weak Password",
        description: "Password must be at least 6 characters.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      await updateUserPassword(password);
      toast({
        title: "Password Updated",
        description:
          "Your password has been changed successfully. You can now login.",
        className: "bg-green-50 border-green-200 text-green-900",
      });
      setIsPasswordRecovery(false);
      window.location.href =
        window.location.origin + window.location.pathname + "#/login";
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Password update failed.";
      toast({
        title: "Update Failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout header={<AuthHeader variant="compact" />}>
      <div className="mx-auto w-full max-w-md px-4 py-10">
        <AuthFormCard className="p-6 sm:p-8">
          <div className="text-center space-y-2.5 mb-6">
            <div className="mx-auto inline-flex size-12 items-center justify-center rounded-full border border-[#D4E7DC] bg-[#E7F2E8] text-[#047C61]">
              <Lock aria-hidden="true" className="size-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[#0E2420]">
              Reset Password
            </h1>
            <p className="text-xs sm:text-sm text-[#53655F]">
              Enter your new password below.
            </p>
          </div>

          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="space-y-1.5">
              <Label
                htmlFor="reset-new-password"
                className="text-xs font-semibold text-[#182E29]"
              >
                New Password
              </Label>
              <AuthPasswordInput
                id="reset-new-password"
                icon={Lock}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="Enter new password"
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="reset-confirm-password"
                className="text-xs font-semibold text-[#182E29]"
              >
                Confirm Password
              </Label>
              <AuthPasswordInput
                id="reset-confirm-password"
                icon={Lock}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                placeholder="Confirm new password"
              />
            </div>

            <AuthSubmitButton loading={loading} loadingText="Updating...">
              <CheckCircle2 aria-hidden="true" className="size-4" />
              <span>Update Password</span>
            </AuthSubmitButton>
          </form>

          <div className="mt-5 text-center">
            <button
              type="button"
              onClick={() => {
                setIsPasswordRecovery(false);
                window.location.hash = "#/login";
              }}
              className="text-xs font-semibold text-[#53655F] hover:text-[#0E2420] hover:underline cursor-pointer"
            >
              Cancel &amp; Return to Sign-In
            </button>
          </div>
        </AuthFormCard>
      </div>
    </AuthLayout>
  );
}
