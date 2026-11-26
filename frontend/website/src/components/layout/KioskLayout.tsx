import type { ReactNode } from "react";
import { useRouteEntrance } from "@/lib/transitions";
import "@/design-system/kiosk.css";

export function KioskLayout({ children }: { children: ReactNode }) {
  const entranceRef = useRouteEntrance("/kiosk");
  return (
    <main
      ref={entranceRef}
      className="jvk-kiosk-shell min-h-dvh w-full text-[#0E2420] font-sans antialiased selection:bg-[#E5F2EA] selection:text-[#047C61]"
    >
      <div className="mx-auto min-h-dvh w-full max-w-[920px] px-3 py-4 sm:px-6 sm:py-8">
        {children}
      </div>
    </main>
  );
}
