import { useEffect } from "react";
import { FinalCallToAction } from "./FinalCallToAction";
import { HeroSection } from "./HeroSection";
import { IntelligenceEnginesSection } from "./IntelligenceEnginesSection";
import { LandingFooter } from "./LandingFooter";
import { PatientJourneySection } from "./PatientJourneySection";
import { TrustAndGovernanceSection } from "./TrustAndGovernanceSection";
import { WorkspaceShowcase } from "./WorkspaceShowcase";

export function PublicLandingPage() {
  useEffect(() => {
    document.documentElement.classList.add("jeevika-landing-snap");
    return () => document.documentElement.classList.remove("jeevika-landing-snap");
  }, []);

  return (
    <>
      <main id="public-main" tabIndex={-1} className="w-full focus:outline-none">
        {/* Phase 01 — Default Landing Screen */}
        <HeroSection />

        {/* Phase 02 — Connected Patient Journey & Five Connected Workspaces */}
        <section id="phase-02" className="jeevika-phase-snap bg-[#FAF7F0]">
          <PatientJourneySection />
          <WorkspaceShowcase />
        </section>

        {/* Phase 03 — Four Mathematical Intelligence Engines, Trust & Oversight, and Final CTA */}
        <section id="phase-03" className="jeevika-phase-snap bg-[#FEFBF6]">
          <IntelligenceEnginesSection />
          <TrustAndGovernanceSection />
          <FinalCallToAction />
        </section>
      </main>
      <LandingFooter />
    </>
  );
}
