import { useEffect, useState, type ReactNode } from "react";

export const landingArtwork = "/assets/design/care-continuum.jpg";

export function JeevikaLoading({
  embedded = false,
  label = "Loading JEEVIKA…",
}: { embedded?: boolean; label?: string }) {
  return (
    <div className={`jvk-loading-screen${embedded ? " jvk-loading-embedded" : ""}`} role="status">
      <img className="jvk-loading-logo" src="/assets/logo-jeevika.png" alt="" width={168} />
      <p>{label}</p>
      <span className="jvk-loading-track" aria-hidden="true"><span /></span>
    </div>
  );
}

/** Hold the splash briefly on a direct landing visit while the hero becomes paintable. */
export function LandingBoot({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const image = new Image();
    image.src = landingArtwork;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let settled = false;
    let minElapsed = false;
    const finish = () => {
      if (!settled || !minElapsed) return;
      window.clearTimeout(deadline);
      setReady(true);
    };
    const minimum = window.setTimeout(() => {
      minElapsed = true;
      finish();
    }, reducedMotion ? 0 : 360);
    const deadline = window.setTimeout(() => {
      minElapsed = false;
      setReady(true);
    }, 1150);
    function onImageReady() {
      settled = true;
      finish();
    }
    // A missing image must never prevent access to the landing page.
    if (typeof image.decode === "function") {
      void image.decode().then(onImageReady, onImageReady);
    } else {
      onImageReady();
    }

    return () => {
      window.clearTimeout(minimum);
      window.clearTimeout(deadline);
      minElapsed = false;
    };
  }, []);

  return ready ? children : <JeevikaLoading />;
}
