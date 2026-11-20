import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { landingMarkup } from "../../../../packages/design/landing";
import "../../../../packages/design/landing.css";

const markup = landingMarkup({
  patient: "#/kiosk",
  clinician: "#/app?view=doctor-consultation",
  emergency: "#/app?view=emergency-triage",
  headquarters: "#/app?view=admin",
  operations: "#/app?view=clinic-admin",
  home: "#/",
});
export default function LandingPage() {
  const navigate = useNavigate();
  const node = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = node.current;
    function follow(event: MouseEvent) {
      const anchor = (event.target as Element).closest<HTMLAnchorElement>("a");
      if (
        !anchor ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const href = anchor.getAttribute("href") ?? "";
      if (href.startsWith("#/")) {
        event.preventDefault();
        navigate(href.slice(1));
      } else if (href.startsWith("#ds-")) {
        event.preventDefault();
        document.getElementById(href.slice(1))?.scrollIntoView({
          behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "instant"
            : "smooth",
        });
      }
    }
    element?.addEventListener("click", follow);
    return () => element?.removeEventListener("click", follow);
  }, [navigate]);
  // Scoped layout overrides to guarantee translucent hero caption card and identical button dimensions across all devices
  return (
    <>
      <style>{`
        .ds-actions {
          display: flex !important;
          flex-direction: row !important;
          align-items: stretch !important;
          gap: 12px !important;
          width: 100% !important;
          max-width: 440px !important;
        }
        .ds-actions .ds-button {
          flex: 1 1 0px !important;
          width: 50% !important;
          min-width: 0 !important;
          min-height: 48px !important;
          height: 48px !important;
          padding: 12px 16px !important;
          justify-content: center !important;
          text-align: center !important;
          box-sizing: border-box !important;
        }
        .ds-care-nodes {
          display: contents;
        }
        @media (max-width: 1050px) {
          .ds-hero-art {
            min-height: auto !important;
            display: flex !important;
            flex-direction: column !important;
            gap: 12px !important;
            justify-content: flex-start !important;
            align-items: flex-start !important;
          }
          .ds-care-nodes {
            display: flex !important;
            flex-wrap: wrap !important;
            gap: 12px !important;
            width: 100% !important;
          }
          .ds-art-caption-card {
            position: relative !important;
            top: auto !important;
            left: auto !important;
            right: auto !important;
            bottom: auto !important;
            width: fit-content !important;
            max-width: min(320px, 90%) !important;
            margin-top: 6px !important;
            padding: 12px 18px !important;
            background: rgba(255, 255, 255, 0.16) !important;
            backdrop-filter: blur(10px) saturate(140%) !important;
            -webkit-backdrop-filter: blur(10px) saturate(140%) !important;
            border: 1px solid rgba(255, 255, 255, 0.45) !important;
            border-radius: 16px !important;
            box-shadow: 0 8px 24px rgba(8, 127, 114, 0.04) !important;
          }
          .dark .ds-art-caption-card {
            background: rgba(20, 40, 32, 0.28) !important;
            border: 1px solid rgba(64, 96, 82, 0.45) !important;
          }
        }
        @media (max-width: 768px) {
          .ds-workspace-grid {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 12px !important;
            margin-top: 24px !important;
          }
          .ds-workspace-card.featured {
            grid-column: 1 / -1 !important;
            grid-row: auto !important;
            text-align: center !important;
            align-items: center !important;
          }
          .ds-workspace-card {
            padding: 18px 12px !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            text-align: center !important;
            box-sizing: border-box !important;
          }
          .ds-workspace-icon {
            margin: 0 auto 12px !important;
          }
          .ds-site .ds-workspace-card h3 {
            font-size: 15px !important;
            text-align: center !important;
            width: 100% !important;
          }
          .ds-site .ds-workspace-card p {
            font-size: 12px !important;
            text-align: center !important;
            margin: 0 auto 14px !important;
            max-width: 100% !important;
          }
          .ds-workspace-action {
            font-size: 11px !important;
            gap: 6px !important;
            flex-wrap: wrap !important;
            justify-content: center !important;
            text-align: center !important;
            margin-top: auto !important;
            width: 100% !important;
          }
          .ds-language-preview {
            margin-top: 16px !important;
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 8px !important;
            width: 100% !important;
          }
          .ds-language-preview span {
            font-size: 13px !important;
            padding: 10px 6px !important;
            text-align: center !important;
          }
        }
      `}</style>
      <div ref={node} dangerouslySetInnerHTML={{ __html: markup }} />
    </>
  );
}
