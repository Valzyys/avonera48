import { preshowConfig } from "../preshow.config";
import { PsIcon } from "../ui/Icons";
import { at, SceneFrame, type SceneProps } from "./common";

/** Where to follow along (skipped while the list is empty). */
export function Connect({ dur }: SceneProps) {
  return (
    <SceneFrame id="connect" dur={dur}>
      <div className="ps-center">
        <span className="ps-label ps-a ps-a--rise" style={at(0.4)}>
          IKUTI KAMI
        </span>
        <ul className="ps-socials">
          {preshowConfig.socials.map((s, i) => (
            <li key={s.handle} className="ps-a ps-a--rise" style={at(1 + i * 0.4)}>
              <PsIcon name={s.platform} size="1.4em" />
              {s.handle}
            </li>
          ))}
        </ul>
      </div>
    </SceneFrame>
  );
}
