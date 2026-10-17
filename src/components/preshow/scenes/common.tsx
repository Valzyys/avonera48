import type { CSSProperties, ReactNode } from "react";
import type { PreShowData } from "../data/types";
import type { Greeting } from "../useGreeting";

export interface SceneProps {
  dur: number;
  data: PreShowData;
  greeting: Greeting;
  /** Time left to the show (ms), or null without a start time. */
  remaining: number | null;
  analyser: AnalyserNode | null;
  reducedMotion: boolean;
}

/** Delay for an element's entrance, in seconds after the scene starts. */
export const at = (s: number, extra?: CSSProperties): CSSProperties => ({ ["--d" as string]: `${s}s`, ...extra });

/** A scene's frame: everything inside animates off the same start; it leaves just before `dur`. */
export function SceneFrame({ id, dur, children, className }: { id: string; dur: number; children: ReactNode; className?: string }) {
  return (
    <section className={`ps-scene ps-scene--${id} ${className ?? ""}`} style={{ ["--out" as string]: `${Math.max(0, dur - 0.8)}s` }} aria-label={id}>
      {children}
    </section>
  );
}

/** Text revealed letter by letter, `per` seconds apart, starting at `start`. */
export function Typed({ text, start, per = 0.045, className }: { text: string; start: number; per?: number; className?: string }) {
  return (
    <span className={className} aria-label={text}>
      {[...text].map((ch, i) => (
        <span key={i} className="ps-a ps-a--type" style={at(start + i * per)} aria-hidden>
          {ch === " " ? " " : ch}
        </span>
      ))}
    </span>
  );
}

/** Words that pop in one after another with a little overshoot. */
export function Words({ text, start, per = 0.12, className, style }: { text: string; start: number; per?: number; className?: string; style?: CSSProperties }) {
  return (
    <span className={className} style={style} aria-label={text}>
      {text.split(/\s+/).map((w, i) => (
        <span key={i} aria-hidden>
          {i > 0 && " "}
          <span className="ps-word">
            <span className="ps-a ps-a--pop" style={at(start + i * per)}>
              {w}
            </span>
          </span>
        </span>
      ))}
    </span>
  );
}

/** Font size that keeps long text inside its box: shrinks with length, never below `min` cqw. */
export const fitSize = (text: string, max: number, min: number, perChar = 22) => Math.max(min, Math.min(max, (max * perChar) / Math.max(perChar, text.length)));
