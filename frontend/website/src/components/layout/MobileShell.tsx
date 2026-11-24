import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Activity,
  CalendarCheck,
  Ellipsis,
  Pill,
  ScrollText,
} from "lucide-react";

const tabs = [
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

export function MobileShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const section = pathname.split("/").filter(Boolean).at(-1) ?? "thread";
  return (
    <div className="mx-auto min-h-dvh w-full max-w-xl bg-[var(--ds-surface-canvas)] pb-24">
      <button
        type="button"
        onClick={() => document.getElementById("patient-main")?.focus()}
        className="sr-only focus:not-sr-only focus:block focus:p-3"
      >
        Skip to patient content
      </button>
      <main id="patient-main" tabIndex={-1}>
        {children}
      </main>
      <nav
        aria-label="Patient home navigation"
        className="fixed inset-x-0 bottom-0 z-[var(--ds-z-nav)] mx-auto grid max-w-xl grid-cols-5 border-t border-[var(--ds-border-subtle)] bg-white pb-[env(safe-area-inset-bottom)]"
      >
        {tabs.map(({ label, paths, icon: Icon }) => {
          const active = paths.some((path) => path === section);
          return (
            <Link
              key={label}
              to={`/app/home/${paths[0]}`}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 px-1 text-center text-xs font-bold focus-visible:outline-offset-[-4px] ${active ? "bg-[var(--ds-primary-soft)] text-[var(--ds-primary)]" : "text-[var(--ds-text-secondary)]"}`}
            >
              <Icon size={19} aria-hidden="true" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
