import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-[var(--ds-surface-canvas)] text-[var(--ds-text-primary)]">
      <button
        type="button"
        onClick={() => document.getElementById("public-main")?.focus()}
        className="sr-only focus:not-sr-only focus:block focus:p-3"
      >
        Skip to public content
      </button>
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <Link
            to="/"
            className="inline-flex min-h-12 items-center gap-2 text-lg font-bold"
          >
            <img
              src="/assets/logo-jeevika.png"
              alt=""
              width="32"
              height="32"
              className="object-contain"
            />
            JEEVIKA
          </Link>
          <nav
            className="flex flex-wrap gap-x-4 text-sm font-semibold"
            aria-label="Public navigation"
          >
            <Link className="inline-flex min-h-12 items-center" to="/kiosk">
              Patient kiosk
            </Link>
            <Link
              className="inline-flex min-h-12 items-center"
              to="/home/sign-in"
            >
              Patient sign-in
            </Link>
            <Link className="inline-flex min-h-12 items-center" to="/login">
              Staff login
            </Link>
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
