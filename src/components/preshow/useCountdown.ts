import { useEffect, useRef, useState } from "react";
import { countdownPhase, type CountdownPhase } from "./countdown";

/**
 * Time left until `startAt`, by the server's clock (device clock + offset).
 * Read every animation frame from absolute time, but re-rendered only when
 * the displayed second changes, so it never drifts and catches up at once
 * when a hidden tab comes back.
 */
export function useCountdown(startAt: Date | undefined, offsetMs: number, finalSeconds: number) {
  const target = startAt?.getTime();
  const compute = () => (target == null ? null : target - (Date.now() + offsetMs));
  const [remaining, setRemaining] = useState<number | null>(compute);
  const shown = useRef<number | null>(null);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const r = target == null ? null : target - (Date.now() + offsetMs);
      const sec = r == null ? null : Math.ceil(r / 1000);
      if (sec !== shown.current) {
        shown.current = sec;
        setRemaining(r);
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    // rAF pauses in a hidden tab; recompute the moment it comes back.
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      cancelAnimationFrame(raf);
      tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [target, offsetMs]);

  const phase: CountdownPhase = countdownPhase(remaining, finalSeconds);
  return { remaining, phase, seconds: remaining == null ? null : Math.max(0, Math.ceil(remaining / 1000)) };
}
