import { useLayoutEffect, useRef } from "react";

const stationary = "nav, aside, [role=alert], [role=alertdialog], [role=dialog], [role=status], [aria-live], [data-jvk-stationary]";

/** Animate page introductions without moving forms, navigation, or live clinical content. */
export function useRouteEntrance<T extends HTMLElement = HTMLElement>(route: string) {
  const ref = useRef<T>(null);

  useLayoutEffect(() => {
    const scope = ref.current;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (preference.matches || !scope?.animate) return;

    const tokens = getComputedStyle(scope);
    const duration = Number.parseFloat(tokens.getPropertyValue("--jvk-motion-route"));
    const easing = tokens.getPropertyValue("--jvk-motion-out").trim();
    if (!duration || !easing) return;

    const animations: Animation[] = [];
    const isEligible = (element: HTMLElement) =>
      !element.closest(stationary) && element.getClientRects().length > 0;

    function enter() {
      if (!scope || preference.matches) return false;
      const explicit = Array.from(scope.querySelectorAll<HTMLElement>("[data-jvk-entrance]"))
        .filter(isEligible);
      const left = explicit.filter((element) => element.dataset.jvkEntrance === "left");
      const right = explicit.filter((element) => element.dataset.jvkEntrance === "right");
      if (!explicit.length) {
        const headings = Array.from(scope.querySelectorAll<HTMLElement>("h1, h2")).filter(isEligible);
        const title = headings.find((element) => element.tagName === "H1") ?? headings[0];
        const description = title?.nextElementSibling;
        if (title) left.push(title);
        if (description instanceof HTMLElement && description.matches("p") && isEligible(description)) {
          right.push(description);
        }
      }

      const viewport = document.documentElement.clientWidth;
      const distance = Math.min(44, Math.max(14, viewport * 0.038));
      for (const [elements, fromRight] of [[left, false], [right, true]] as const) {
        for (const element of elements) {
          const bounds = element.getBoundingClientRect();
          const room = fromRight ? viewport - bounds.right : bounds.left;
          // Decoratives marked inside an existing clipped hero can use its full travel.
          const travel = element.hasAttribute("data-jvk-entrance-bleed")
            ? distance
            : Math.min(distance, Math.max(0, room - 1));
          const opacity = Number(getComputedStyle(element).opacity);
          const animation = element.animate(
            [
              { translate: `${fromRight ? travel : -travel}px 0`, opacity: opacity * 0.64 },
              { translate: "none", opacity },
            ],
            { duration, easing, delay: fromRight ? 65 : 0, fill: "backwards" },
          );
          animation.id = fromRight ? "jvk-route-right" : "jvk-route-left";
          animations.push(animation);
        }
      }
      return animations.length > 0;
    }

    // A lazy or data-backed route may initially commit a loading indicator.
    let observer: MutationObserver | undefined;
    let timeout: number | undefined;
    const stopWaiting = () => {
      observer?.disconnect();
      window.clearTimeout(timeout);
    };
    if (!enter() && typeof MutationObserver !== "undefined") {
      observer = new MutationObserver(() => {
        if (enter()) stopWaiting();
      });
      observer.observe(scope, { childList: true, subtree: true });
      timeout = window.setTimeout(stopWaiting, 1500);
    }

    const cancel = () => {
      stopWaiting();
      animations.forEach((animation) => animation.cancel());
    };
    preference.addEventListener?.("change", cancel);
    return () => {
      preference.removeEventListener?.("change", cancel);
      cancel();
    };
  }, [route]);

  return ref;
}
