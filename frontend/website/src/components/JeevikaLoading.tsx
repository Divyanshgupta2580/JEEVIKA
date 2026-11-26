import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Pause, Play } from "lucide-react";

export const landingArtwork = "/assets/design/care-continuum.jpg";
const splashDismissDurationMs = 300;
const startupTimeoutMs = 12000;

const StartupActiveContext = createContext(false);

type PatientBootDetail = { ready?: boolean; error?: string };
let lastPatientBootDetail: PatientBootDetail | null = null;

/** Broadcast patient session readiness cleanly even across child-before-parent effect order. */
export function notifyPatientBoot(detail: PatientBootDetail) {
  lastPatientBootDetail = detail;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("jeevika-patient-boot", { detail }));
  }
}

/** Returns true only while the initial application startup splash screen is mounted. */
export function useStartupActive() {
  return useContext(StartupActiveContext);
}

export interface JeevikaLoadingProps {
  embedded?: boolean;
  label?: string;
  exiting?: boolean;
  error?: string | null;
  onRetry?: () => void;
  fallbackHref?: string;
  fallbackLabel?: string;
  progressValue?: number;
}

/**
 * JEEVIKA Animated Startup Splash & Workspace Loader.
 * Reproduces the approved watercolor composition with independent animated layers,
 * original JEEVIKA brand logo, accessible progress semantics, reduced-motion support,
 * pause control, and bounded failure recovery.
 */
export function JeevikaLoading({
  embedded = false,
  label = "Preparing connected care...",
  exiting = false,
  error = null,
  onRetry,
  fallbackHref,
  fallbackLabel,
  progressValue,
}: JeevikaLoadingProps) {
  const headingId = useId();
  const [motionPaused, setMotionPaused] = useState(false);

  if (embedded) {
    return (
      <div className="jvk-loading-screen jvk-loading-embedded" role="status">
        <img
          className="jvk-splash-logo"
          src="/assets/logo-jeevika.png"
          alt="JEEVIKA"
          width={196}
          height={65}
        />
        <p id={headingId} className="jvk-loading-message">
          {label}
        </p>
        <progress
          aria-labelledby={headingId}
          className="jvk-splash-progress"
          value={progressValue}
          max={progressValue !== undefined ? 100 : undefined}
        />
      </div>
    );
  }

  return (
    <div
      className={[
        "jvk-loading-screen",
        "jvk-splash-overlay",
        exiting ? "jvk-splash-exiting" : "",
        motionPaused ? "jvk-splash-paused" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-jvk-splash="true"
      data-state={error ? "error" : exiting ? "exiting" : "loading"}
    >
      {/* WCAG 2.2.2 user control to pause ambient motion during extended loads */}
      {!error && !exiting && (
        <button
          type="button"
          className="jvk-splash-motion-toggle"
          aria-label={motionPaused ? "Play decorative animation" : "Pause decorative animation"}
          onClick={() => setMotionPaused((prev) => !prev)}
        >
          {motionPaused ? (
            <>
              <Play aria-hidden="true" className="size-3.5" />
              <span>Play</span>
            </>
          ) : (
            <>
              <Pause aria-hidden="true" className="size-3.5" />
              <span>Pause</span>
            </>
          )}
        </button>
      )}

      {/* Ambient distant watercolor hills & golden connection paths with travelling light beads */}
      <svg
        aria-hidden="true"
        className="jvk-splash-backdrop-svg"
        viewBox="0 0 1440 720"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="jvk-splash-hill-sage" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#CEE1D6" stopOpacity="0.48" />
            <stop offset="65%" stopColor="#DCE8DC" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#FAF6ED" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="jvk-splash-hill-gold" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#E6D8B4" stopOpacity="0.34" />
            <stop offset="80%" stopColor="#FAF6ED" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#FAF6ED" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="jvk-splash-gold-arc-l" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#DFB35E" stopOpacity="0.62" />
            <stop offset="100%" stopColor="#DFB35E" stopOpacity="0.16" />
          </linearGradient>
          <linearGradient id="jvk-splash-gold-arc-r" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#DFB35E" stopOpacity="0.18" />
            <stop offset="55%" stopColor="#DFB35E" stopOpacity="0.58" />
            <stop offset="100%" stopColor="#DFB35E" stopOpacity="0.4" />
          </linearGradient>
        </defs>

        {/* Distant rolling hill contours fading cleanly to ivory toward bottom */}
        <path
          d="M 0 490 C 130 400, 260 475, 430 550 C 575 610, 735 565, 925 545 C 1105 526, 1280 498, 1440 526 L 1440 720 L 0 720 Z"
          fill="url(#jvk-splash-hill-sage)"
        />
        <path
          d="M 0 568 C 180 518, 340 512, 520 578 C 680 634, 875 605, 1085 562 C 1255 528, 1365 540, 1440 566 L 1440 720 L 0 720 Z"
          fill="url(#jvk-splash-hill-gold)"
        />

        {/* Golden connecting arcs linking care scenes */}
        <path
          d="M -10 302 C 135 308, 255 415, 420 500"
          fill="none"
          stroke="url(#jvk-splash-gold-arc-l)"
          strokeWidth="1.5"
        />
        <path
          d="M 740 532 C 950 475, 1175 370, 1455 348"
          fill="none"
          stroke="url(#jvk-splash-gold-arc-r)"
          strokeWidth="1.5"
        />
        <path
          d="M 1185 452 C 1205 330, 1340 286, 1448 332"
          fill="none"
          stroke="rgba(223, 179, 94, 0.44)"
          strokeWidth="1.35"
        />

        {/* Travelling golden light particles along connecting arcs */}
        <g className="jvk-splash-orb-left">
          <circle r="11" className="jvk-splash-particle-aura" />
          <circle r="4.2" className="jvk-splash-particle" />
        </g>
        <g className="jvk-splash-orb-right">
          <circle r="11" className="jvk-splash-particle-aura" />
          <circle r="4.2" className="jvk-splash-particle" />
        </g>
      </svg>

      {/* Flowing layered green & gold waves along the lower viewport edge */}
      <div aria-hidden="true" className="jvk-splash-waves-wrap">
        <svg
          className="jvk-splash-waves-svg"
          viewBox="0 0 1440 200"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="jvk-splash-wave-g1" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#127A61" stopOpacity="0.62" />
              <stop offset="38%" stopColor="#65A58E" stopOpacity="0.45" />
              <stop offset="72%" stopColor="#1B7C64" stopOpacity="0.58" />
              <stop offset="100%" stopColor="#0E6C56" stopOpacity="0.52" />
            </linearGradient>
            <linearGradient id="jvk-splash-wave-gold" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#E6BA5E" stopOpacity="0.52" />
              <stop offset="48%" stopColor="#F0D082" stopOpacity="0.38" />
              <stop offset="100%" stopColor="#D7A13B" stopOpacity="0.62" />
            </linearGradient>
            <linearGradient id="jvk-splash-wave-ivory" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FAF6ED" stopOpacity="0.72" />
              <stop offset="100%" stopColor="#FAF6ED" stopOpacity="0.96" />
            </linearGradient>
          </defs>

          <g className="jvk-splash-wave-teal">
            <path
              d="M -60 112 C 180 42, 420 68, 660 116 C 920 166, 1180 62, 1500 94 L 1500 210 L -60 210 Z"
              fill="url(#jvk-splash-wave-g1)"
            />
          </g>
          <g className="jvk-splash-wave-gold">
            <path
              d="M -60 142 C 210 156, 470 76, 740 120 C 1010 164, 1245 78, 1500 116 L 1500 210 L -60 210 Z"
              fill="url(#jvk-splash-wave-gold)"
            />
          </g>
          <path
            d="M -60 154 C 240 126, 495 162, 780 142 C 1065 122, 1260 144, 1500 132 L 1500 210 L -60 210 Z"
            fill="url(#jvk-splash-wave-ivory)"
          />
        </svg>
      </div>

      {/* Isolated Corner Scenes (Hospital + Ambulance bottom-left, Clipboard + Stethoscope bottom-right) */}
      <div aria-hidden="true" className="jvk-splash-scene">
        {/* Bottom-left Hospital, Ambulance, Botanical Leaves & ECG Trace */}
        <div className="jvk-splash-corner-left">
          <img
            src="/assets/splash/splash-botanical-left.png"
            alt=""
            width={66}
            height={86}
            decoding="async"
            className="jvk-splash-layer jvk-splash-multiply jvk-splash-botanical-left-img"
          />
          <svg
            className="jvk-splash-layer jvk-splash-ecg-svg"
            viewBox="0 0 136 56"
            fill="none"
          >
            <path
              className="jvk-splash-ecg-glow"
              d="M 4 38 H 22 L 28 31 L 34 40 L 42 8 L 49 49 L 55 34 L 62 38 H 92 L 98 33 L 103 42 L 110 16 L 116 48 L 122 36 L 126 38 H 134"
            />
            <path
              className="jvk-splash-ecg-stroke"
              d="M 4 38 H 22 L 28 31 L 34 40 L 42 8 L 49 49 L 55 34 L 62 38 H 92 L 98 33 L 103 42 L 110 16 L 116 48 L 122 36 L 126 38 H 134"
            />
          </svg>
          <img
            src="/assets/splash/splash-hospital.png"
            alt=""
            width={302}
            height={216}
            decoding="async"
            className="jvk-splash-layer jvk-splash-multiply jvk-splash-hospital-img"
          />
          <img
            src="/assets/splash/splash-ambulance.png"
            alt=""
            width={102}
            height={64}
            decoding="async"
            className="jvk-splash-layer jvk-splash-ambulance-img"
          />
          <img
            src="/assets/splash/splash-flowers-left.png"
            alt=""
            width={150}
            height={100}
            decoding="async"
            className="jvk-splash-layer jvk-splash-multiply jvk-splash-flowers-left-img"
          />
        </div>

        {/* Bottom-right Clipboard, Stethoscope, Heart Glow, Care Emblem & Botanical Leaves */}
        <div className="jvk-splash-corner-right">
          {/* Translucent Care-Team Silhouette Emblem */}
          <svg
            className="jvk-splash-layer jvk-splash-careteam-svg"
            viewBox="0 0 96 96"
            fill="none"
          >
            <circle cx="48" cy="48" r="42" stroke="#E0C585" strokeOpacity="0.6" strokeWidth="1.5" fill="rgba(255, 252, 244, 0.36)" />
            <circle cx="48" cy="36" r="9.5" fill="#C4D4C9" />
            <path d="M 32 72 C 32 58, 64 58, 64 72" fill="#C4D4C9" />
            <circle cx="29" cy="43" r="7" fill="#CEDCD2" />
            <path d="M 19 72 C 19 61, 37 61, 37 72" fill="#CEDCD2" />
            <circle cx="67" cy="43" r="7" fill="#CEDCD2" />
            <path d="M 59 72 C 59 61, 77 61, 77 72" fill="#CEDCD2" />
          </svg>

          {/* Subtle Golden Heart with Inner ECG Trace */}
          <svg
            className="jvk-splash-layer jvk-splash-heart-svg"
            viewBox="0 0 64 60"
            fill="none"
          >
            <defs>
              <radialGradient id="jvk-splash-heart-aura" cx="50%" cy="46%" r="50%">
                <stop offset="0%" stopColor="#F5CE7A" stopOpacity="0.82" />
                <stop offset="68%" stopColor="#F1BD5C" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#F1BD5C" stopOpacity="0" />
              </radialGradient>
            </defs>
            <circle cx="32" cy="30" r="29" fill="url(#jvk-splash-heart-aura)" />
            <path
              d="M32 50.5C32 50.5 11.5 37.8 11.5 23.2C11.5 16.9 16.3 12 22.4 12C26.1 12 29.4 13.8 32 16.9C34.6 13.8 37.9 12 41.6 12C47.7 12 52.5 16.9 52.5 23.2C52.5 37.8 32 50.5 32 50.5Z"
              fill="#F3CA77"
              fillOpacity="0.88"
            />
            <path
              d="M17 31H24L27.5 24.5L31.5 37.5L35 28L38 31H47"
              stroke="#FFFDF8"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          <img
            src="/assets/splash/splash-botanical-right.png"
            alt=""
            width={68}
            height={196}
            decoding="async"
            className="jvk-splash-layer jvk-splash-multiply jvk-splash-botanical-right-img"
          />
          <img
            src="/assets/splash/splash-clipboard-stethoscope.png"
            alt=""
            width={162}
            height={146}
            decoding="async"
            className="jvk-splash-layer jvk-splash-multiply jvk-splash-clipboard-img"
          />
          <img
            src="/assets/splash/splash-sprig-right.png"
            alt=""
            width={88}
            height={64}
            decoding="async"
            className="jvk-splash-layer jvk-splash-multiply jvk-splash-sprig-right-img"
          />
          <img
            src="/assets/splash/splash-flowers-right.png"
            alt=""
            width={86}
            height={92}
            decoding="async"
            className="jvk-splash-layer jvk-splash-multiply jvk-splash-flowers-right-img"
          />
        </div>
      </div>

      {/* Main Centered Brand Identity, Status & Progress Indicator */}
      <div className="jvk-splash-center">
        <img
          src="/assets/logo-jeevika.png"
          alt="JEEVIKA"
          width={420}
          height={140}
          className="jvk-splash-logo jvk-splash-logo-animate"
        />

        {error ? (
          <div role="alert" className="jvk-splash-error-card">
            <p className="jvk-splash-error-title">Unable to start JEEVIKA</p>
            <p className="jvk-splash-error-body">{error}</p>
            <div className="jvk-splash-error-actions">
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="jvk-splash-btn-primary"
                >
                  Try again
                </button>
              )}
              {fallbackHref && fallbackLabel && (
                <a href={fallbackHref} className="jvk-splash-btn-secondary">
                  {fallbackLabel}
                </a>
              )}
            </div>
          </div>
        ) : (
          <>
            <p id={headingId} className="jvk-loading-message jvk-splash-message-animate">
              {label}
            </p>
            <progress
              aria-labelledby={headingId}
              className="jvk-splash-progress"
              value={progressValue}
              max={progressValue !== undefined ? 100 : undefined}
            />
          </>
        )}
      </div>
    </div>
  );
}

type BootPhase = "booting" | "exiting" | "done";

function isLandingPath(pathname: string): boolean {
  const normalized = pathname.replace(/\/$/, "") || "/";
  return normalized === "/" || normalized === "/overview" || normalized === "/landing";
}

function isPatientPortalPath(pathname: string): boolean {
  return /^\/app\/home(?:\/|$)/.test(pathname);
}

function isHospitalAuthPath(pathname: string): boolean {
  if (isPatientPortalPath(pathname)) return false;
  return (
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/reset-password" ||
    pathname === "/app" ||
    pathname.startsWith("/app/")
  );
}

function preloadRouteChunk(pathname: string): Promise<void> {
  if (pathname === "/kiosk") {
    return import("@/features/patient/KioskIntake").then(() => undefined);
  }
  if (pathname === "/about") return import("@/pages/AboutPage").then(() => undefined);
  if (pathname === "/news") return import("@/pages/NewsPage").then(() => undefined);
  if (pathname === "/contact") return import("@/pages/ContactPage").then(() => undefined);
  if (pathname === "/clinic-operations") return import("@/pages/ClinicOperationsPage").then(() => undefined);
  if (pathname === "/hospital-command-center") return import("@/pages/HospitalCommandCenterPage").then(() => undefined);
  if (pathname === "/privacy") return import("@/pages/PrivacyPage").then(() => undefined);
  if (pathname === "/careers") return import("@/pages/CareersPage").then(() => undefined);
  if (pathname === "/support") return import("@/pages/SupportPage").then(() => undefined);
  if (pathname === "/login") return import("@/components/LoginPage").then(() => undefined);
  if (pathname === "/register") return import("@/components/RegisterPage").then(() => undefined);
  if (/^\/app\/doctor(?:\/|$)/.test(pathname) || pathname === "/app/opd") {
    return import("@/components/DoctorConsultation").then(() => undefined);
  }
  if (pathname === "/app/doctor/alerts" || pathname === "/app/alerts") {
    return import("@/features/opd/ClinicianAlertsPage").then(() => undefined);
  }
  if (pathname === "/app/ipd" || pathname === "/app/casualty") {
    return import("@/components/CareBoard").then(() => undefined);
  }
  if (pathname === "/app/ayush") return import("@/components/AyushDashboard").then(() => undefined);
  if (pathname === "/app/inventory" || pathname === "/app/pos") {
    return import("@/components/ClinicalPharmacy").then(() => undefined);
  }
  if (pathname === "/app/admin") return import("@/components/HospitalDashboard").then(() => undefined);
  return Promise.resolve();
}

function settleFonts(limitMs = 300): Promise<void> {
  if (typeof document === "undefined" || !("fonts" in document)) return Promise.resolve();
  return Promise.race([
    document.fonts.ready.then(() => undefined).catch(() => undefined),
    new Promise<void>((resolve) => window.setTimeout(resolve, limitMs)),
  ]);
}

function decodeLandingHero(limitMs = 1500): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  const img = new Image();
  img.src = landingArtwork;
  const decodePromise =
    typeof img.decode === "function"
      ? img.decode().catch(() => undefined)
      : Promise.resolve();
  return Promise.race([
    decodePromise,
    new Promise<void>((resolve) => window.setTimeout(resolve, limitMs)),
  ]);
}

/**
 * Coordinates the single initial startup splash screen with real application readiness:
 * - Landing entries pre-decode the above-the-fold hero artwork & fonts.
 * - Staff/clinical deep links wait for HospitalProvider session initialization.
 * - Patient portal entries wait for PatientAppRoute session verification.
 * - Patient Kiosk & public sub-pages preload only their route chunk and never block on optional APIs.
 * - Smoothly fades out over 300ms (0ms when prefers-reduced-motion) and unmounts cleanly.
 * Never re-displays during internal route navigation.
 */
export function StartupBoot({
  entryPathname,
  hospitalLoading,
  hasPatientToken = false,
  children,
}: {
  entryPathname: string;
  hospitalLoading: boolean;
  hasPatientToken?: boolean;
  children: (state: { startupActive: boolean; mountRoutes: boolean }) => ReactNode;
}) {
  const initialPath = useRef(entryPathname).current;
  const isLanding = isLandingPath(initialPath);
  const isPatientPortal = isPatientPortalPath(initialPath) || (initialPath === "/app" && hasPatientToken);
  const needsPatientVerify = isPatientPortal && hasPatientToken;
  const needsHospitalAuth = !hasPatientToken && isHospitalAuthPath(initialPath);

  const [phase, setPhase] = useState<BootPhase>("booting");
  const [resourceReady, setResourceReady] = useState(false);
  const [authReady, setAuthReady] = useState(!needsHospitalAuth && !needsPatientVerify);
  const [bootError, setBootError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const exitTimer = useRef<number | undefined>(undefined);
  const underRef = useRef<HTMLDivElement>(null);

  // Reflect hospital auth loading completion when startup requires staff/auth verification
  useEffect(() => {
    if (!needsHospitalAuth) {
      if (!needsPatientVerify) setAuthReady(true);
      return;
    }
    if (!hospitalLoading) {
      setAuthReady(true);
    }
  }, [needsHospitalAuth, needsPatientVerify, hospitalLoading]);

  // Listen to PatientAppRoute startup check if initial URL targets /app/home/* with an active token
  useEffect(() => {
    if (!needsPatientVerify) return;
    function applyDetail(detail?: PatientBootDetail | null) {
      if (!detail) return;
      if (detail.error) {
        setBootError(detail.error);
        setAuthReady(false);
        return;
      }
      if (detail.ready) {
        setBootError(null);
        setAuthReady(true);
      }
    }
    applyDetail(lastPatientBootDetail);
    function onPatientBoot(event: Event) {
      if (event instanceof CustomEvent) {
        applyDetail(event.detail as PatientBootDetail | undefined);
      }
    }
    window.addEventListener("jeevika-patient-boot", onPatientBoot);
    return () => window.removeEventListener("jeevika-patient-boot", onPatientBoot);
  }, [needsPatientVerify]);

  // Run genuine initialization readiness tasks for the initial entry route + bounded timeout guard
  useEffect(() => {
    let active = true;
    setBootError(null);

    const guard = window.setTimeout(() => {
      if (!active) return;
      if (isLanding || initialPath === "/kiosk") {
        // Never trap public overview or patient kiosk behind a slow optional resource
        setResourceReady(true);
        setAuthReady(true);
        return;
      }
      setBootError(
        "Initialization took longer than expected. Check your network connection and try again.",
      );
    }, startupTimeoutMs);

    const runInit = async () => {
      try {
        if (isLanding) {
          await Promise.all([settleFonts(320), decodeLandingHero(1500)]);
        } else {
          await Promise.all([settleFonts(260), preloadRouteChunk(initialPath)]);
        }
        if (active) setResourceReady(true);
      } catch {
        if (!active) return;
        setBootError("A required startup module failed to load. Check your connection and try again.");
      }
    };

    void runInit();
    return () => {
      active = false;
      window.clearTimeout(guard);
    };
  }, [initialPath, isLanding, retryToken]);

  const beginExit = useCallback(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setPhase("done");
      return;
    }
    setPhase((prev) => (prev === "booting" ? "exiting" : prev));
  }, []);

  useEffect(() => {
    if (phase !== "booting" || bootError) return;
    if (resourceReady && authReady) {
      beginExit();
    }
  }, [phase, bootError, resourceReady, authReady, beginExit]);

  useEffect(() => {
    if (phase !== "exiting") return;
    exitTimer.current = window.setTimeout(() => {
      setPhase("done");
    }, splashDismissDurationMs + 20);
    return () => {
      if (exitTimer.current !== undefined) {
        window.clearTimeout(exitTimer.current);
      }
    };
  }, [phase]);

  // Keep background tree non-interactive while splash covers viewport (React 18 safe)
  useEffect(() => {
    const el = underRef.current;
    if (!el) return;
    el.inert = phase !== "done";
  }, [phase]);

  const handleRetry = useCallback(() => {
    if (needsHospitalAuth || isPatientPortal) {
      window.location.reload();
      return;
    }
    setResourceReady(false);
    setBootError(null);
    setRetryToken((n) => n + 1);
  }, [needsHospitalAuth, isPatientPortal]);

  const startupActive = phase !== "done";
  // Mount routes behind splash right at exit (or during booting for PatientAppRoute so its session check executes)
  const mountRoutes = phase !== "booting" || isPatientPortal;

  return (
    <StartupActiveContext.Provider value={startupActive}>
      <div
        ref={underRef}
        aria-hidden={phase === "booting" ? true : undefined}
        className="w-full min-h-dvh"
      >
        {children({ startupActive, mountRoutes })}
      </div>

      {startupActive && (
        <JeevikaLoading
          exiting={phase === "exiting"}
          error={bootError}
          onRetry={handleRetry}
          fallbackHref="#/"
          fallbackLabel="Back to Public Overview"
        />
      )}
    </StartupActiveContext.Provider>
  );
}

/** Backwards-compatible alias preserving direct exports. */
export const LandingBoot = StartupBoot;
