import type { ReactNode } from "react";
import {
  Bandage,
  BarChart3,
  Brain,
  CheckCircle2,
  HeartPulse,
  Home,
  Info,
  MoreHorizontal,
  Pill,
  Stethoscope,
  Thermometer,
  Users,
} from "lucide-react";
import { GoldUnderline } from "@/components/landing-public/shared";
import type { complaints } from "../../../../../packages/shared/patient-experience";

type ComplaintKey = (typeof complaints)[number];
type ConsentKey = "care" | "pharmacy" | "remote" | "research" | "guardian";

/** Curved emerald-and-gold bottom wave + corner botanical sprig shown inside intake stages 0-6. */
export function KioskCardBottomDecor() {
  return (
    <div
      aria-hidden="true"
      className="jvk-kiosk-decor pointer-events-none select-none print:hidden"
    >
      <img
        src="/assets/kiosk/kiosk-botanical-corner.png"
        alt=""
        width={300}
        height={116}
        className="jvk-kiosk-artwork hidden sm:block absolute bottom-2 right-0 h-16 w-auto opacity-90"
      />
      <svg
        viewBox="0 0 1200 34"
        fill="none"
        preserveAspectRatio="none"
        className="block h-5 w-full sm:h-6"
      >
        <defs>
          <linearGradient id="jvk-kiosk-gold-wave" x1="0" y1="0" x2="1200" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#E4A736" stopOpacity="0.65" />
            <stop offset="52%" stopColor="#EAC163" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#DDA235" stopOpacity="0.72" />
          </linearGradient>
          <linearGradient id="jvk-kiosk-teal-wave" x1="0" y1="0" x2="1200" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#088067" />
            <stop offset="48%" stopColor="#066F59" />
            <stop offset="100%" stopColor="#1B9477" />
          </linearGradient>
        </defs>
        <path
          d="M0 10C180 2 390 22 670 15C900 9 1070 4 1200 12V34H0V10Z"
          fill="url(#jvk-kiosk-gold-wave)"
        />
        <path
          d="M0 17C210 7 430 27 710 19C940 12 1090 10 1200 18V34H0V17Z"
          fill="url(#jvk-kiosk-teal-wave)"
        />
      </svg>
    </div>
  );
}

/** Crisp multilingual Aअ badge matching the approved language selector tiles. */
export function KioskLanguageGlyph({ selected }: { selected: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tracking-tight transition-colors ${
        selected
          ? "bg-white/15 text-white ring-1 ring-white/25"
          : "bg-[#E5F2EA] text-[#05735C]"
      }`}
    >
      Aअ
    </span>
  );
}

/** Medical outline icon paired with each of the five consent rows. */
export function KioskConsentIcon({ option }: { option: ConsentKey }) {
  const cls = "size-[18px] shrink-0 text-[#05735C]";
  switch (option) {
    case "care":
      return <Stethoscope aria-hidden="true" className={cls} />;
    case "pharmacy":
      return <Pill aria-hidden="true" className={cls} />;
    case "remote":
      return <Home aria-hidden="true" className={cls} />;
    case "research":
      return <BarChart3 aria-hidden="true" className={cls} />;
    case "guardian":
      return <Users aria-hidden="true" className={cls} />;
  }
}

function StomachOutlineIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M9.5 4.5v2.2c0 1.4-.9 2.6-2.1 3.3C5.3 11.2 4.5 13 4.8 15.2c.4 2.7 2.8 4.5 5.6 4.5 3.1 0 5.3-1.4 6.6-3.7 1.3-2.3 2.2-3.4 2.2-5.7 0-2.1-1.5-3.8-3.6-3.8-1.5 0-2.6.9-2.8 2.3" />
      <path d="M12.5 5c0-.9-.6-1.5-1.5-1.5S9.5 4.1 9.5 5" />
    </svg>
  );
}

function LungsOutlineIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 3.5v8.2" />
      <path d="M12 9.5c-1.8 0-3 1.4-3.7 2.9-.7 1.5-2.1 4.1-2.1 6.1 0 1.3.9 2 2.2 2 1.6 0 2.6-.8 2.6-2.5v-5.7" />
      <path d="M12 9.5c1.8 0 3 1.4 3.7 2.9.7 1.5 2.1 4.1 2.1 6.1 0 1.3-.9 2-2.2 2-1.6 0-2.6-.8-2.6-2.5v-5.7" />
    </svg>
  );
}

/** Clear clinical outline icon paired with each of the 7 symptom categories. */
export function KioskComplaintIcon({
  complaint,
  selected,
}: {
  complaint: ComplaintKey;
  selected: boolean;
}) {
  const cls = `size-[20px] shrink-0 transition-colors ${
    selected ? "text-[#035C49]" : "text-[#067760]"
  }`;
  switch (complaint) {
    case "fever":
      return <Thermometer aria-hidden="true" className={cls} />;
    case "stomach":
      return <StomachOutlineIcon className={cls} />;
    case "chest":
      return <HeartPulse aria-hidden="true" className={cls} />;
    case "cough":
      return <LungsOutlineIcon className={cls} />;
    case "headache":
      return <Brain aria-hidden="true" className={cls} />;
    case "injury":
      return <Bandage aria-hidden="true" className={cls} />;
    case "other":
      return <MoreHorizontal aria-hidden="true" className={cls} />;
  }
}

/** Shared stage header pairing gold-underlined title + optional left slot with watercolor illustration on top-right. */
export function KioskStageHeader({
  headingRef,
  title,
  language,
  subtitle,
  entrance,
  subtitleEntrance,
  illustration,
  illustrationClassName = "",
  belowTitle,
}: {
  headingRef: React.RefObject<HTMLHeadingElement>;
  title: string;
  language: string;
  subtitle?: ReactNode;
  entrance?: "left" | "right";
  subtitleEntrance?: "left" | "right";
  illustration?: {
    src: string;
    width: number;
    height: number;
  };
  illustrationClassName?: string;
  belowTitle?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1 space-y-2.5">
        <div className="inline-block max-w-full">
          <h1
            ref={headingRef}
            data-jvk-entrance={entrance}
            tabIndex={-1}
            lang={language}
            className="jvk-kiosk-heading text-[25px] sm:text-[30px] focus:outline-none"
          >
            <span key={`${language}-${title}`}>{title}</span>
          </h1>
          <GoldUnderline className="mt-1 block h-2 w-32 sm:w-44" />
        </div>
        {subtitle && (
          <p
            data-jvk-entrance={subtitleEntrance}
            className="jvk-kiosk-subcopy jvk-kiosk-body-text text-[#415750]"
          >
            {subtitle}
          </p>
        )}
        {belowTitle}
      </div>
      {illustration && (
        <div className="hidden sm:flex shrink-0 items-start justify-end">
          <img
            src={illustration.src}
            alt=""
            aria-hidden="true"
            width={illustration.width}
            height={illustration.height}
            className={`jvk-kiosk-artwork h-auto w-auto object-contain ${illustrationClassName}`}
          />
        </div>
      )}
    </div>
  );
}

/** Blue informational banner preserving trial & simulation notices faithfully. */
export function KioskInfoAlert({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-xl border border-[#C6DDF5] bg-[#EAF3FD] px-4 py-3 text-[#184878]"
    >
      <Info aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-[#2367AA]" />
      <div className="min-w-0">
        <p className="text-sm font-bold leading-snug text-[#164270]">{title}</p>
        {children && (
          <div className="jvk-kiosk-meta-text mt-0.5 text-[#225689]">{children}</div>
        )}
      </div>
    </div>
  );
}

/** Green pill badge shown only when synthetic identity verification genuinely succeeded. */
export function KioskVerifiedPill({ label }: { label: string }) {
  return (
    <span className="inline-flex min-h-7 items-center gap-1.5 rounded-full border border-[#BFE0CD] bg-[#E7F4EC] px-3 py-1 text-xs font-semibold text-[#0C5E49]">
      <CheckCircle2 aria-hidden="true" className="size-3.5 shrink-0 text-[#057C61]" />
      <span>{label}</span>
    </span>
  );
}
