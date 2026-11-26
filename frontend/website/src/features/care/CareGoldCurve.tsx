export function CareGoldCurve({ className = "mt-0.5 h-2 w-full" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 180 14"
      fill="none"
      preserveAspectRatio="none"
      className={`pointer-events-none block text-[#E2A832] ${className}`}
    >
      <path
        d="M3 10.5C48 3.2 126 2.5 177 8.5"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CarePageWaveFooter() {
  return (
    <div className="pointer-events-none select-none relative -mx-4 sm:-mx-6 lg:-mx-10 -mb-20 pt-4 overflow-hidden">
      <img
        src="/assets/opd/opd-bottom-wave.png"
        alt=""
        aria-hidden="true"
        className="w-full h-14 sm:h-[72px] object-cover object-bottom opacity-95 block"
      />
      <img
        src="/assets/ipd/ipd-corner-leaves.png"
        alt=""
        aria-hidden="true"
        className="hidden sm:block absolute bottom-1 right-0 h-16 w-auto opacity-95"
      />
    </div>
  );
}
