import type { ReactNode } from "react";
import { LandingNavbar } from "@/components/landing-public/LandingNavbar";
import { useScrollToPublicSection } from "@/components/landing-public/shared";

export { useScrollToPublicSection };

interface PublicLayoutProps {
  children: ReactNode;
}

export function PublicLayout({ children }: PublicLayoutProps) {
  return (
    <div className="jeevika-landing min-h-dvh bg-[#FEFBF6] font-sans text-[#0E2420] antialiased flex flex-col selection:bg-[#E7F2E8] selection:text-[#047C61]">
      <LandingNavbar />
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
