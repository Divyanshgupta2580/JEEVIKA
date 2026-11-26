import * as React from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, ExternalLink, Eye, EyeOff, Loader2, type LucideIcon } from "lucide-react";
import { GoldUnderline } from "@/components/landing-public/shared";
import { cn } from "@/lib/utils";

/** Shared light-mode ivory canvas for all JEEVIKA authentication screens. */
export function AuthLayout({
  header,
  footer,
  bottomWave = true,
  className,
  children,
}: {
  header?: React.ReactNode;
  footer?: React.ReactNode;
  bottomWave?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "jvk-motion-auth jeevika-landing min-h-dvh bg-[#FEFBF6] text-[#0E2420] antialiased flex flex-col justify-between relative overflow-x-clip selection:bg-[#E7F2E8] selection:text-[#047C61]",
        className,
      )}
    >
      {header}
      <main id="public-main" tabIndex={-1} className="relative z-10 flex-1 flex flex-col justify-center focus:outline-none">
        {children}
      </main>
      {footer}
      {bottomWave && <AuthDecorativeWave />}
    </div>
  );
}

/** Header for staff and standalone auth screens preserving the original JEEVIKA logo. */
export function AuthHeader({ variant = "staff" }: { variant?: "staff" | "compact" }) {
  return (
    <header className="relative z-20 border-b border-[#EAE6DC]/80 bg-[#FEFBF6]/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 sm:gap-4">
          <Link
            to="/"
            aria-label="JEEVIKA home"
            className="inline-flex min-h-11 items-center rounded-lg px-0.5"
          >
            <img
              src="/assets/logo-jeevika.png"
              alt="JEEVIKA"
              width={118}
              height={39}
              className="h-8 w-auto object-contain sm:h-9"
            />
          </Link>

          {variant === "staff" && (
            <div className="hidden sm:block border-l border-[#DED8C8] pl-3.5">
              <p className="text-[11px] font-bold tracking-[0.06em] uppercase text-[#112A25]">
                Hospital Operating System
              </p>
              <p className="text-[11px] font-medium text-[#5A6C66]">
                Enterprise Clinical &amp; Ops Suite
              </p>
            </div>
          )}
        </div>

        <Link
          to="/"
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#D8D3C6] bg-[#FFFDF9] px-3.5 py-2 text-xs sm:text-[13px] font-semibold text-[#182E29] shadow-[0_1px_2px_rgba(14,36,32,0.04)] transition-colors hover:bg-[#F3EFE4]"
        >
          <ExternalLink aria-hidden="true" className="size-3.5 text-[#047C61]" />
          <span>Back to Public Overview</span>
        </Link>
      </div>
    </header>
  );
}

/** Seamless watercolor artwork container matching the #FEFBF6 warm ivory background. */
export function AuthIllustrationPanel({
  src,
  alt,
  width,
  height,
  className,
  imgClassName,
}: {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  imgClassName?: string;
}) {
  return (
    <div className={cn("relative overflow-hidden", className)}>
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        fetchPriority="high"
        className={cn("jeevika-auth-artwork w-full h-auto object-contain select-none", imgClassName)}
      />
    </div>
  );
}

/** Elevated ivory/white authentication card matching the approved reference surfaces. */
export function AuthFormCard({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "jvk-motion-auth rounded-[24px] border border-[#E5E0D4] bg-[#FFFEFB] shadow-[0_20px_50px_rgba(14,36,32,0.08)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Accessible form input styled with warm ivory surface and medical teal focus ring. */
export const AuthInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { icon?: LucideIcon }
>(({ className, icon: Icon, ...props }, ref) => (
  <div className="relative">
    {Icon && (
      <Icon
        aria-hidden="true"
        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[#6B7B75]"
      />
    )}
    <input
      ref={ref}
      className={cn(
        "jvk-motion-field flex h-11 w-full rounded-xl border border-[#D8D3C6] bg-[#FAF8F2] px-3.5 py-2 text-sm text-[#0E2420] placeholder:text-[#788781] focus:bg-white focus:border-[#047C61] focus:outline-none focus:ring-2 focus:ring-[#047C61]/20 disabled:cursor-not-allowed disabled:opacity-60",
        Icon && "pl-10",
        className,
      )}
      {...props}
    />
  </div>
));
AuthInput.displayName = "AuthInput";

/** Accessible password input with leading icon and keyboard-focusable visibility toggle. */
export const AuthPasswordInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { icon?: LucideIcon }
>(({ className, icon: Icon, ...props }, ref) => {
  const [visible, setVisible] = React.useState(false);

  return (
    <div className="relative">
      {Icon && (
        <Icon
          aria-hidden="true"
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[#6B7B75]"
        />
      )}
      <input
        ref={ref}
        type={visible ? "text" : "password"}
        className={cn(
          "jvk-motion-field flex h-11 w-full rounded-xl border border-[#D8D3C6] bg-[#FAF8F2] px-3.5 py-2 pr-11 text-sm text-[#0E2420] placeholder:text-[#788781] focus:bg-white focus:border-[#047C61] focus:outline-none focus:ring-2 focus:ring-[#047C61]/20 disabled:cursor-not-allowed disabled:opacity-60",
          Icon && "pl-10",
          className,
        )}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((prev) => !prev)}
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 inline-flex size-8 items-center justify-center rounded-lg text-[#5A6B65] hover:bg-[#EAE6DC]/60 hover:text-[#0E2420] transition-colors cursor-pointer"
      >
        {visible ? <EyeOff aria-hidden="true" className="size-4" /> : <Eye aria-hidden="true" className="size-4" />}
      </button>
    </div>
  );
});
AuthPasswordInput.displayName = "AuthPasswordInput";

/** Deep medical teal primary submit button with loading state. */
export function AuthSubmitButton({
  loading,
  loadingText,
  children,
  className,
  disabled,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
  loadingText?: string;
}) {
  return (
    <button
      type="submit"
      disabled={disabled || loading}
      className={cn(
        "jvk-motion-action inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#047C61] to-[#025E4C] px-5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(4,124,97,0.22)] enabled:hover:from-[#036B54] enabled:hover:to-[#025142] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer",
        className,
      )}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          <span>{loadingText ?? "Please wait…"}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}

export interface AuthBenefitItem {
  icon: LucideIcon;
  title: string;
  description?: string;
}

/** Three-column informational strip used on both Staff and Patient sign-in screens. */
export function AuthBenefitsStrip({
  items,
  className,
}: {
  items: AuthBenefitItem[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[#EAE6DC] rounded-2xl border border-[#EAE6DC] bg-[#FFFDF9]/95 shadow-[0_6px_22px_rgba(14,36,32,0.04)]",
        className,
      )}
    >
      {items.map(({ icon: Icon, title, description }) => (
        <div key={title} className="flex items-start gap-2.5 px-4 py-3">
          <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-xl bg-[#E7F2E8] text-[#047C61]">
            <Icon aria-hidden="true" className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[12.5px] font-bold leading-snug text-[#0E2420]">{title}</p>
            {description && (
              <p className="mt-0.5 text-[11.5px] leading-snug text-[#53655F]">{description}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

const VERIFIED_SECURITY_ITEMS = [
  "Role-Based Access Control",
  "Tenant-Isolated Clinical Data",
  "Server-Verified Sessions",
  "Audit-Logged Clinical Actions",
] as const;

/** Verified security capabilities strip for the staff authentication footer. */
export function AuthSecurityNotice() {
  return (
    <footer className="relative z-10 mx-auto w-full max-w-7xl px-4 pt-3 pb-7 sm:px-6 lg:px-8 text-center">
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11.5px] font-semibold text-[#314741]">
        {VERIFIED_SECURITY_ITEMS.map((item) => (
          <span key={item} className="inline-flex items-center gap-1.5">
            <CheckCircle2 aria-hidden="true" className="size-3.5 text-[#047C61]" />
            <span>{item}</span>
          </span>
        ))}
      </div>
      <p className="mt-2 text-[11px] font-medium text-[#667771]">
        JEEVIKA Hospital Management &amp; Decision Support Platform • Maintained by Jeevika Core Engineering Team
      </p>
    </footer>
  );
}

/** Bottom green-and-gold curved watercolor wave matching both approved auth references. */
export function AuthDecorativeWave() {
  return (
    <div aria-hidden="true" className="pointer-events-none relative z-0 mt-auto w-full overflow-hidden leading-none">
      <svg
        viewBox="0 0 1440 34"
        fill="none"
        preserveAspectRatio="none"
        className="block h-5 w-full sm:h-7"
      >
        <path
          d="M0 14C240 28 520 26 840 16C1120 7 1300 4 1440 12V34H0V14Z"
          fill="#E5A736"
          fillOpacity="0.45"
        />
        <path
          d="M0 18C290 4 560 28 910 22C1160 17 1320 9 1440 16V34H0V18Z"
          fill="#026E5E"
        />
      </svg>
    </div>
  );
}

/** Subtle gold tapered underline re-exported for auth headings. */
export { GoldUnderline };
