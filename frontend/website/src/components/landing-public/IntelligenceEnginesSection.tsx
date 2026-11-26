import {
  DriftBarsIcon,
  GoldUnderline,
  PillCapsuleIcon,
  ShieldPlusIcon,
  ThreadNetworkIcon,
} from "./shared";

const engines = [
  {
    name: "Triage Sentinel",
    description:
      "Prioritize care with rule-driven risk screening and red-flag escalation.",
    Icon: ShieldPlusIcon,
  },
  {
    name: "Rx-to-Shelf",
    description:
      "Match prescriptions to allergy-checked, expiry-safe clinic fulfillment.",
    Icon: PillCapsuleIcon,
  },
  {
    name: "Drift Radar",
    description:
      "Spot sustained baseline shifts early using median/MAD CUSUM alerts.",
    Icon: DriftBarsIcon,
  },
  {
    name: "ThreadPulse",
    description:
      "Probabilistic refill demand forecasting and stockout risk at target service levels.",
    Icon: ThreadNetworkIcon,
  },
] as const;

export function IntelligenceEnginesSection() {
  return (
    <div id="engines" className="scroll-mt-20 border-t border-[#EAE6DC] py-12 lg:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12 lg:gap-7">
          {/* Left Copy Column with Subtle Vertical Separator on Desktop */}
          <div data-jvk-reveal="" className="space-y-3 lg:col-span-4 lg:border-r lg:border-[#E5DEC9] lg:pr-7">
            <h2 className="text-3xl font-bold tracking-tight text-[#0E2420] leading-[1.14] sm:text-4xl">
              Four mathematical
              <br />
              intelligence{" "}
              <span className="relative inline-block jeevika-serif-italic pr-1">
                engines.
                <GoldUnderline className="absolute -bottom-1 left-0 h-2 w-full" />
              </span>
            </h2>
            <p className="max-w-sm text-sm leading-relaxed text-[#435650] sm:text-[15px]">
              Deterministic, explainable engines that turn clinical data into
              timely, trusted action.
            </p>
          </div>

          {/* Right 4 Engine Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 lg:col-span-8">
            {engines.map(({ name, description, Icon }, index) => (
              <article
                key={name}
                data-jvk-reveal={Math.min(index, 3)}
                className="flex flex-col rounded-2xl border border-[#EAE6DC] bg-[#FCFBF6] p-5 shadow-[0_4px_16px_rgba(14,36,32,0.04)]"
              >
                <div className="mb-3.5 flex size-11 items-center justify-center rounded-xl bg-[#E7F2E8] text-[#047C61]">
                  <Icon className="size-6" />
                </div>
                <h3 className="text-[15px] font-bold text-[#0E2420] xl:text-base">
                  {name}
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-[#4B5D57] xl:text-[13px]">
                  {description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </div>

      {/* Subtle horizontal rule divider before Trust & clinical oversight */}
      <div
        aria-hidden="true"
        className="mx-auto mt-12 h-px max-w-6xl bg-gradient-to-r from-transparent via-[#E5DEC9] to-transparent lg:mt-16"
      />
    </div>
  );
}
