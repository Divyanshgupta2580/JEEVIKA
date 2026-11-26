import { ArrowRight } from "lucide-react";
import { landingArtwork } from "@/components/JeevikaLoading";
import { PatientAccessNotice } from "./PatientAccessNotice";
import { PlatformStatistics } from "./PlatformStatistics";
import {
  GoldUnderline,
  MottoShieldIcon,
  SectionDivider,
  useScrollToPublicSection,
} from "./shared";

export function HeroSection() {
  const scrollToSection = useScrollToPublicSection();

  return (
    <section
      id="phase-01"
      aria-labelledby="hero-heading"
      className="jeevika-phase-snap relative flex flex-col justify-between overflow-x-clip bg-[#FEFBF6] lg:min-h-[calc(100dvh-4rem)]"
    >
      {/* Hero Content + Seamlessly Blended Artwork */}
      <div className="relative mx-auto flex w-full max-w-7xl flex-1 items-center px-4 pt-5 pb-4 sm:px-6 lg:px-8 lg:py-6">
        {/* Background/Right Healthcare Illustration on Desktop */}
        <div
          aria-hidden="true"
          data-jvk-entrance="right"
          data-jvk-entrance-bleed=""
          className="pointer-events-none hidden lg:block lg:absolute lg:inset-y-0 lg:right-[-2%] lg:w-[62%] xl:right-[-3%] xl:w-[62%]"
        >
          <img
            src={landingArtwork}
            alt=""
            width={1400}
            height={933}
            fetchPriority="high"
            className="jeevika-hero-artwork h-full w-full object-cover object-[70%_30%]"
          />
          <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-[#FEFBF6] via-[#FEFBF6]/75 to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-[#FEFBF6] via-[#FEFBF6]/45 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#FEFBF6] to-transparent" />
        </div>

        <div className="relative z-10 grid w-full grid-cols-1 items-center gap-6 lg:grid-cols-12">
          {/* Left Hero Column */}
          <div className="space-y-4 sm:space-y-5 lg:col-span-6 xl:col-span-6">
            {/* Eyebrow Pill */}
            <div data-jvk-entrance="left" className="inline-flex items-center gap-2 rounded-full border border-[#EBE1CC] bg-[#F5EFE2] px-3.5 py-1.5 text-xs font-semibold text-[#233731]">
              <span aria-hidden="true" className="size-2 rounded-full bg-[#047C61]" />
              <span>A more connected kind of care</span>
            </div>

            {/* Approved Hero Heading */}
            <h1
              id="hero-heading"
              data-jvk-entrance="left"
              className="font-bold tracking-tight text-[#0E2420] leading-[1.08]"
              style={{ fontSize: "clamp(2.2rem, 3.65vw, 3.55rem)" }}
            >
              Healthcare,
              <br />
              finally{" "}
              <span className="relative inline-block jeevika-serif-italic pr-1">
                connected.
                <GoldUnderline className="absolute -bottom-1 left-0 h-2.5 w-full" />
              </span>
            </h1>

            {/* Supporting Copy */}
            <p data-jvk-entrance="left" className="max-w-md text-[15px] leading-relaxed text-[#435650] sm:text-base">
              One continuous journey from first symptom to recovery. Built for
              patients, care teams, and everyone in between.
            </p>

            {/* Primary & Secondary Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-0.5">
              <button
                type="button"
                onClick={() => scrollToSection("phase-02")}
                className="jvk-motion-action inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#047C61] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_6px_18px_rgba(4,124,97,0.22)] hover:bg-[#036450] cursor-pointer"
              >
                <span>Explore Jeevika</span>
                <ArrowRight aria-hidden="true" className="jvk-motion-arrow size-4" />
              </button>

              <button
                type="button"
                onClick={() => scrollToSection("workspaces")}
                className="jvk-motion-action inline-flex min-h-11 items-center justify-center rounded-xl border border-[#C6D5CE] bg-[#FEFBF6]/92 px-5 py-2.5 text-sm font-semibold text-[#0E2420] hover:bg-[#EFF7F2] cursor-pointer"
              >
                View platform
              </button>
            </div>

            {/* Locked Patient Access Notice */}
            <PatientAccessNotice />

            {/* Clinical Oversight Statement */}
            <p className="flex items-center gap-2 text-xs font-medium text-[#465953]">
              <MottoShieldIcon className="size-4 shrink-0 text-[#047C61]" />
              <span>Built around people. Guided by clinical oversight.</span>
            </p>
          </div>

          {/* Mobile/Tablet Hero Illustration */}
          <div data-jvk-entrance="right" className="lg:hidden">
            <img
              src={landingArtwork}
              alt="Doctor sharing a reassuring consultation moment with a smiling child and her mother"
              width={1400}
              height={933}
              className="jeevika-hero-artwork mx-auto aspect-[1400/933] w-full max-w-xl object-cover object-center"
            />
          </div>
        </div>
      </div>

      {/* Bottom Statistics Strip + Curved Green Boundary */}
      <div className="mt-2 w-full">
        <PlatformStatistics />
        <SectionDivider />
      </div>
    </section>
  );
}
