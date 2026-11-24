import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Stethoscope,
  Activity,
  Building2,
  Package,
  UserCheck,
  PhoneCall,
  LogIn,
  Layers,
  ArrowRight
} from "lucide-react";

interface PublicLayoutProps {
  children: ReactNode;
}

export function PublicLayout({ children }: PublicLayoutProps) {
  // Desktop side panel collapsed state: true = inside (hidden), false = outside (visible)
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(true);
  // Mobile side panel open state: false = hidden, true = FULL SCREEN overlay where nothing else is visible
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navLinks = [
    { label: "Platform", href: "/#ds-platform" },
    { label: "Our approach", href: "/#ds-journey" },
    { label: "Trust & care", href: "/#ds-safety" },
    { label: "Patient Kiosk", href: "/kiosk" },
  ];

  const workspaceLinks = [
    {
      title: "Patient Intake Kiosk",
      description: "Touchless voice symptom intake, ABHA lookup & queue tokens",
      href: "/kiosk",
      icon: UserCheck,
      badge: "Kiosk",
      badgeColor: "bg-amber-50 text-amber-800 border-amber-200",
    },
    {
      title: "Doctor Consultation",
      description: "Clinician OPD cockpit with pre-consult context & Sentinel safety",
      href: "/app?view=doctor-consultation",
      icon: Stethoscope,
      badge: "OPD",
      badgeColor: "bg-emerald-50 text-emerald-800 border-emerald-200",
    },
    {
      title: "Emergency Triage",
      description: "Rapid STAT color-coded triage when seconds matter",
      href: "/app?view=emergency-triage",
      icon: Activity,
      badge: "STAT",
      badgeColor: "bg-rose-50 text-rose-800 border-rose-200",
    },
    {
      title: "Clinic Operations & POS",
      description: "Pharmacy inventory, billing ledger & counter queues",
      href: "/app?view=clinic-admin",
      icon: Package,
      badge: "Operations",
      badgeColor: "bg-blue-50 text-blue-800 border-blue-200",
    },
    {
      title: "Headquarters Command",
      description: "Network health telemetry, drift radar & multi-facility oversight",
      href: "/app?view=admin",
      icon: Building2,
      badge: "HQ",
      badgeColor: "bg-indigo-50 text-indigo-800 border-indigo-200",
    },
  ];

  const handleLinkClick = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="min-h-dvh bg-[#FAF8F5] text-[#182724] font-sans antialiased flex flex-col selection:bg-[#E6F4EF] selection:text-[#087F72]">
      {/* Skip Link for Accessibility */}
      <a
        href="#public-main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[110] focus:px-4 focus:py-2 focus:bg-[#087F72] focus:text-white focus:rounded-md focus:shadow-lg"
      >
        Skip to public content
      </a>

      {/* ───────────────────────────────────────────────────────────
          MOBILE FULL-SCREEN SIDE PANEL
          Rule: In mobile view, when side panel is visible, NOTHING ELSE
          should be visible, ONLY the side panel (100% full screen overlay).
         ─────────────────────────────────────────────────────────── */}
      {isMobileMenuOpen && (
        <aside
          id="mobile-side-panel"
          aria-label="Mobile Navigation Panel"
          className="fixed inset-0 z-[100] w-screen h-screen bg-[#FFFDF9] text-[#182724] flex flex-col overflow-y-auto p-6 animate-in fade-in duration-200"
        >
          {/* Mobile Panel Header */}
          <div className="flex items-center justify-between pb-6 border-b border-[#E6E9DF]">
            <Link
              to="/"
              onClick={handleLinkClick}
              className="inline-flex items-center gap-2.5"
            >
              <img
                src="/assets/logo-jeevika.png"
                alt="Jeevika Logo"
                className="h-9 w-auto object-contain"
              />
              <span className="font-serif text-2xl font-bold tracking-tight text-[#087F72]">
                JEEVIKA
              </span>
            </Link>
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(false)}
              aria-label="Close side panel"
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#F1F5F2] hover:bg-[#E6E9DF] text-[#182724] font-medium text-sm transition-colors border border-[#E3EAE6]"
            >
              <X className="w-5 h-5 text-[#087F72]" />
              <span>Close</span>
            </button>
          </div>

          {/* Quick Actions at Top of Mobile Drawer */}
          <div className="py-5 grid grid-cols-2 gap-3 border-b border-[#E6E9DF]">
            <Link
              to="/kiosk"
              onClick={handleLinkClick}
              className="flex flex-col p-3 rounded-xl bg-[#E6F4EF] text-[#087F72] border border-[#C5E6DB] font-semibold text-center hover:bg-[#D5EFE6] transition-colors"
            >
              <UserCheck className="w-5 h-5 mx-auto mb-1" />
              <span className="text-sm">Patient Kiosk</span>
            </Link>
            <Link
              to="/home/sign-in"
              onClick={handleLinkClick}
              className="flex flex-col p-3 rounded-xl bg-white text-[#182724] border border-[#E3EAE6] font-semibold text-center hover:bg-[#FAF8F5] transition-colors shadow-sm"
            >
              <LogIn className="w-5 h-5 mx-auto mb-1 text-[#087F72]" />
              <span className="text-sm">Patient Sign-in</span>
            </Link>
          </div>

          {/* Mobile Workspaces Section */}
          <div className="py-5">
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-[#61716B] mb-3">
              Connected Workspaces
            </h2>
            <div className="space-y-2.5">
              {workspaceLinks.map((ws) => {
                const IconComponent = ws.icon;
                return (
                  <Link
                    key={ws.title}
                    to={ws.href}
                    onClick={handleLinkClick}
                    className="flex items-start gap-3.5 p-3 rounded-xl bg-white hover:bg-[#F8FAF8] border border-[#E3EAE6] shadow-sm transition-all active:scale-[0.99]"
                  >
                    <div className="p-2 rounded-lg bg-[#F1F5F2] text-[#087F72] shrink-0">
                      <IconComponent className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-sm text-[#182724] truncate">
                          {ws.title}
                        </span>
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${ws.badgeColor}`}>
                          {ws.badge}
                        </span>
                      </div>
                      <p className="text-xs text-[#61716B] mt-0.5 line-clamp-2">
                        {ws.description}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Mobile General Links */}
          <div className="py-4 border-t border-[#E6E9DF] space-y-2">
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-[#61716B] mb-2">
              Platform & Ethics
            </h2>
            <Link
              to="/#ds-platform"
              onClick={handleLinkClick}
              className="block py-2 text-sm font-medium text-[#182724] hover:text-[#087F72]"
            >
              Platform Overview
            </Link>
            <Link
              to="/#ds-journey"
              onClick={handleLinkClick}
              className="block py-2 text-sm font-medium text-[#182724] hover:text-[#087F72]"
            >
              Our Approach to Continuous Care
            </Link>
            <Link
              to="/#ds-safety"
              onClick={handleLinkClick}
              className="block py-2 text-sm font-medium text-[#182724] hover:text-[#087F72]"
            >
              Clinical Oversight & Safety
            </Link>
            <Link
              to="/login"
              onClick={handleLinkClick}
              className="block py-2 text-sm font-medium text-[#182724] hover:text-[#087F72]"
            >
              Staff & Clinician Login →
            </Link>
          </div>

          {/* Emergency Helpline Pill */}
          <div className="mt-auto pt-6 border-t border-[#E6E9DF]">
            <div className="p-3.5 rounded-xl bg-[#FFF0F1] border border-[#FCD6DB] text-[#C8213B] flex items-center gap-3">
              <PhoneCall className="w-5 h-5 shrink-0" />
              <div className="text-xs">
                <span className="font-bold block">Emergency assistance</span>
                <span>Dial 108 / 112 for acute emergency ambulance</span>
              </div>
            </div>
          </div>
        </aside>
      )}

      {/* ───────────────────────────────────────────────────────────
          MAIN PUBLIC HEADER
         ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-[#FFFDF9]/95 backdrop-blur-md border-b border-[#E6E9DF] transition-all">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 h-16">
          {/* Left: Mobile Hamburger & Desktop Side Panel Toggle + Brand */}
          <div className="flex items-center gap-3">
            {/* Mobile Hamburger Button (☰) */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Open mobile navigation panel"
              aria-expanded={isMobileMenuOpen}
              className="lg:hidden inline-flex items-center justify-center p-2 rounded-xl text-[#182724] hover:bg-[#F1F5F2] border border-[#E3EAE6] transition-colors"
            >
              <Menu className="w-5 h-5 text-[#087F72]" />
            </button>

            {/* Desktop Side Panel Toggle Button */}
            <button
              type="button"
              onClick={() => setIsDesktopCollapsed((prev) => !prev)}
              aria-label={isDesktopCollapsed ? "Open side panel" : "Collapse side panel"}
              title={isDesktopCollapsed ? "Open side panel (comes out)" : "Collapse side panel (goes inside)"}
              className="hidden lg:inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold text-[#182724] bg-[#FAF8F5] hover:bg-[#F1F5F2] border border-[#E3EAE6] transition-all"
            >
              {isDesktopCollapsed ? (
                <>
                  <ChevronRight className="w-4 h-4 text-[#087F72]" />
                  <span>Open side panel</span>
                </>
              ) : (
                <>
                  <ChevronLeft className="w-4 h-4 text-[#087F72]" />
                  <span>Collapse panel</span>
                </>
              )}
            </button>

            {/* Brand Logo */}
            <Link
              to="/"
              className="inline-flex items-center gap-2.5 group"
            >
              <img
                src="/assets/logo-jeevika.png"
                alt="Jeevika Logo"
                className="h-8 w-auto object-contain transition-transform group-hover:scale-105"
              />
              <div className="flex items-baseline gap-1.5">
                <span className="font-serif text-2xl font-bold tracking-tight text-[#087F72]">
                  Ayu<span className="text-[#D98558]">सेतु</span>
                </span>
                <span className="text-xs font-bold font-mono tracking-wider text-[#61716B] uppercase hidden sm:inline">
                  JEEVIKA
                </span>
              </div>
            </Link>
          </div>

          {/* Center: Desktop Navigation Links */}
          <nav
            className="hidden md:flex items-center gap-6 text-sm font-semibold text-[#50645B]"
            aria-label="Public website links"
          >
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="hover:text-[#087F72] transition-colors"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Right: Actions */}
          <div className="flex items-center gap-2.5">
            <Link
              to="/home/sign-in"
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#182724] hover:text-[#087F72] transition-colors"
            >
              <LogIn className="w-4 h-4" />
              <span>Patient sign-in</span>
            </Link>
            <a
              href="#ds-workspaces"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#087F72] hover:bg-[#06695F] text-white text-xs sm:text-sm font-semibold shadow-sm hover:shadow transition-all active:scale-[0.98]"
            >
              <span>Enter workspace</span>
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </header>

      {/* ───────────────────────────────────────────────────────────
          BODY CONTAINER WITH COLLAPSIBLE DESKTOP SIDE PANEL
         ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex w-full relative overflow-x-hidden">
        {/* DESKTOP COLLAPSIBLE SIDE PANEL */}
        <aside
          id="desktop-side-panel"
          aria-label="Desktop Side Panel"
          className={`hidden lg:block shrink-0 bg-[#FFFDF9] border-r border-[#E6E9DF] transition-all duration-300 ease-in-out relative z-30 ${
            isDesktopCollapsed ? "w-0 overflow-hidden border-r-0 opacity-0" : "w-80 opacity-100 p-5 overflow-y-auto"
          }`}
          style={{ height: "calc(100vh - 4rem)", position: "sticky", top: "4rem" }}
        >
          {/* Panel Header with Button to Collapse (Goes inside) */}
          <div className="flex items-center justify-between pb-4 border-b border-[#E6E9DF] mb-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#61716B]">
              <Layers className="w-4 h-4 text-[#087F72]" />
              <span>Workspace Directory</span>
            </div>
            <button
              type="button"
              onClick={() => setIsDesktopCollapsed(true)}
              title="Collapse panel (goes inside)"
              aria-label="Collapse panel"
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg text-[#50645B] hover:text-[#182724] hover:bg-[#F1F5F2] transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5 text-[#087F72]" />
              <span>Hide</span>
            </button>
          </div>

          {/* Workspace Quick Links */}
          <div className="space-y-2.5">
            {workspaceLinks.map((ws) => {
              const IconComp = ws.icon;
              return (
                <Link
                  key={ws.title}
                  to={ws.href}
                  className="group block p-3 rounded-xl bg-white hover:bg-[#F8FAF8] border border-[#E3EAE6] hover:border-[#087F72]/40 transition-all shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="p-1.5 rounded-lg bg-[#E6F4EF] text-[#087F72] group-hover:bg-[#087F72] group-hover:text-white transition-colors">
                        <IconComp className="w-4 h-4" />
                      </div>
                      <span className="font-semibold text-xs text-[#182724] truncate">
                        {ws.title}
                      </span>
                    </div>
                    <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full border ${ws.badgeColor}`}>
                      {ws.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#61716B] mt-2 line-clamp-2 leading-relaxed">
                    {ws.description}
                  </p>
                </Link>
              );
            })}
          </div>

          {/* Quick Staff Sign-in Box */}
          <div className="mt-6 p-4 rounded-xl bg-[#FAF8F5] border border-[#E3EAE6] text-xs">
            <span className="font-bold text-[#182724] block mb-1">Clinic Staff & Clinicians</span>
            <p className="text-[#61716B] text-[11px] mb-3">
              Secure single sign-on access to OPD, triage, and pharmacy rosters.
            </p>
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#087F72] hover:text-[#06695F]"
            >
              <span>Staff Login</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </aside>

        {/* FLOATING TAB TRIGGER WHEN DESKTOP PANEL IS COLLAPSED (COMES OUT) */}
        {isDesktopCollapsed && (
          <button
            type="button"
            onClick={() => setIsDesktopCollapsed(false)}
            title="Open side panel (comes out)"
            aria-label="Open side panel"
            className="hidden lg:flex fixed left-0 top-24 z-30 items-center gap-1.5 px-3 py-2 bg-[#FFFDF9] hover:bg-[#E6F4EF] text-[#087F72] border border-l-0 border-[#E3EAE6] rounded-r-xl shadow-md text-xs font-bold transition-all hover:translate-x-0.5"
          >
            <ChevronRight className="w-4 h-4" />
            <span className="writing-vertical text-[11px] tracking-wider uppercase">Menu</span>
          </button>
        )}

        {/* MAIN PAGE CONTENT */}
        <div className="flex-1 min-w-0">
          {children}
        </div>
      </div>
    </div>
  );
}
