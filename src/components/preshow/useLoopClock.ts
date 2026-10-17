import { useEffect, useRef } from "react";
import type { AudioEngine } from "./audio/AudioEngine";

/**
 * The one clock the pre-show runs on, in loop seconds (unwrapped). With sound
 * on it is the AudioContext's clock (anchored where the picture was), so
 * effects land on the frame they belong to; without sound it is
 * performance.now(). It can pause (hidden tab, scrolled away) and resume
 * where it stopped.
 */
export class LoopClock {
  private base = 0;
  private since = performance.now();
  private paused = false;
  private onAudio = false;

  constructor(
    private engine: AudioEngine,
    start = 0,
  ) {
    this.base = start;
  }

  now(): number {
    if (this.onAudio && this.engine.ctx) return this.engine.loopPos();
    return this.paused ? this.base : this.base + (performance.now() - this.since) / 1000;
  }

  /** From now on, follow the audio clock (call once sound is on). */
  handToAudio(loopLength: number) {
    if (this.onAudio) return;
    this.engine.anchor(this.now(), loopLength);
    this.onAudio = true;
  }

  /** Back to the frame clock (sound closed). */
  handBack() {
    if (!this.onAudio) return;
    this.base = this.engine.ctx ? this.engine.loopPos() : this.base;
    this.since = performance.now();
    this.onAudio = false;
  }

  pause() {
    if (this.paused) return;
    this.base = this.now();
    this.paused = true;
  }

  resume() {
    if (!this.paused) return;
    this.since = performance.now();
    this.paused = false;
  }
}

/** Calls `onFrame(loopSeconds)` every animation frame while `active`. */
export function useLoopClock(clock: LoopClock, active: boolean, onFrame: (t: number) => void) {
  const fn = useRef(onFrame);
  useEffect(() => {
    fn.current = onFrame;
  });
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const tick = () => {
      fn.current(clock.now());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [clock, active]);
}
