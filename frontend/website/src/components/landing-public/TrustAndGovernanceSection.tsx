import {
  AccessUsersIcon,
  ConsentLockIcon,
  GoldUnderline,
  MottoShieldIcon,
} from "./shared";

export function TrustAndGovernanceSection() {
  return (
    <div id="trust" className="relative overflow-x-clip scroll-mt-20 pt-4 pb-12 lg:pb-14">
      {/* Left watercolor botanical sprig */}
      <img
        src="/assets/landing/botanical-trust-left.png"
        alt=""
        aria-hidden="true"
        loading="lazy"
        width={104}
        height={146}
        className="pointer-events-none select-none absolute top-4 left-0 hidden h-40 w-auto opacity-95 lg:block"
      />

      {/* Right watercolor rural hillside & village homes illustration */}
      <img
        src="/assets/landing/rural-landscape.png"
        alt=""
        aria-hidden="true"
        loading="lazy"
        width={217}
        height={176}
        className="pointer-events-none select-none absolute top-0 right-0 hidden h-52 w-auto opacity-95 lg:block xl:h-56"
      />

      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 lg:px-14">
        <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12">
          {/* Left Heading & Description */}
          <div className="space-y-3 lg:col-span-5 lg:border-r lg:border-[#E7DFC9] lg:pr-8">
            <h2 className="text-3xl font-bold tracking-tight text-[#0E2420] leading-[1.15] sm:text-4xl">
              Trust, privacy &amp;
              <br />
              clinical{" "}
              <span className="relative inline-block jeevika-serif-italic pr-1">
                oversight.
                <GoldUnderline className="absolute -bottom-1 left-0 h-2 w-full" />
              </span>
            </h2>
            <p className="max-w-xs text-sm leading-relaxed text-[#435650] sm:text-[15px]">
              Care that is intelligent, secure, and always under human guidance.
            </p>
          </div>

          {/* Center-Right Principles */}
          <div className="space-y-6 lg:col-span-5 lg:pl-2">
            <div className="flex items-start gap-3.5">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#E7F2E8] text-[#047C61]">
                <ConsentLockIcon className="size-5" />
              </div>
              <div>
                <h3 className="text-[15px] font-bold text-[#0E2420]">
                  Consent by design
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-[#4B5D57] sm:text-[13px]">
                  Patients stay in control of their data, with clear and
                  transparent consent.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#E7F2E8] text-[#047C61]">
                <AccessUsersIcon className="size-5" />
              </div>
              <div>
                <h3 className="text-[15px] font-bold text-[#0E2420]">
                  Role-based access
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-[#4B5D57] sm:text-[13px]">
                  The right information, for the right people, at the right time.
                </p>
              </div>
            </div>
          </div>

          {/* Mobile/Tablet Rural Landscape preview */}
          <div className="lg:hidden">
            <img
              src="/assets/landing/rural-landscape.png"
              alt="Sunlit rural hills and village homes representing community continuity of care"
              loading="lazy"
              width={217}
              height={176}
              className="mx-auto h-36 w-auto object-contain"
            />
          </div>
        </div>

        {/* Centered Approved Motto Banner */}
        <div className="mt-10 flex justify-center">
          <div className="inline-flex items-center gap-2.5 rounded-full border border-[#EAE0C8] bg-[#F7EEDB] px-5 py-2.5 text-center text-xs font-bold italic text-[#132924] shadow-[0_2px_10px_rgba(160,120,40,0.06)] sm:px-7 sm:text-sm">
            <MottoShieldIcon className="size-4 shrink-0 text-[#047C61]" />
            <span>Algorithms Decide. AI Translates. Humans Authorize.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
