import { useEffect, type RefObject } from "react";

/** Play a brief entrance on existing, noncritical route chrome. */
export function useRouteEntrance(ref: RefObject<HTMLElement>, route: string) {
  useEffect(() => {
    const element = ref.current;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (preference.matches || !element?.animate) return;

    const tokens = getComputedStyle(element);
    const duration = Number.parseFloat(tokens.getPropertyValue("--jvk-motion-component"));
    const easing = tokens.getPropertyValue("--jvk-motion-out").trim();
    if (!duration || !easing) return;

    const animation = element.animate(
      [{ translate: "0 4px", opacity: 0.94 }, { translate: "none", opacity: 1 }],
      { duration, easing },
    );
    const cancel = () => animation.cancel();
    preference.addEventListener("change", cancel);
    return () => {
      preference.removeEventListener("change", cancel);
      cancel();
    };
  }, [ref, route]);
}
