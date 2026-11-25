import { Link } from "react-router-dom";
import { useScrollToPublicSection } from "./shared";

export function LandingFooter() {
  const scrollToSection = useScrollToPublicSection();

  return (
    <footer className="jeevika-footer-snap border-t border-[#EAE6DC] bg-[#FEFBF6]">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-6 sm:flex-row sm:px-6 lg:px-8">
        <div className="flex items-center gap-3.5">
          <Link
            to="/"
            aria-label="JEEVIKA home"
            onClick={(event) => {
              event.preventDefault();
              scrollToSection("phase-01");
            }}
            className="inline-flex items-center"
          >
            <img
              src="/assets/logo-jeevika.png"
              alt="JEEVIKA"
              loading="lazy"
              width={102}
              height={34}
              className="h-8 w-auto object-contain"
            />
          </Link>
          <span aria-hidden="true" className="h-6 w-px bg-[#DFDCD0]" />
          <p className="font-serif text-sm italic font-medium text-[#132924]">
            Care Stays Connected.
          </p>
        </div>

        <nav
          aria-label="Footer navigation"
          className="flex flex-wrap items-center justify-center gap-5 text-xs font-semibold text-[#182B27] sm:gap-7 sm:text-[13px]"
        >
          <button
            type="button"
            onClick={() => scrollToSection("workspaces")}
            className="min-h-10 px-1 transition-colors hover:text-[#047C61] cursor-pointer"
          >
            Platform
          </button>
          <button
            type="button"
            onClick={() => scrollToSection("journey")}
            className="min-h-10 px-1 transition-colors hover:text-[#047C61] cursor-pointer"
          >
            Our approach
          </button>
          <button
            type="button"
            onClick={() => scrollToSection("trust")}
            className="min-h-10 px-1 transition-colors hover:text-[#047C61] cursor-pointer"
          >
            Trust &amp; care
          </button>
          <Link
            to="/kiosk"
            className="inline-flex min-h-10 items-center px-1 transition-colors hover:text-[#047C61]"
          >
            Patient Kiosk
          </Link>
        </nav>
      </div>
    </footer>
  );
}
