import { useEffect } from "react";

/**
 * Adds .is-visible to `.reveal` elements inside `root` as they enter the
 * viewport — including elements rendered later (after data loads).
 * Each element is revealed once.
 */
export function useReveal(rootSelector = "#main", deps: readonly unknown[] = []) {
  useEffect(() => {
    const root = document.querySelector(rootSelector);
    if (!root) return;
    if (!("IntersectionObserver" in window)) {
      root.querySelectorAll(".reveal").forEach((el) => el.classList.add("is-visible"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-visible");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 },
    );
    const scan = () => root.querySelectorAll<HTMLElement>(".reveal:not(.is-visible)").forEach((el) => io.observe(el));
    scan();
    const mo = new MutationObserver(scan);
    mo.observe(root, { childList: true, subtree: true });
    return () => {
      io.disconnect();
      mo.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
