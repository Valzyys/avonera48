import { preshowConfig } from "../preshow.config";
import { PsIcon } from "../ui/Icons";
import { at, SceneFrame, type SceneProps } from "./common";

/** House rules, one at a time, zig-zagging down, each icon drawing itself. */
export function Etiquette({ dur }: SceneProps) {
  return (
    <SceneFrame id="etiquette" dur={dur}>
      <div className="ps-rules">
        <span className="ps-label ps-a ps-a--rise" style={at(0.5)}>
          SEBELUM SHOW DIMULAI
        </span>
        <ol>
          {preshowConfig.rules.map((r, i) => (
            <li key={r.text} className={`ps-rule ps-a ps-a--rise${i % 2 ? " is-right" : ""}`} style={at(3 + i * 5)}>
              <span className="ps-rule__icon">
                <PsIcon name={r.icon} size="100%" draw />
              </span>
              <span className="ps-rule__text">{r.text}</span>
            </li>
          ))}
        </ol>
      </div>
    </SceneFrame>
  );
}
