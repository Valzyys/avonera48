import type { DependencyList, RefObject } from "react";
import { gsap, ScrollTrigger, shift, useGSAP } from "./gsap";

/**
 * Stagger the direct children of `ref` in when they scroll into view.
 * Re-runs when `deps` change (e.g. a filter swapped the list), so lists
 * re-choreograph instead of popping. Cleans up via useGSAP's context.
 */
export function useStagger(ref: RefObject<HTMLElement | null>, deps: DependencyList = [], opts: { y?: number; each?: number; start?: string } = {}) {
  useGSAP(
    () => {
      const el = ref.current;
      if (!el || el.children.length === 0) return;
      gsap.from(el.children, {
        autoAlpha: 0,
        y: shift(opts.y ?? 18),
        duration: 0.7,
        stagger: { each: opts.each ?? 0.05, amount: Math.min(0.6, (opts.each ?? 0.05) * el.children.length) },
        scrollTrigger: { trigger: el, start: opts.start ?? "top 90%", once: true },
        clearProps: "transform,opacity,visibility",
      });
    },
    { scope: ref, dependencies: [...deps] },
  );
}

/**
 * Section entrance: the uppercase heading rises out of its mask, then any
 * element marked [data-reveal] inside follows. One ScrollTrigger per section.
 */
export function useSectionReveal(ref: RefObject<HTMLElement | null>, deps: DependencyList = []) {
  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const tl = gsap.timeline({ scrollTrigger: { trigger: el, start: "top 82%", once: true } });
      const heading = el.querySelector(".h-section__inner");
      if (heading) tl.from(heading, shift(1) ? { yPercent: 110, duration: 0.8, ease: "power4.out" } : { autoAlpha: 0, duration: 0.5 });
      const rest = el.querySelectorAll("[data-reveal]");
      if (rest.length) tl.from(rest, { autoAlpha: 0, y: shift(20), duration: 0.7, stagger: 0.08, clearProps: "transform,opacity,visibility" }, heading ? "-=0.5" : 0);
    },
    { scope: ref, dependencies: [...deps] },
  );
}

const LIST_ITEMS = [".member-grid", ".show-list", ".stream-grid", ".live-grid", ".news-list", ".lineup-grid", ".tag-list", ".archive"]
  .map((s) => `${s} > *`)
  .join(",");

/**
 * Inner pages: list items (members, shows, streams, news…) arrive async, so
 * watch the page and hand every new item to a ScrollTrigger batch that
 * staggers it in as it scrolls into view. The homepage choreographs itself.
 */
export function usePageMotion(root: RefObject<HTMLElement | null>, key: string) {
  useGSAP(
    () => {
      const el = root.current;
      if (!el) return;
      const seen = new WeakSet<Element>();
      const triggers: ScrollTrigger[] = [];
      const scan = () => {
        const fresh = [...el.querySelectorAll(LIST_ITEMS)].filter((n) => !seen.has(n) && !n.closest(".home"));
        if (!fresh.length) return;
        fresh.forEach((n) => seen.add(n));
        gsap.set(fresh, { autoAlpha: 0, y: shift(18) });
        triggers.push(
          ...ScrollTrigger.batch(fresh, {
            start: "top 95%",
            once: true,
            onEnter: (batch) => gsap.to(batch, { autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.05, overwrite: true, clearProps: "transform,opacity,visibility" }),
          }),
        );
      };
      scan();
      const mo = new MutationObserver(scan);
      mo.observe(el, { childList: true, subtree: true });
      return () => {
        mo.disconnect();
        triggers.forEach((t) => t.kill());
      };
    },
    { scope: root, dependencies: [key] },
  );
}

/** Detail-page entrance: every [data-in] element inside `ref` rises in order. */
export function useEntrance(ref: RefObject<HTMLElement | null>, deps: DependencyList = []) {
  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const items = el.querySelectorAll("[data-in]");
      if (items.length) gsap.from(items, { autoAlpha: 0, y: shift(16), duration: 0.6, stagger: 0.07, delay: 0.1, clearProps: "transform,opacity,visibility" });
    },
    { scope: ref, dependencies: [...deps] },
  );
}
