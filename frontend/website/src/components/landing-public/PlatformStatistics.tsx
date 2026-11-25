import {
  EngineChipIcon,
  JourneyPinIcon,
  LanguageChoiceIcon,
  LayersStackIcon,
} from "./shared";

const stats = [
  {
    value: "5",
    strongLabel: "Connected",
    label: "workspaces",
    Icon: LayersStackIcon,
    serif: false,
  },
  {
    value: "4",
    strongLabel: "Deterministic",
    label: "core engines",
    Icon: EngineChipIcon,
    serif: false,
  },
  {
    value: "5",
    strongLabel: "Intake",
    label: "language choices",
    Icon: LanguageChoiceIcon,
    serif: false,
  },
  {
    value: "One",
    strongLabel: "Continuous",
    label: "care journey",
    Icon: JourneyPinIcon,
    serif: true,
  },
] as const;

export function PlatformStatistics() {
  return (
    <div
      aria-label="Platform highlights"
      className="relative z-20 mx-auto w-full max-w-6xl px-4 pb-3 sm:px-6 lg:px-8"
    >
      <dl className="grid grid-cols-2 gap-y-4 rounded-2xl border border-[#EAE6DA] bg-[#FFFDF9]/95 px-4 py-3.5 shadow-[0_8px_28px_rgba(14,36,32,0.06)] backdrop-blur-xs sm:px-6 lg:grid-cols-4 lg:gap-y-0 lg:divide-x lg:divide-[#E6E2D6] lg:py-4">
        {stats.map(({ value, strongLabel, label, Icon, serif }, idx) => (
          <div
            key={`${strongLabel}-${label}`}
            className={`flex items-center gap-3 px-2 sm:px-4 ${
              idx % 2 === 1 ? "border-l border-[#E6E2D6] lg:border-l-0" : ""
            } ${idx >= 2 ? "border-t border-[#E6E2D6] pt-3 lg:border-t-0 lg:pt-0" : ""}`}
          >
            <dt className="sr-only">
              {strongLabel} {label}
            </dt>
            <div className="flex shrink-0 items-center justify-center text-[#2B8A72]">
              <Icon className="size-6 sm:size-7" />
            </div>
            <dd className="flex items-center gap-2.5">
              <span
                className={`text-2xl font-bold tracking-tight text-[#047C61] sm:text-3xl ${
                  serif ? "font-serif font-bold" : ""
                }`}
              >
                {value}
              </span>
              <span className="text-xs leading-tight text-[#4B5D57]">
                <strong className="block font-semibold text-[#182B27]">
                  {strongLabel}
                </strong>
                {label}
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
