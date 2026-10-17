import { Curtain } from "../ui/Curtain";
import { at, SceneFrame, type SceneProps } from "./common";

const PHRASES = ["LAMPU MENYALA", "PANGGUNG SIAP", "SEBENTAR LAGI"];

/** Stage interlude: the drapes breathe, the lamps come on left to right, a few words land. Stretches to fill skipped scenes. */
export function Interlude({ dur }: SceneProps) {
  const beats = Math.max(1, Math.floor((dur - 6) / 3));
  return (
    <SceneFrame id="interlude" dur={dur}>
      <Curtain />
      <div className="ps-lamps" aria-hidden>
        {Array.from({ length: 7 }, (_, i) => (
          <span key={i} className="ps-lamp" style={at(1.5 + i * 0.55)} />
        ))}
      </div>
      <div className="ps-center">
        {Array.from({ length: beats }, (_, k) => (
          <span key={k} className="ps-kinetic" style={at(6 + k * 3, { ["--life" as string]: `${k === beats - 1 ? Math.max(3, dur - 6 - k * 3 - 0.8) : 3}s` })}>
            {PHRASES[k % PHRASES.length]}
          </span>
        ))}
      </div>
    </SceneFrame>
  );
}
