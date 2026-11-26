import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Activity,
  CalendarCheck,
  Ellipsis,
  LogOut,
  Pill,
  ScrollText,
} from "lucide-react";
import "@/design-system/patient-portal.css";

const NAV_TABS = [
  { label: "Thread", paths: ["thread"], icon: ScrollText },
  { label: "Check-In", paths: ["check-in"], icon: CalendarCheck },
  { label: "Drift", paths: ["drift"], icon: Activity },
  { label: "Medicines", paths: ["refill", "prescriptions"], icon: Pill },
  {
    label: "More",
    paths: ["more", "her", "vitalis", "yoga", "prakriti"],
    icon: Ellipsis,
  },
] as const;

/** Tapered gold curve accent matching the JEEVIKA landing & auth pages. */
export function PatientGoldUnderline({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 220 16"
      fill="none"
      preserveAspectRatio="none"
      className={className}
    >
      <path
        d="M4 11.5C64 4.2 146 3.5 216 9.5C154 10.6 74 11.6 4 11.5Z"
        fill="#E5A736"
      />
    </svg>
  );
}

/**
 * Isolated responsive light-mode shell for the five redesigned patient portal pages.
 * Keeps <header> free of backdrop-filter/transform so the fixed mobile bottom nav
 * anchors to the viewport bottom without overlapping header controls, while rendering
 * a single <nav aria-label="Patient home navigation"> across all breakpoints.
 */
export function PatientPortalShell({
  signout,
  onLogout,
  headingRef,
  titlePrefix,
  titleItalic,
  titleSuffix,
  underlinePrefix = false,
  subtitle,
  children,
}: {
  signout: boolean;
  onLogout: () => void;
  headingRef: React.RefObject<HTMLHeadingElement>;
  titlePrefix: string;
  titleItalic?: string;
  titleSuffix?: string;
  underlinePrefix?: boolean;
  subtitle: string;
  children: ReactNode;
}) {
  const { pathname } = useLocation();
  const section = pathname.split("/").filter(Boolean).at(-1) ?? "thread";

  return (
    <div className="jvk-patient-portal relative min-h-dvh flex flex-col justify-between overflow-x-clip bg-[#FEFBF6] text-[#0E2420] pb-20 md:pb-0">
      <button
        type="button"
        onClick={() => document.getElementById("patient-main")?.focus()}
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-xl focus:bg-[#047C61] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg"
      >
        Skip to patient content
      </button>

      {/* Sticky Top Header: Original JEEVIKA Logo + Desktop Nav Space + Sign out */}
      <header className="sticky top-0 z-30 border-b border-[#EAE6DC] bg-[#FEFBF6]">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link
              to="/app/home/thread"
              aria-label="JEEVIKA Health Thread"
              className="inline-flex min-h-11 items-center rounded-lg px-0.5 transition-transform hover:scale-[1.02]"
            >
              <img
                src="/assets/logo-jeevika.png"
                alt="JEEVIKA"
                width={108}
                height={36}
                className="h-8 w-auto object-contain"
              />
            </Link>
            <span aria-hidden="true" className="hidden xl:inline-block h-5 w-px bg-[#DFDCD0]" />
            <span className="hidden xl:inline-block text-xs font-semibold tracking-wide text-[#51645E]">
              Patient Care Portal
            </span>
          </div>

          <button
            type="button"
            disabled={signout}
            onClick={onLogout}
            className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl border border-[#CBE0D5] bg-[#EEF8F3] px-3.5 py-2 text-xs sm:text-[13px] font-semibold text-[#11312B] shadow-[0_1px_2px_rgba(14,36,32,0.04)] transition-colors hover:bg-[#E1F3EA] disabled:opacity-60 cursor-pointer"
          >
            <LogOut aria-hidden="true" className="size-3.5 text-[#047C61]" />
            <span>{signout ? "Signing out…" : "Sign out"}</span>
          </button>
        </div>
      </header>

      {/* Main Content Area + Approved Watercolor Rural Landscape Banner */}
      <main
        id="patient-main"
        tabIndex={-1}
        className="relative z-10 mx-auto w-full max-w-6xl flex-1 px-4 pt-5 pb-8 sm:px-6 lg:px-8 lg:pt-7 focus:outline-none"
      >
        <div className="relative mb-6 overflow-hidden rounded-2xl border border-[#EAE6DC]/80 bg-gradient-to-r from-[#FFFDF9] via-[#FEFBF6] to-[#F9F5EB] px-5 py-5 sm:px-7 sm:py-6">
          <img
            src="/assets/patient/rural-landscape-banner.png"
            alt=""
            aria-hidden="true"
            width={246}
            height={186}
            className="jvk-watercolor-blend pointer-events-none select-none absolute -top-1 -right-4 sm:right-0 h-32 sm:h-44 lg:h-48 w-auto opacity-75 sm:opacity-95"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 w-4/5 bg-gradient-to-r from-[#FFFDF9] via-[#FEFBF6]/95 to-transparent sm:w-3/5"
          />
          <div className="relative z-10 max-w-xs sm:max-w-md lg:max-w-xl space-y-2 pr-14 sm:pr-44 lg:pr-56">
            <h1
              ref={headingRef}
              tabIndex={-1}
              className="font-bold tracking-tight text-[#0E2420] leading-[1.12] focus:outline-none"
              style={{ fontSize: "clamp(1.75rem, 3vw, 2.5rem)" }}
            >
              {underlinePrefix ? (
                <span className="relative inline-block pr-1">
                  {titlePrefix}
                  <PatientGoldUnderline className="absolute -bottom-1 left-0 h-2 w-full" />
                </span>
              ) : (
                titlePrefix
              )}
              {titleItalic && (
                <>
                  {" "}
                  <span className="relative inline-block jeevika-serif-italic jvk-serif-italic pr-1">
                    {titleItalic}
                    <PatientGoldUnderline className="absolute -bottom-1 left-0 h-2 w-full" />
                  </span>
                </>
              )}
              {titleSuffix}
            </h1>
            <p className="text-[13px] sm:text-sm leading-relaxed text-[#465953]">
              {subtitle}
            </p>
          </div>
        </div>

        {children}
      </main>

      {/* Bottom Watercolor Leaf & Green-Gold Curved Boundary */}
      <div aria-hidden="true" className="pointer-events-none relative z-0 mt-auto w-full overflow-hidden leading-none">
        <img
          src="/assets/patient/botanical-corner-leaf.png"
          alt=""
          width={86}
          height={106}
          style={{
            WebkitMaskImage: "radial-gradient(ellipse at 25% 78%, #000 30%, transparent 72%)",
            maskImage: "radial-gradient(ellipse at 25% 78%, #000 30%, transparent 72%)",
          }}
          className="select-none mix-blend-multiply absolute -bottom-1 -left-1 h-16 sm:h-20 w-auto opacity-95"
        />
        <svg
          viewBox="0 0 1440 42"
          fill="none"
          preserveAspectRatio="none"
          className="block h-7 w-full sm:h-9"
        >
          <path
            d="M0 18C260 32 540 30 880 18C1150 9 1310 5 1440 15V42H0V18Z"
            fill="#E5A736"
            fillOpacity="0.45"
          />
          <path
            d="M0 24C300 8 590 32 940 25C1190 20 1330 11 1440 19V42H0V24Z"
            fill="#026E5E"
          />
        </svg>
      </div>

      {/* Single Semantic 5-Tab Navigation: Fixed bottom bar on mobile, docked inside top bar on md+ */}
      <nav
        aria-label="Patient home navigation"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-[#E6E0D2] bg-[#FFFDF9] px-1.5 pt-1 pb-[calc(0.25rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(14,36,32,0.06)] md:inset-x-auto md:top-2.5 md:bottom-auto md:left-1/2 md:-translate-x-1/2 md:flex md:items-center md:gap-1 md:border-t-0 md:bg-transparent md:p-0 md:shadow-none"
      >
        {NAV_TABS.map(({ label, paths, icon: Icon }) => {
          const active = paths.some((path) => path === section);
          return (
            <Link
              key={label}
              to={`/app/home/${paths[0]}`}
              aria-current={active ? "page" : undefined}
              className={`relative flex min-h-14 md:min-h-10 min-w-0 flex-col md:flex-row items-center justify-center gap-1 md:gap-1.5 rounded-xl px-1.5 md:px-2.5 lg:px-3.5 py-1.5 text-[11px] md:text-[12.5px] lg:text-[13px] font-semibold transition-colors ${
                active
                  ? "bg-[#E5F3EA] text-[#047C61]"
                  : "text-[#4B5D57] hover:bg-[#F3EFE5] hover:text-[#0E2420]"
              }`}
            >
              <Icon size={18} aria-hidden="true" className="shrink-0" />
              <span className="truncate">{label}</span>
              {active && (
                <span
                  aria-hidden="true"
                  className="absolute bottom-1 left-1/2 -translate-x-1/2 h-0.5 w-6 rounded-full bg-[#047C61] md:bottom-0.5 md:w-8"
                />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
