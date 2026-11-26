import { useEffect, type RefObject } from "react";

const revealClass = "jvk-motion-revealing";

export function useScrollReveal(scopeRef: RefObject<HTMLElement>, root: Element | null = null) {
  useEffect(() => {
    const scope = scopeRef.current;
    if (!scope || typeof IntersectionObserver === "undefined") return;

    const targets = scope.querySelectorAll<HTMLElement>("[data-jvk-reveal]");
    const armed = new Set<Element>();
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const visibleFraction = 0.15;

    // Require an exit beyond the viewport before another entrance can play.
    // Initially visible content is never armed, so the first paint stays intact.
    const exit = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) continue;
        entry.target.classList.remove(revealClass);
        armed.add(entry.target);
      }
    }, { root, rootMargin: "48px 0px" });

    const enter = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.intersectionRatio < visibleFraction || !armed.delete(entry.target)) continue;
        if (!preference.matches && !entry.target.matches(":focus-within")) {
          entry.target.classList.add(revealClass);
        }
      }
    }, { root, rootMargin: "-16px 0px", threshold: visibleFraction });

    function clearReveal(event: Event) {
      if (event.target instanceof Element) {
        event.target.closest(`.${revealClass}`)?.classList.remove(revealClass);
      }
    }
    const clearAll = () => targets.forEach((target) => target.classList.remove(revealClass));

    targets.forEach((target) => {
      exit.observe(target);
      enter.observe(target);
    });
    scope.addEventListener("focusin", clearReveal);
    function onAnimationEnd(event: AnimationEvent) {
      if (event.animationName === "jvk-reveal-in") clearReveal(event);
    }
    scope.addEventListener("animationend", onAnimationEnd);
    preference.addEventListener("change", clearAll);

    return () => {
      exit.disconnect();
      enter.disconnect();
      scope.removeEventListener("focusin", clearReveal);
      scope.removeEventListener("animationend", onAnimationEnd);
      preference.removeEventListener("change", clearAll);
      clearAll();
    };
  }, [scopeRef, root]);
}
