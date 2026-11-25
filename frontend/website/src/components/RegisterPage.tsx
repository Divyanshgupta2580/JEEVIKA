import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, CheckCircle2, Lock, Mail, ShieldCheck, UserPlus } from "lucide-react";
import { Label } from "@/components/ui/basic";
import { useToast } from "@/components/ui/use-toast";
import { authService as auth } from "@/lib/authService";
import {
  AuthFormCard,
  AuthHeader,
  AuthInput,
  AuthLayout,
  AuthPasswordInput,
  AuthSubmitButton,
} from "@/components/auth/AuthShell";

export function RegisterPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const plan = searchParams.get("plan") || "free";
  const billing = searchParams.get("billing") || "monthly";

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await auth.signUp(email, password, {
        full_name: fullName,
        onboarding_plan: plan,
        onboarding_billing: billing,
        role: "HOSPITAL_ADMIN",
      });

      setSuccess(true);
      toast({
        title: "Account Created",
        description: "Please check your email to verify your account.",
        className: "bg-green-50 border-green-200 text-green-900",
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Registration failed.";
      console.error("Registration Error:", err);
      toast({
        title: "Registration Failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <AuthLayout header={<AuthHeader variant="compact" />}>
        <div className="mx-auto w-full max-w-md px-4 py-10">
          <AuthFormCard className="p-8 text-center">
            <div className="mx-auto mb-5 inline-flex size-16 items-center justify-center rounded-full border border-[#CBE2D4] bg-[#E7F2E8] text-[#047C61]">
              <CheckCircle2 aria-hidden="true" className="size-8" />
            </div>
            <h1 className="text-2xl font-bold text-[#0E2420] mb-2">
              Check Your Email
            </h1>
            <p className="text-sm text-[#4B5D57] leading-relaxed mb-7">
              We&apos;ve sent a verification link to{" "}
              <span className="font-semibold text-[#0E2420]">{email}</span>.
              Once verified, you can complete your hospital setup.
            </p>
            <AuthSubmitButton type="button" onClick={() => navigate("/login")}>
              <span>Go to Sign-In</span>
              <ArrowRight aria-hidden="true" className="size-4" />
            </AuthSubmitButton>
          </AuthFormCard>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout header={<AuthHeader variant="compact" />}>
      <div className="mx-auto w-full max-w-lg px-4 py-8 sm:py-10">
        <AuthFormCard className="p-6 sm:p-8">
          <div className="text-center space-y-2.5 mb-6">
            <div className="mx-auto inline-flex size-12 items-center justify-center rounded-full border border-[#D4E7DC] bg-[#E7F2E8] text-[#047C61]">
              <UserPlus aria-hidden="true" className="size-5" />
            </div>
            <h1 className="text-2xl sm:text-[1.75rem] font-extrabold tracking-tight text-[#0E2420]">
              Organization Onboarding
            </h1>
            <p className="text-xs sm:text-sm text-[#53655F] flex flex-wrap items-center justify-center gap-2">
              <span>Setting up for</span>
              <span className="rounded-md bg-[#E7F2E8] px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-[#047C61]">
                {plan}
              </span>
              <span aria-hidden="true" className="text-[#D0CBBF]">
                |
              </span>
              <span className="capitalize">{billing} Billing</span>
            </p>
          </div>

          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-1.5">
              <Label
                htmlFor="fullName"
                className="text-xs font-semibold text-[#182E29]"
              >
                Full Name
              </Label>
              <AuthInput
                id="fullName"
                type="text"
                placeholder="Consultant Physician"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="email"
                className="text-xs font-semibold text-[#182E29]"
              >
                Work Email
              </Label>
              <AuthInput
                id="email"
                type="email"
                icon={Mail}
                autoComplete="email"
                placeholder="doctor@jeevika.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="password"
                className="text-xs font-semibold text-[#182E29]"
              >
                Create Password
              </Label>
              <AuthPasswordInput
                id="password"
                icon={Lock}
                autoComplete="new-password"
                placeholder="Create a secure password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
              <p className="text-[11px] text-[#667771]">
                At least 8 characters long
              </p>
            </div>

            <div className="pt-2">
              <AuthSubmitButton
                loading={loading}
                loadingText="Creating Account..."
              >
                <span>Create My Account</span>
                <ArrowRight aria-hidden="true" className="size-4" />
              </AuthSubmitButton>
            </div>
          </form>

          <div className="mt-6 border-t border-[#EAE6DC] pt-5 text-center space-y-2.5">
            <div className="inline-flex items-center justify-center gap-1.5 text-xs font-medium text-[#4B5D57]">
              <ShieldCheck aria-hidden="true" className="size-4 text-[#047C61]" />
              <span>Role-based &amp; tenant-isolated staff provisioning</span>
            </div>
            <p className="text-xs text-[#53655F]">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="font-semibold text-[#047C61] hover:underline cursor-pointer"
              >
                Sign In
              </button>
            </p>
          </div>
        </AuthFormCard>
      </div>
    </AuthLayout>
  );
}
