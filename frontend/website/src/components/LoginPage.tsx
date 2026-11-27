import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/basic";
import { useToast } from "@/components/ui/use-toast";
import { authService as auth } from "@/lib/authService";
import { staffReturnPath } from "@/lib/rbac";
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

interface DemoStaffAccount {
  id: string;
  label: string;
  email: string;
}

const DEMO_EVALUATOR_CREDENTIAL = ["Dhaaga", "demo", "2026!"].join("-");

const DEMO_STAFF_ACCOUNTS: readonly DemoStaffAccount[] = [
  { id: "DOCTOR", label: "Doctor (OPD)", email: "doctor@demo.test" },
  { id: "HOSPITAL_ADMIN", label: "Admin", email: "admin@demo.test" },
  { id: "NURSE", label: "Nurse (IPD)", email: "nurse@demo.test" },
  { id: "STAT_NURSE", label: "STAT Nurse", email: "stat-nurse@demo.test" },
  { id: "CLINIC_ADMIN", label: "Clinic Admin", email: "clinic-admin@demo.test" },
  { id: "CASHIER", label: "Cashier (POS)", email: "cashier@demo.test" },
];

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [filledDemoAccount, setFilledDemoAccount] =
    useState<DemoStaffAccount | null>(null);
  const [manualLoading, setManualLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  const fillDemoCredentials = (account: DemoStaffAccount) => {
    setError(null);
    setEmail(account.email);
    setPassword(DEMO_EVALUATOR_CREDENTIAL);
    setFilledDemoAccount(account);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setManualLoading(true);
    setError(null);

    try {
      const user = await auth.signIn(email.trim(), password);
      toast({
        title: "Authentication Successful",
        description: `Signed in as ${email}. Entering workspace...`,
        className: "bg-emerald-50 border-emerald-200 text-emerald-900",
      });
      navigate(staffReturnPath(location.state?.from, user.role), { replace: true });
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
          {/* Left Column: Staff Watercolor Illustration + Tagline + Benefits (First on Mobile & Left on Desktop) */}
          <div data-jvk-entrance="left" className="lg:col-span-7 space-y-5">
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

          {/* Right Column: Protected Staff Sign-In Card (Second on Mobile & Right on Desktop) */}
          <div className="lg:col-span-5">
            <AuthFormCard className="p-6 sm:p-8">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#CBE2D4] bg-[#E7F2E8] px-3 py-1 text-[11px] font-bold tracking-[0.06em] uppercase text-[#047C61]">
                  <ShieldCheck aria-hidden="true" className="size-3.5" />
                  <span>Protected Clinical Access</span>
                </div>

                <h1 data-jvk-entrance="right" className="text-2xl sm:text-[1.85rem] font-extrabold tracking-tight text-[#0E2420] leading-tight">
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
                    Staff Credential Sign-In
                  </h2>
                  <p className="text-xs text-[#556761]">
                    Enter authorized email and password to access hospital workspace
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
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setFilledDemoAccount(null);
                      }}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label
                      htmlFor="staff-password"
                      className="text-xs font-semibold text-[#182E29]"
                    >
                      Password
                    </Label>
                    <AuthPasswordInput
                      id="staff-password"
                      icon={Lock}
                      autoComplete="current-password"
                      placeholder="Enter security password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setFilledDemoAccount(null);
                      }}
                      required
                      minLength={6}
                    />
                  </div>

                  <AuthSubmitButton
                    loading={manualLoading}
                    loadingText="Authenticating..."
                  >
                    <span>Sign In with Credentials</span>
                    <ArrowRight aria-hidden="true" className="size-4" />
                  </AuthSubmitButton>

                  <Link to="/reset-password" className="block text-center text-xs font-semibold text-[#047C61] hover:underline">
                    Forgot password?
                  </Link>

                  <div className="pt-2 space-y-2.5 border-t border-[#E6E0D3]">
                    <button
                      type="button"
                      onClick={() => fillDemoCredentials(DEMO_STAFF_ACCOUNTS[0])}
                      className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#BBD8CC] bg-[#FFFDF9] px-4 text-xs font-semibold text-[#047C61] transition-colors hover:bg-[#EEF8F3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#047C61]/40 cursor-pointer"
                    >
                      <Sparkles aria-hidden="true" className="size-3.5 shrink-0" />
                      <span>Fill Dummy Evaluator ID (Doctor)</span>
                    </button>

                    <div className="rounded-xl border border-[#EAE5D8] bg-white/80 p-3 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-[#556761]">
                        <span className="font-semibold text-[#233A34]">
                          Evaluator Demo Roles
                        </span>
                        <span className="font-mono text-[10px] text-[#647871]">
                          org: demo
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {DEMO_STAFF_ACCOUNTS.map((account) => {
                          const selected = filledDemoAccount?.id === account.id;
                          return (
                            <button
                              key={account.id}
                              type="button"
                              onClick={() => fillDemoCredentials(account)}
                              className={`inline-flex min-h-7 items-center rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer ${
                                selected
                                  ? "border-[#047C61] bg-[#E7F2E8] text-[#035442]"
                                  : "border-[#E1DBD0] bg-[#FAF8F2] text-[#324942] hover:border-[#047C61]/60 hover:bg-[#F1F7F4]"
                              }`}
                            >
                              {account.label}
                            </button>
                          );
                        })}
                      </div>
                      {filledDemoAccount && (
                        <p
                          aria-live="polite"
                          className="text-[11px] leading-snug text-[#047C61] font-medium"
                        >
                          Filled {filledDemoAccount.label} (
                          <span className="font-mono">{filledDemoAccount.email}</span>
                          ). Click &ldquo;Sign In with Credentials&rdquo; above to enter.
                        </p>
                      )}
                    </div>
                  </div>
                </form>
              </div>
            </AuthFormCard>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
}
