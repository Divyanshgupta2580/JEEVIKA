import type { ReactNode } from "react";
import { useRouteEntrance } from "@/lib/transitions";

export function KioskLayout({ children }: { children: ReactNode }) {
  const entranceRef = useRouteEntrance("/kiosk");
  return (
    <main ref={entranceRef} className="min-h-dvh w-full bg-[#FAF8F5] text-[#182724] font-sans antialiased selection:bg-[#E6F4EF] selection:text-[#087F72]">
      <div className="mx-auto min-h-dvh w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        {children}
      </div>
    </main>
  );
}
