import type { ReactNode } from "react";

export function KioskLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-dvh w-full bg-white text-[var(--ds-text-primary)]">
      <div className="mx-auto min-h-dvh w-full max-w-6xl px-4 py-4 sm:px-6 sm:py-6">
        {children}
      </div>
    </main>
  );
}
