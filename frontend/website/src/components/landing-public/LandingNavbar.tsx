import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  Building2,
  ChevronDown,
  Heart,
  LogOut,
  Package,
  ShieldCheck,
  Stethoscope,
  UserCheck,
  X,
} from "lucide-react";
import { useHospital } from "@/context/HospitalContext";
import { authService } from "@/lib/authService";
import { patientRequest, patientToken, setPatientToken } from "@/lib/patientApi";
import { routeAccess, staffNavItems } from "@/lib/rbac";
import {
  HamburgerLinesIcon,
  SignInDoorIcon,
  useLandingDestinations,
  useScrollToPublicSection,
  type RouteTarget,
} from "./shared";

export function LandingNavbar() {
  const { session, profile } = useHospital();
  const location = useLocation();
  const scrollToSection = useScrollToPublicSection();
  const destinations = useLandingDestinations();

  const dialogRef = useRef<HTMLDialogElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const platformTriggerRef = useRef<HTMLButtonElement>(null);
  const platformPopoverRef = useRef<HTMLDivElement>(null);
  const platformWrapRef = useRef<HTMLLIElement>(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [platformOpen, setPlatformOpen] = useState(false);
  const [platformHoverPreview, setPlatformHoverPreview] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const platformPopoverId = useId();
  const drawerId = useId();

  const verifiedRole =
    typeof session?.role === "string"
      ? session.role
      : typeof profile?.role === "string" && session
        ? profile.role
        : null;
  const hasStaffSession = Boolean(verifiedRole && verifiedRole !== "PATIENT");
  const hasPatientSession = Boolean(patientToken());

  const openMenu = useCallback(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open && typeof dialog.showModal === "function") {
      dialog.showModal();
    }
    setMenuOpen(true);
  }, []);

  const closeMenu = useCallback(() => {
    const dialog = dialogRef.current;
    if (dialog?.open) {
      dialog.close();
    }
    setMenuOpen(false);
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => {
      setMenuOpen(false);
      menuTriggerRef.current?.focus({ preventScroll: true });
    };
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, []);

  // Ensure popover attribute uses setAttribute for clean browser & polyfill compatibility
  useEffect(() => {
    const pop = platformPopoverRef.current;
    if (!pop) return;
    pop.setAttribute("popover", "auto");

    const onToggle = (event: Event) => {
      const toggleEvent = event as ToggleEvent;
      const open = toggleEvent.newState === "open";
      setPlatformOpen(open);
      if (!open) setPlatformHoverPreview(false);
    };
    pop.addEventListener("toggle", onToggle);
    return () => pop.removeEventListener("toggle", onToggle);
  }, []);

  const openPlatformPopover = useCallback((isHover = false) => {
    const pop = platformPopoverRef.current;
    const trigger = platformTriggerRef.current;
    if (!pop || !trigger) return;
    setPlatformHoverPreview(isHover);
    if (typeof pop.showPopover === "function") {
      try {
        if (!pop.matches(":popover-open")) {
          const show = pop.showPopover as (options?: { source?: HTMLElement }) => void;
          show.call(pop, { source: trigger });
        }
      } catch {
        pop.classList.add(":popover-open");
        setPlatformOpen(true);
      }
    } else {
      pop.classList.add(":popover-open");
      setPlatformOpen(true);
    }

    // Bounding-rect placement fallback when CSS anchor positioning is unavailable
    if (typeof CSS === "undefined" || !CSS.supports("position-area", "block-end")) {
      const rect = trigger.getBoundingClientRect();
      pop.style.position = "fixed";
      pop.style.margin = "0";
      pop.style.top = `${Math.round(rect.bottom + 8)}px`;
      pop.style.left = `${Math.max(12, Math.min(window.innerWidth - 280, Math.round(rect.left)))}px`;
    }
  }, []);

  const hidePlatformPopover = useCallback(() => {
    const pop = platformPopoverRef.current;
    if (!pop) return;
    setPlatformHoverPreview(false);
    if (typeof pop.hidePopover === "function") {
      try {
        if (pop.matches(":popover-open")) pop.hidePopover();
      } catch {
        pop.classList.remove(":popover-open");
        setPlatformOpen(false);
      }
    } else {
      pop.classList.remove(":popover-open");
      setPlatformOpen(false);
    }
  }, []);

  const jumpToSection = (sectionId: string) => {
    hidePlatformPopover();
    closeMenu();
    scrollToSection(sectionId);
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      if (hasStaffSession) await authService.signOut();
      if (hasPatientSession) {
        await patientRequest("/auth/patient/logout", {
          method: "POST",
          token: patientToken(),
        }).catch(() => undefined);
        setPatientToken(null);
      }
      closeMenu();
    } finally {
      setSigningOut(false);
    }
  };

  const drawerWorkspaces: Array<{
    title: string;
    subtitle: string;
    target: RouteTarget;
    icon: typeof Building2;
    accessNote: string;
  }> = [
    {
      title: "Hospital Operations",
      subtitle: "Network command, beds, telemetry & rosters",
      target: destinations.workspaces.hospitalOperations,
      icon: Building2,
      accessNote: destinations.workspaces.hospitalOperations.authorized ? "Authorized" : "Staff sign-in",
    },
    {
      title: "Clinician Workspace",
      subtitle: "OPD consultations, SOAP notes & Sentinel",
      target: destinations.workspaces.clinicianWorkspace,
      icon: Stethoscope,
      accessNote: destinations.workspaces.clinicianWorkspace.authorized ? "Authorized" : "Staff sign-in",
    },
    {
      title: "Emergency Triage",
      subtitle: "STAT prioritization and red-flag response",
      target: destinations.workspaces.emergencyTriage,
      icon: Activity,
      accessNote: destinations.workspaces.emergencyTriage.authorized ? "Authorized" : "Staff sign-in",
    },
    {
      title: "Patient Kiosk",
      subtitle: "Assisted multilingual check-in and tokens",
      target: destinations.workspaces.patientKiosk,
      icon: UserCheck,
      accessNote: "Public intake",
    },
    {
      title: "Pharmacy & Inventory",
      subtitle: "Rx-to-Shelf routing, stock & counter billing",
      target: destinations.workspaces.pharmacyInventory,
      icon: Package,
      accessNote: destinations.workspaces.pharmacyInventory.authorized ? "Authorized" : "Staff sign-in",
    },
    {
      title: "Home Recovery",
      subtitle: "Health Thread, check-ins & medication refills",
      target: destinations.workspaces.homeRecovery,
      icon: Heart,
      accessNote: destinations.workspaces.homeRecovery.authorized ? "Signed in" : "Patient sign-in",
    },
  ];

  const permittedStaffItems = hasStaffSession
    ? staffNavItems(verifiedRole).filter(({ route }) => routeAccess(route, verifiedRole) !== "None")
    : [];

  return (
    <>
      <a
        href="#public-main"
        onClick={(event) => {
          event.preventDefault();
          scrollToSection("public-main");
        }}
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[110] focus:rounded-xl focus:bg-[#047C61] focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg"
      >
        Skip to public content
      </a>

      <header className="sticky top-0 z-40 border-b border-[#EAE6DC] bg-[#FEFBF6]/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <nav
            aria-label="Public navigation"
            className="flex w-full items-center justify-between gap-2 lg:gap-4"
          >
            {/* Left Group: JEEVIKA Logo + Menu */}
            <div className="flex shrink-0 items-center gap-2.5 sm:gap-3.5">
              <Link
                to="/"
                aria-label="JEEVIKA home"
                aria-current={location.pathname === "/" || location.pathname === "/overview" ? "page" : undefined}
                onClick={(event) => {
                  if (location.pathname === "/" || location.pathname === "/overview") {
                    event.preventDefault();
                    scrollToSection("phase-01");
                  }
                }}
                className="inline-flex min-h-11 items-center rounded-lg px-0.5"
              >
                <img
                  src="/assets/logo-jeevika.png"
                  alt="JEEVIKA"
                  width={114}
                  height={38}
                  className="h-8 w-auto object-contain sm:h-9"
                />
              </Link>

              <button
                ref={menuTriggerRef}
                type="button"
                aria-expanded={menuOpen}
                aria-controls={drawerId}
                onClick={openMenu}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-[#E4DEC9] bg-[#F4EFE4] px-3 py-1.5 text-sm font-semibold text-[#132924] shadow-[0_1px_2px_rgba(14,36,32,0.04)] transition-colors hover:bg-[#EAE3D3] cursor-pointer"
              >
                <HamburgerLinesIcon className="size-4 text-[#182E29]" />
                <span>Menu</span>
                <ChevronDown aria-hidden="true" className="size-3.5 text-[#51645E]" />
              </button>
            </div>

            {/* Center Inline Navigation Links (Desktop >= 1024px matching approved order) */}
            <ul className="hidden lg:flex items-center gap-3.5 xl:gap-7 whitespace-nowrap text-[13.5px] xl:text-[14px] font-medium text-[#182B27]">
              <li
                ref={platformWrapRef}
                className="relative"
                onPointerEnter={(event) => {
                  if (
                    event.pointerType !== "touch" &&
                    typeof window !== "undefined" &&
                    window.matchMedia("(hover: hover)").matches
                  ) {
                    openPlatformPopover(true);
                  }
                }}
                onPointerLeave={() => {
                  if (platformHoverPreview) hidePlatformPopover();
                }}
                onBlur={(event) => {
                  if (
                    event.relatedTarget &&
                    !platformWrapRef.current?.contains(event.relatedTarget as Node)
                  ) {
                    hidePlatformPopover();
                  }
                }}
              >
                <button
                  ref={platformTriggerRef}
                  type="button"
                  aria-expanded={platformOpen}
                  aria-controls={platformPopoverId}
                  onClick={(event) => {
                    if (platformOpen && platformHoverPreview) {
                      setPlatformHoverPreview(false);
                      event.preventDefault();
                      return;
                    }
                    if (platformOpen) hidePlatformPopover();
                    else openPlatformPopover(false);
                  }}
                  style={{ anchorName: "--jvk-platform-trigger" } as React.CSSProperties}
                  className="inline-flex min-h-11 items-center gap-1 whitespace-nowrap rounded-lg px-1.5 text-[#182B27] transition-colors hover:text-[#047C61] cursor-pointer"
                >
                  <span>Platform</span>
                  <ChevronDown
                    aria-hidden="true"
                    className={`size-3.5 text-[#4B5D57] transition-transform ${platformOpen ? "rotate-180" : ""}`}
                  />
                </button>

                <div
                  id={platformPopoverId}
                  ref={platformPopoverRef}
                  style={
                    {
                      positionAnchor: "--jvk-platform-trigger",
                      positionArea: "block-end span-inline-end",
                      positionTryFallbacks: "flip-block, flip-inline",
                      inset: "auto",
                      marginBlockStart: "0.45rem",
                    } as React.CSSProperties
                  }
                  className="jeevika-platform-popover w-64 rounded-2xl border border-[#EAE6DC] bg-[#FFFDF9] p-2 text-left shadow-xl"
                >
                  <button
                    type="button"
                    onClick={() => jumpToSection("workspaces")}
                    className="jvk-motion-control flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-[#0E2420] hover:bg-[#D8EFE2] hover:text-[#035442] cursor-pointer"
                  >
                    <span>Five connected workspaces</span>
                    <ArrowRight aria-hidden="true" className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => jumpToSection("journey")}
                    className="jvk-motion-control flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-medium text-[#2A3F3A] hover:bg-[#D8EFE2] hover:text-[#035442] cursor-pointer"
                  >
                    <span>Connected patient journey</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => jumpToSection("engines")}
                    className="jvk-motion-control flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-medium text-[#2A3F3A] hover:bg-[#D8EFE2] hover:text-[#035442] cursor-pointer"
                  >
                    <span>Four intelligence engines</span>
                  </button>
                </div>
              </li>

              <li>
                <button
                  type="button"
                  onClick={() => jumpToSection("journey")}
                  className="inline-flex min-h-11 items-center whitespace-nowrap rounded-lg px-1.5 text-[#182B27] transition-colors hover:text-[#047C61] cursor-pointer"
                >
                  Our approach
                </button>
              </li>

              <li>
                <button
                  type="button"
                  onClick={() => jumpToSection("trust")}
                  className="inline-flex min-h-11 items-center whitespace-nowrap rounded-lg px-1.5 text-[#182B27] transition-colors hover:text-[#047C61] cursor-pointer"
                >
                  Trust &amp; care
                </button>
              </li>

              <li>
                <Link
                  to="/kiosk"
                  className="inline-flex min-h-11 items-center whitespace-nowrap rounded-lg px-1.5 text-[#182B27] transition-colors hover:text-[#047C61]"
                >
                  Patient Kiosk
                </Link>
              </li>
            </ul>

            {/* Right Group: Patient sign-in + Enter workspace */}
            <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
              <Link
                to={destinations.patientSignIn.to}
                state={destinations.patientSignIn.state}
                className="jvk-motion-action hidden sm:inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-xl border border-[#BBD8CC] bg-[#EEF8F3] px-3 py-1.5 text-[13.5px] font-semibold text-[#11312B] hover:bg-[#E1F3EA] xl:px-3.5 xl:text-sm"
              >
                <SignInDoorIcon className="size-4 text-[#047C61]" />
                <span>Patient sign-in</span>
              </Link>

              <Link
                to={destinations.enterWorkspace.to}
                state={destinations.enterWorkspace.state}
                className="jvk-motion-action inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-xl bg-[#047C61] px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[#036450] sm:px-3.5 sm:text-[13.5px] xl:px-4 xl:text-sm"
              >
                <span>Enter workspace</span>
                <ArrowRight aria-hidden="true" className="jvk-motion-arrow size-3.5 sm:size-4" />
              </Link>
            </div>
          </nav>
        </div>
      </header>

      {/* Accessible Native <dialog> Navigation Drawer triggered by Menu button */}
      <dialog
        ref={dialogRef}
        id={drawerId}
        aria-label="JEEVIKA menu"
        onClick={(event) => {
          if (event.target === dialogRef.current) closeMenu();
        }}
        className="jeevika-menu-dialog"
      >
        <div className="flex h-full flex-col overflow-hidden p-4 sm:p-5">
          <div className="flex shrink-0 items-center justify-between border-b border-[#EAE6DC] pb-3.5">
            <Link
              to="/"
              aria-label="JEEVIKA home"
              onClick={() => jumpToSection("phase-01")}
              className="inline-flex items-center"
            >
              <img
                src="/assets/logo-jeevika.png"
                alt="JEEVIKA"
                width={108}
                height={36}
                className="h-8 w-auto object-contain"
              />
            </Link>
            <button
              type="button"
              autoFocus
              aria-label="Close menu"
              onClick={closeMenu}
              className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-xl border border-[#E4DEC9] bg-[#F4EFE4] px-3 text-sm font-semibold text-[#132924] transition-colors hover:bg-[#EAE3D3] cursor-pointer"
            >
              <X aria-hidden="true" className="size-4 text-[#047C61]" />
              <span>Close</span>
            </button>
          </div>

          <nav aria-label="Menu drawer navigation" className="mt-4 flex-1 space-y-5 overflow-y-auto pr-1">
            {/* Section Jumps */}
            <div>
              <h2 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-[#5A6D67]">
                Public overview
              </h2>
              <ul className="space-y-1">
                <li>
                  <button
                    type="button"
                    onClick={() => jumpToSection("phase-01")}
                    className="flex min-h-11 w-full items-center justify-between rounded-xl px-3 text-left text-sm font-semibold text-[#0E2420] hover:bg-[#EEF8F3] hover:text-[#047C61] cursor-pointer"
                  >
                    <span>Healthcare Overview</span>
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => jumpToSection("journey")}
                    className="flex min-h-11 w-full items-center justify-between rounded-xl px-3 text-left text-sm font-semibold text-[#0E2420] hover:bg-[#EEF8F3] hover:text-[#047C61] cursor-pointer"
                  >
                    <span>Our approach — Patient Journey</span>
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => jumpToSection("workspaces")}
                    className="flex min-h-11 w-full items-center justify-between rounded-xl px-3 text-left text-sm font-semibold text-[#0E2420] hover:bg-[#EEF8F3] hover:text-[#047C61] cursor-pointer"
                  >
                    <span>Platform — Five Workspaces</span>
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => jumpToSection("engines")}
                    className="flex min-h-11 w-full items-center justify-between rounded-xl px-3 text-left text-sm font-semibold text-[#0E2420] hover:bg-[#EEF8F3] hover:text-[#047C61] cursor-pointer"
                  >
                    <span>Intelligence Engines</span>
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => jumpToSection("trust")}
                    className="flex min-h-11 w-full items-center justify-between rounded-xl px-3 text-left text-sm font-semibold text-[#0E2420] hover:bg-[#EEF8F3] hover:text-[#047C61] cursor-pointer"
                  >
                    <span>Trust &amp; care</span>
                  </button>
                </li>
              </ul>
            </div>

            {/* Active Staff Session Permitted Links (when authenticated as Staff) */}
            {permittedStaffItems.length > 0 && (
              <div>
                <h2 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-[#047C61]">
                  Your staff workspace ({verifiedRole?.replace("_", " ")})
                </h2>
                <ul className="space-y-1.5">
                  {permittedStaffItems.map((item) => (
                    <li key={item.id}>
                      <Link
                        to={item.route}
                        onClick={closeMenu}
                        className="flex min-h-11 items-center justify-between rounded-xl border border-[#DCEAE2] bg-[#F5FBF8] px-3.5 text-sm font-semibold text-[#0E2420] hover:border-[#047C61] hover:text-[#047C61]"
                      >
                        <span>{item.label}</span>
                        <ArrowRight aria-hidden="true" className="size-4 text-[#047C61]" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Authorized Portals */}
            <div>
              <h2 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-[#5A6D67]">
                Workspaces &amp; intake
              </h2>
              <ul className="space-y-2">
                {drawerWorkspaces.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.title}>
                      <Link
                        to={item.target.to}
                        state={item.target.state}
                        onClick={closeMenu}
                        className="jvk-motion-card jvk-motion-card-shadow flex items-start gap-3 rounded-xl border border-[#EAE6DC] bg-[#FFFDF8] p-3 hover:border-[#047C61]/45 hover:bg-[#F5FBF8]"
                      >
                        <div className="mt-0.5 rounded-lg bg-[#E7F2E8] p-2 text-[#047C61]">
                          <Icon aria-hidden="true" className="size-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-semibold text-[#0E2420]">
                              {item.title}
                            </span>
                            <span className="shrink-0 rounded-full bg-[#F3EFE6] px-2 py-0.5 text-[11px] font-medium text-[#4B5D57]">
                              {item.accessNote}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-[#4B5D57]">{item.subtitle}</p>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </nav>

          {/* Drawer Footer Auth Actions */}
          <div className="mt-4 shrink-0 space-y-2 border-t border-[#EAE6DC] pt-3.5">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Link
                to={destinations.patientSignIn.to}
                state={destinations.patientSignIn.state}
                onClick={closeMenu}
                className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-[#BBD8CC] bg-[#EEF8F3] px-3 py-2 text-sm font-semibold text-[#11312B] hover:bg-[#E1F3EA]"
              >
                <SignInDoorIcon className="size-4 text-[#047C61]" />
                <span>{hasPatientSession ? "Patient portal" : "Patient sign-in"}</span>
              </Link>
              <Link
                to={destinations.enterWorkspace.to}
                state={destinations.enterWorkspace.state}
                onClick={closeMenu}
                className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-[#047C61] px-3 py-2 text-sm font-semibold text-white hover:bg-[#036450]"
              >
                <span>{hasStaffSession ? "Open workspace" : "Enter workspace"}</span>
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </div>
            {(hasStaffSession || hasPatientSession) && (
              <button
                type="button"
                disabled={signingOut}
                onClick={() => void handleSignOut()}
                className="inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-[#E5D5D8] bg-[#FFF5F6] px-3 text-xs font-semibold text-[#9F1D32] hover:bg-[#FFE9EC] cursor-pointer"
              >
                <LogOut aria-hidden="true" className="size-3.5" />
                <span>{signingOut ? "Signing out…" : "Sign out"}</span>
              </button>
            )}
            <p className="flex items-center justify-center gap-1.5 pt-1 text-[11px] text-[#556862]">
              <ShieldCheck aria-hidden="true" className="size-3.5 text-[#047C61]" />
              <span>Role-protected clinical and patient access</span>
            </p>
          </div>
        </div>
      </dialog>
    </>
  );
}
