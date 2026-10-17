import { useEffect, useRef } from "react";
import { formatRemaining } from "../format";
import { at, SceneFrame, type SceneProps } from "./common";

/** A thin bar visualiser off the master analyser; a gentle idle wave while silent. */
function Visualiser({ analyser, still }: { analyser: AnalyserNode | null; still: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const bins = new Uint8Array(analyser?.frequencyBinCount ?? 64);
    let raf = 0;
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      const w = (c.width = c.clientWidth * Math.min(2, devicePixelRatio));
      const h = (c.height = c.clientHeight * Math.min(2, devicePixelRatio));
      if (analyser) analyser.getByteFrequencyData(bins);
      const bars = 48;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "rgba(246,196,83,0.75)";
      for (let i = 0; i < bars; i++) {
        const v = analyser ? bins[Math.floor((i / bars) * bins.length * 0.7)] / 255 : still ? 0.15 : 0.12 + 0.1 * Math.sin(now / 600 + i * 0.5);
        const bh = Math.max(1.5, v * h);
        ctx.fillRect((i * w) / bars + 1, (h - bh) / 2, w / bars - 2, bh);
      }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [analyser, still]);
  return <canvas ref={ref} className="ps-vis" aria-hidden />;
}

/** Stay tuned: the promise breathing, the countdown under it; it ends dark, like the loop begins. */
export function StayTuned({ dur, remaining, analyser, reducedMotion }: SceneProps) {
  return (
    <SceneFrame id="staytuned" dur={dur}>
      <div className="ps-center">
        <h2 className="ps-tuned ps-a ps-a--mask" style={at(0.6)}>
          SHOW AKAN SEGERA DIMULAI
        </h2>
        {remaining != null && remaining > 0 && (
          <span className="ps-tuned__count ps-a ps-a--rise" style={at(1.6)} role="timer">
            {formatRemaining(remaining)}
          </span>
        )}
        <span className="ps-a ps-a--rise" style={at(2.4)}>
          <Visualiser analyser={analyser} still={reducedMotion} />
        </span>
      </div>
    </SceneFrame>
  );
}
