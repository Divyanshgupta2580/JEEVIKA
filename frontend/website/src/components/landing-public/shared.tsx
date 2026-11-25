import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useHospital } from "@/context/HospitalContext";
import { patientToken } from "@/lib/patientApi";
import { landingRoute, routeAccess, type AppRoute } from "@/lib/rbac";

export interface RouteTarget {
  to: string;
  state?: { from: string | { pathname: string } };
  authorized: boolean;
}

export function useScrollToPublicSection() {
  const location = useLocation();
  const navigate = useNavigate();

  return useCallback(
    (sectionId: string) => {
      const scroll = () => {
        const target = document.getElementById(sectionId);
        if (!target) return;
        const reducedMotion =
          typeof window !== "undefined" &&
          window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        target.scrollIntoView({
          behavior: reducedMotion ? "auto" : "smooth",
          block: "start",
        });
        if (sectionId === "public-main" || sectionId === "phase-01") {
          target.focus({ preventScroll: true });
        }
      };

      if (location.pathname !== "/" && location.pathname !== "/overview") {
        navigate("/");
        window.setTimeout(scroll, 90);
        return;
      }
      scroll();
    },
    [location.pathname, navigate],
  );
}

/**
 * Resolves destination links based on active verified sessions without exposing
 * protected staff or patient operational pages to unauthenticated visitors.
 */
export function useLandingDestinations() {
  const { session, profile } = useHospital();
  const hasPatient = Boolean(patientToken());
  const rawRole =
    typeof session?.role === "string"
      ? session.role
      : typeof profile?.role === "string" && session
        ? profile.role
        : null;
  const staffRole = rawRole && rawRole !== "PATIENT" ? rawRole : null;

  const staffTarget = (route: AppRoute): RouteTarget => {
    if (staffRole && routeAccess(route, staffRole) !== "None") {
      return { to: route, authorized: true };
    }
    if (staffRole) {
      return { to: landingRoute(staffRole), authorized: true };
    }
    return {
      to: "/login",
      state: { from: { pathname: route } },
      authorized: false,
    };
  };

  const patientTarget = (route = "/app/home/thread"): RouteTarget => {
    if (hasPatient) {
      return { to: route, authorized: true };
    }
    return {
      to: "/home/sign-in",
      state: { from: route },
      authorized: false,
    };
  };

  const enterWorkspace: RouteTarget = staffRole
    ? { to: landingRoute(staffRole), authorized: true }
    : { to: "/login", authorized: false };

  return {
    staffRole,
    hasPatient,
    patientSignIn: patientTarget("/app/home/thread"),
    enterWorkspace,
    kiosk: { to: "/kiosk", authorized: true } satisfies RouteTarget,
    workspaces: {
      hospitalOperations: staffTarget("/app/command"),
      clinicianWorkspace: staffTarget("/app/doctor"),
      emergencyTriage: staffTarget("/app/casualty"),
      patientKiosk: { to: "/kiosk", authorized: true } satisfies RouteTarget,
      pharmacyInventory:
        staffRole && routeAccess("/app/inventory", staffRole) !== "None"
          ? { to: "/app/inventory", authorized: true }
          : staffRole && routeAccess("/app/pos", staffRole) !== "None"
            ? { to: "/app/pos", authorized: true }
            : staffTarget("/app/inventory"),
      homeRecovery: patientTarget("/app/home/thread"),
    },
  };
}

/** Subtle tapered gold curved accent matching the serif italic highlights */
export function GoldUnderline({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 220 16"
      fill="none"
      preserveAspectRatio="none"
      className={className}
    >
      <path
        d="M4 11.5C64 4.5 142 3.5 216 9.5C154 7.5 72 9.2 6 13.8C4 14 2.5 11.7 4 11.5Z"
        fill="url(#jvk-gold-stroke)"
      />
      <defs>
        <linearGradient id="jvk-gold-stroke" x1="0" y1="0" x2="220" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#E6A938" />
          <stop offset="65%" stopColor="#EBB951" />
          <stop offset="100%" stopColor="#F3CE7D" stopOpacity="0.45" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/** Phase 01 bottom wave boundary immediately above Connected patient journey */
export function SectionDivider() {
  return (
    <div aria-hidden="true" className="w-full overflow-hidden leading-none bg-[#FAF7F0]">
      <svg
        viewBox="0 0 1440 38"
        fill="none"
        preserveAspectRatio="none"
        className="block h-6 w-full sm:h-8 lg:h-9"
      >
        <rect width="1440" height="38" fill="#FEFBF6" />
        <path
          d="M0 15C240 5 460 11 720 19C980 27 1210 22 1440 12V38H0V15Z"
          fill="#067B62"
        />
        <path
          d="M0 24C290 15 560 19 840 26C1090 32 1280 29 1440 22V38H0V24Z"
          fill="#036752"
        />
      </svg>
    </div>
  );
}

export function HamburgerLinesIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className={className}>
      <path d="M3 5.5h14M3 10h14M3 14.5h14" />
    </svg>
  );
}

export function SignInDoorIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M11.5 3.5H15a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1-1.5 1.5h-3.5" />
      <path d="M3.5 10h9m-3-3 3 3-3 3" />
    </svg>
  );
}

export function LayersStackIcon({ className = "size-6" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 3 3.5 7.5 12 12l8.5-4.5L12 3Z" />
      <path d="m3.5 12 8.5 4.5 8.5-4.5" />
      <path d="m3.5 16.5 8.5 4.5 8.5-4.5" />
    </svg>
  );
}

export function EngineChipIcon({ className = "size-6" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="7" y="7" width="10" height="10" rx="2" />
      <rect x="10" y="10" width="4" height="4" rx="0.5" />
      <path d="M9.5 3.5v3.5m5-3.5v3.5m-5 10.5v3.5m5-3.5v3.5M3.5 9.5h3.5m-3.5 5h3.5m10-5h3.5m-3.5 5h3.5" />
    </svg>
  );
}

export function LanguageChoiceIcon({ className = "size-6" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 7h9M8.5 4v3m1.5 0c-.6 3.7-2.7 6.8-5.5 8.6" />
      <path d="M6.5 10.5c1 2 2.4 3.5 4.3 4.7" />
      <path d="M13 19.5 16.5 10l3.5 9.5M14.2 16.5h4.6" />
    </svg>
  );
}

export function JourneyPinIcon({ className = "size-6" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 13.5c2.2-2.1 4-4.2 4-6.3a4 4 0 1 0-8 0c0 2.1 1.8 4.2 4 6.3Z" />
      <circle cx="12" cy="7.2" r="1.3" fill="currentColor" stroke="none" />
      <path d="M5.5 15.5c-1.5.5-2.5 1.3-2.5 2.2 0 1.6 4 2.8 9 2.8s9-1.2 9-2.8c0-.9-1-1.7-2.5-2.2" />
    </svg>
  );
}

export function ClipboardCheckIcon({ className = "size-6" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="6" y="4.5" width="12" height="16" rx="2" />
      <path d="M9.5 4.5h5v2h-5z" />
      <path d="M9.5 10.5h5M9.5 14h5M9.5 17.2h3.2" />
    </svg>
  );
}

export function StethoscopeIcon({ className = "size-6" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M6.5 4v4.5a4.5 4.5 0 0 0 9 0V4" />
      <path d="M5 4h3M14 4h3" />
      <path d="M11 13v2.5a4.5 4.5 0 0 0 9 0V12" />
      <circle cx="20" cy="10.5" r="1.75" />
    </svg>
  );
}

export function PillCapsuleIcon({ className = "size-6" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="4" y="8" width="16" height="8" rx="4" transform="rotate(-45 12 12)" />
      <path d="m9.2 9.2 5.6 5.6" />
    </svg>
  );
}

export function HomePlusIcon({ className = "size-6" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3.5 11 12 4l8.5 7" />
      <path d="M6 9.5v9.5a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V9.5" />
      <path d="M12 11.5v5m-2.5-2.5h5" />
    </svg>
  );
}

export function ShieldPlusIcon({ className = "size-6" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 3.5 4.5 6.8v5.5c0 4.6 3.3 8.1 7.5 9.2 4.2-1.1 7.5-4.6 7.5-9.2V6.8L12 3.5Z" />
      <path d="M12 8.8v5.4M9.3 11.5h5.4" />
    </svg>
  );
}

export function DriftBarsIcon({ className = "size-6" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="4.5" y="13.5" width="3.5" height="6" rx="0.6" />
      <rect x="10.2" y="9.5" width="3.5" height="10" rx="0.6" />
      <rect x="16" y="5" width="3.5" height="14.5" rx="0.6" />
    </svg>
  );
}

export function ThreadNetworkIcon({ className = "size-6" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="5.8" r="2.2" />
      <circle cx="6.2" cy="17.2" r="2.2" />
      <circle cx="17.8" cy="17.2" r="2.2" />
      <path d="m10.7 7.7-3.4 7.4M13.3 7.7l3.4 7.4M8.4 17.2h7.2" />
    </svg>
  );
}

export function ConsentLockIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
      <path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3" />
      <circle cx="12" cy="15.2" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function AccessUsersIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="9.5" cy="8.5" r="3" />
      <path d="M4 18.5c0-2.8 2.4-4.8 5.5-4.8s5.5 2 5.5 4.8" />
      <path d="M16 6.2a2.5 2.5 0 0 1 0 4.6M17.2 14c1.9.5 3.3 2.1 3.3 4.5" />
    </svg>
  );
}

export function MottoShieldIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 3.5 4.5 6.8v5.5c0 4.6 3.3 8.1 7.5 9.2 4.2-1.1 7.5-4.6 7.5-9.2V6.8L12 3.5Z" />
      <path d="m9.2 12.2 2 2 3.8-4.2" />
    </svg>
  );
}
