import { useState } from "react";
import { useLocation } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  Lock,
  Mail,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/basic";
import { useToast } from "@/components/ui/use-toast";
import { authService as auth } from "@/lib/authService";
import { landingRoute } from "@/lib/rbac";
import {
  AuthBenefitsStrip,
  AuthFormCard,
  AuthHeader,
  AuthIllustrationPanel,
  AuthInput,
  AuthLayout,
  AuthPasswordInput,
  AuthSecurityNotice,
  AuthSubmitButton,
  GoldUnderline,
  type AuthBenefitItem,
} from "@/components/auth/AuthShell";

const STAFF_BENEFITS: AuthBenefitItem[] = [
  { icon: Building2, title: "Unified hospital operations" },
  { icon: Users, title: "Role-based secure access" },
  { icon: ShieldCheck, title: "Built for clinical excellence" },
];

export function LoginPage() {
  const [isForgotMode, setIsForgotMode] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [manualLoading, setManualLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const location = useLocation();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setManualLoading(true);
    setError(null);

    try {
      if (isForgotMode) {
        await auth.resetPassword(email);
        toast({
          title: "Recovery Link Sent",
          description: "Check your email for the password reset link.",
          className: "bg-green-50 border-green-200 text-green-900",
        });
        setIsForgotMode(false);
      } else {
        const user = await auth.signIn(email.trim(), password);
        const from = location.state?.from;
        const target = /^\/app(?:\/|$)/.test(from?.pathname ?? "")
          ? from.pathname + (from.search ?? "") + (from.hash ?? "")
          : landingRoute(user.role);
        toast({
          title: "Authentication Successful",
          description: `Signed in as ${email}. Entering workspace...`,
          className: "bg-emerald-50 border-emerald-200 text-emerald-900",
        });
        window.location.hash = `#${target}`;
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred";
      console.error("Auth Error:", err);
      setError(message);
      toast({
        title: "Authentication Failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setManualLoading(false);
    }
  };

  return (
    <AuthLayout
      header={<AuthHeader variant="staff" />}
      footer={<AuthSecurityNotice />}
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12 lg:gap-10">
          {/* Left Column on Desktop: Staff Watercolor Illustration + Tagline + Benefits */}
          <div className="order-2 lg:order-1 lg:col-span-7 space-y-5">
            <AuthIllustrationPanel
              src="/assets/auth/staff-consultation.png"
              alt="Clinician consulting an elderly patient and family member in a sunlit clinic"
              width={535}
              height={335}
              className="mx-auto max-w-2xl lg:max-w-none"
            />

            <div className="text-center lg:text-left space-y-1.5 px-1">
              <p
                className="font-serif italic font-semibold tracking-tight text-[#0E2420]"
                style={{ fontSize: "clamp(1.65rem, 2.5vw, 2.35rem)" }}
              >
                Care that stays with people.
              </p>
              <p className="relative inline-block text-sm sm:text-base font-medium text-[#4A5D57] pb-1.5">
                The JEEVIKA Hospital Operating System
                <GoldUnderline className="absolute bottom-0 left-0 h-2 w-40 opacity-80" />
              </p>
            </div>

            <AuthBenefitsStrip items={STAFF_BENEFITS} />
          </div>

          {/* Right Column on Desktop (First on Mobile): Protected Staff Sign-In Card */}
          <div className="order-1 lg:order-2 lg:col-span-5">
            <AuthFormCard className="p-6 sm:p-8">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#CBE2D4] bg-[#E7F2E8] px-3 py-1 text-[11px] font-bold tracking-[0.06em] uppercase text-[#047C61]">
                  <ShieldCheck aria-hidden="true" className="size-3.5" />
                  <span>Protected Clinical Access</span>
                </div>

                <h1 className="text-2xl sm:text-[1.85rem] font-extrabold tracking-tight text-[#0E2420] leading-tight">
                  Staff Sign-In to{" "}
                  <span className="relative inline-block">
                    JEEVIKA
                    <GoldUnderline className="absolute -bottom-1 left-0 h-2 w-full" />
                  </span>
                </h1>

                <p className="text-[13px] leading-relaxed text-[#4E605A]">
                  Access hospital headquarters, OPD clinician cockpits, inpatient
                  ward SOS, casualty triage sentry, or pharmacy POS terminals.
                </p>
              </div>

              {error && (
                <Alert
                  variant="destructive"
                  className="mt-4 bg-red-50 border-red-200 text-red-800 rounded-xl"
                >
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="mt-5 rounded-2xl border border-[#EAE6DC] bg-[#FAF8F2]/70 p-5 sm:p-6">
                <div className="text-center space-y-1.5 mb-5">
                  <div className="mx-auto inline-flex size-11 items-center justify-center rounded-full border border-[#D4E7DC] bg-[#E7F2E8] text-[#047C61]">
                    <Lock aria-hidden="true" className="size-5" />
                  </div>
                  <h2 className="text-base font-bold text-[#0E2420]">
                    {isForgotMode ? "Reset Password" : "Staff Credential Sign-In"}
                  </h2>
                  <p className="text-xs text-[#556761]">
                    {isForgotMode
                      ? "Enter registered email to receive password reset link"
                      : "Enter authorized email and password to access hospital workspace"}
                  </p>
                </div>

                <form onSubmit={handleAuth} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="staff-email"
                      className="text-xs font-semibold text-[#182E29]"
                    >
                      Staff Email
                    </Label>
                    <AuthInput
                      id="staff-email"
                      type="email"
                      icon={Mail}
                      autoComplete="username"
                      placeholder="doctor@jeevika.in"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>

                  {!isForgotMode && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label
                          htmlFor="staff-password"
                          className="text-xs font-semibold text-[#182E29]"
                        >
                          Password
                        </Label>
                        <button
                          type="button"
                          onClick={() => {
                            setError(null);
                            setIsForgotMode(true);
                          }}
                          className="text-xs font-semibold text-[#047C61] hover:text-[#035442] hover:underline cursor-pointer"
                        >
                          Forgot Password?
                        </button>
                      </div>
                      <AuthPasswordInput
                        id="staff-password"
                        icon={Lock}
                        autoComplete="current-password"
                        placeholder="Enter security password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={6}
                      />
                    </div>
                  )}

                  <AuthSubmitButton
                    loading={manualLoading}
                    loadingText={
                      isForgotMode
                        ? "Sending Recovery Link..."
                        : "Authenticating..."
                    }
                  >
                    <span>
                      {isForgotMode
                        ? "Send Recovery Link"
                        : "Sign In with Credentials"}
                    </span>
                    <ArrowRight aria-hidden="true" className="size-4" />
                  </AuthSubmitButton>

                  {isForgotMode && (
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setIsForgotMode(false);
                      }}
                      className="w-full pt-1 text-center text-xs font-semibold text-[#53655F] hover:text-[#0E2420] cursor-pointer"
                    >
                      Return to Sign In
                    </button>
                  )}
                </form>
              </div>
            </AuthFormCard>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
}
