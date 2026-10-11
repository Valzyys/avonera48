import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);
gsap.defaults({ ease: "power3.out", duration: 0.8 });

export { gsap, ScrollTrigger, useGSAP };

/**
 * Motion is part of this site's design and always plays — the owner asked
 * for it to run even when the OS/browser "reduce motion" setting is on.
 * Kept as a function so a toggle can be reintroduced in one place.
 */
export const reducedMotion = () => false;

/**
 * Distance for a movement tween. With reduced motion, things still fade in
 * and out, but nothing travels, tilts or sweeps.
 */
export const shift = (v: number) => (reducedMotion() ? 0 : v);

/* Natural (resting) values of the properties entrance tweens animate from. */
const REST: Record<string, unknown> = { autoAlpha: 1, opacity: 1, x: 0, y: 0, xPercent: 0, yPercent: 0, rotate: 0, scale: 1, scaleX: 1, scaleY: 1, clipPath: "inset(0% 0% 0% 0%)" };

/**
 * Entrance tween: like gsap.from, but always ends at the element's resting
 * state. A plain `from` reads the *current* values as its end, so if it is
 * re-created while an element is still hidden, the element stays hidden.
 */
export function enter(targets: gsap.TweenTarget, vars: gsap.TweenVars, tl?: gsap.core.Timeline, position?: gsap.Position) {
  const from: gsap.TweenVars = {};
  const to: gsap.TweenVars = {};
  for (const [k, v] of Object.entries(vars)) {
    if (k in REST) {
      from[k] = v;
      to[k] = REST[k];
    } else to[k] = v;
  }
  return tl ? tl.fromTo(targets, from, to, position) : gsap.fromTo(targets, from, to);
}
