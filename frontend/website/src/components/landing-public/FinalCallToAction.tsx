import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { SignInDoorIcon, useLandingDestinations } from "./shared";

export function FinalCallToAction() {
  const destinations = useLandingDestinations();

  return (
    <div className="jeevika-cta-surface relative overflow-hidden bg-[#026E5E] text-white">
      {/* Top Curved Wave Transition from Ivory Canvas */}
      <div aria-hidden="true" className="w-full overflow-hidden leading-none">
        <svg
          viewBox="0 0 1440 44"
          fill="none"
          preserveAspectRatio="none"
          className="block h-8 w-full sm:h-10"
        >
          <path
            d="M0 0H1440V22C1220 4 980 34 710 20C430 6 200 0 0 14V0Z"
            fill="#FEFBF6"
          />
        </svg>
      </div>

      {/* Bottom Soft Layered Green Hill Silhouettes */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 overflow-hidden leading-none">
        <svg
          viewBox="0 0 1440 90"
          fill="none"
          preserveAspectRatio="none"
          className="block h-16 w-full sm:h-20"
        >
          <path
            d="M0 64C140 24 270 30 410 68C580 88 860 88 1030 68C1180 32 1320 26 1440 62V90H0V64Z"
            fill="#1D8871"
            fillOpacity="0.45"
          />
          <path
            d="M0 72C190 48 360 52 540 82C760 90 980 86 1190 66C1300 54 1380 56 1440 72V90H0V72Z"
            fill="#2B937C"
            fillOpacity="0.35"
          />
        </svg>
      </div>

      {/* Extracted Corner Botanical Leaves */}
      <img
        src="/assets/landing/botanical-cta-left.png"
        alt=""
        aria-hidden="true"
        loading="lazy"
        width={80}
        height={88}
        style={{
          WebkitMaskImage: "radial-gradient(ellipse at 20% 85%, #000 50%, transparent 92%)",
          maskImage: "radial-gradient(ellipse at 20% 85%, #000 50%, transparent 92%)",
        }}
        className="pointer-events-none select-none absolute bottom-0 left-0 h-20 w-auto sm:h-24"
      />
      <img
        src="/assets/landing/botanical-cta-right.png"
        alt=""
        aria-hidden="true"
        loading="lazy"
        width={73}
        height={90}
        style={{
          WebkitMaskImage: "radial-gradient(ellipse at 80% 85%, #000 50%, transparent 92%)",
          maskImage: "radial-gradient(ellipse at 80% 85%, #000 50%, transparent 92%)",
        }}
        className="pointer-events-none select-none absolute bottom-0 right-0 h-20 w-auto sm:h-24"
      />

      {/* CTA Copy & Authentication Actions */}
      <div className="relative z-10 mx-auto max-w-3xl px-6 pt-6 pb-12 text-center sm:pt-8 sm:pb-14">
        <h2 data-jvk-reveal="" className="text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-[2.15rem]">
          Ready for a more connected kind of care?
        </h2>
        <p className="mt-2.5 text-sm text-[#DCEEE9] sm:text-base">
          Sign in as a patient, or enter a workspace for your care team.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            to={destinations.patientSignIn.to}
            state={destinations.patientSignIn.state}
            className="jvk-motion-action inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#FAF8F4] px-5 py-2.5 text-sm font-semibold text-[#0E2420] shadow-md hover:bg-white"
          >
            <SignInDoorIcon className="size-4 text-[#0E2420]" />
            <span>Patient sign-in</span>
          </Link>

          <Link
            to={destinations.enterWorkspace.to}
            state={destinations.enterWorkspace.state}
            className="jvk-motion-action inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/65 bg-[#047765]/60 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/15"
          >
            <span>Enter workspace</span>
            <ArrowRight aria-hidden="true" className="jvk-motion-arrow size-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
