import { ArrowRight } from "lucide-react";
import {
  ClipboardCheckIcon,
  GoldUnderline,
  HomePlusIcon,
  PillCapsuleIcon,
  StethoscopeIcon,
} from "./shared";

const journeyStages = [
  {
    title: "Intake",
    description: "Capture symptoms, history, and needs in a few steps.",
    Icon: ClipboardCheckIcon,
  },
  {
    title: "Consultation",
    description: "Enable informed, context-rich clinical care.",
    Icon: StethoscopeIcon,
  },
  {
    title: "Pharmacy",
    description: "Turn care into treatment with clear, timely access.",
    Icon: PillCapsuleIcon,
  },
  {
    title: "Home Recovery",
    description: "Stay supported with guided follow-up and recovery tools.",
    Icon: HomePlusIcon,
  },
] as const;

export function PatientJourneySection() {
  return (
    <div id="journey" className="relative scroll-mt-20 pt-10 pb-10 lg:pt-14 lg:pb-12">
      {/* Left watercolor botanical accent */}
      <img
        src="/assets/landing/botanical-journey-left.png"
        alt=""
        aria-hidden="true"
        loading="lazy"
        width={175}
        height={86}
        className="pointer-events-none select-none absolute bottom-1 left-0 hidden h-24 w-auto opacity-95 lg:block"
      />

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12 lg:gap-6">
          {/* Left Copy */}
          <div className="lg:col-span-4 space-y-3">
            <h2 className="text-3xl font-bold tracking-tight text-[#0E2420] leading-[1.14] sm:text-4xl">
              Connected
              <br />
              patient{" "}
              <span className="relative inline-block jeevika-serif-italic pr-1">
                journey.
                <GoldUnderline className="absolute -bottom-1 left-0 h-2 w-full" />
              </span>
            </h2>
            <p className="max-w-xs text-sm leading-relaxed text-[#435650] sm:text-[15px]">
              A seamless, end-to-end experience that keeps care, people, and
              information in sync.
            </p>
          </div>

          {/* Right 4 Connected Stages */}
          <div className="lg:col-span-8">
            <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] xl:items-stretch xl:gap-2">
              {journeyStages.map(({ title, description, Icon }, idx) => (
                <li
                  key={title}
                  className="contents"
                >
                  <div className="flex flex-col items-center rounded-2xl border border-[#EAE6DC] bg-[#FCFBF6] p-4 text-center shadow-[0_4px_16px_rgba(14,36,32,0.04)] sm:p-5 xl:items-start xl:text-left">
                    <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-[#E7F2E8] text-[#047C61] xl:mx-auto">
                      <Icon className="size-6" />
                    </div>
                    <h3 className="text-base font-bold text-[#0E2420]">{title}</h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-[#4B5D57] sm:text-[13px]">
                      {description}
                    </p>
                  </div>
                  {idx < journeyStages.length - 1 && (
                    <div
                      aria-hidden="true"
                      className="hidden xl:flex items-center justify-center text-[#047C61]"
                    >
                      <ArrowRight className="size-4 shrink-0 stroke-[2]" />
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>

      {/* Subtle horizontal rule separator */}
      <div
        aria-hidden="true"
        className="mx-auto mt-10 h-px max-w-6xl bg-gradient-to-r from-transparent via-[#DFDCD0] to-transparent lg:mt-14"
      />
    </div>
  );
}
