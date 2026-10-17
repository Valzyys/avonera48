import { preshowConfig } from "../preshow.config";
import { at, SceneFrame, type SceneProps } from "./common";

/** Supported by: partner logos sliding past (skipped while the list is empty). */
export function Partner({ dur }: SceneProps) {
  const logos = preshowConfig.sponsors;
  return (
    <SceneFrame id="partner" dur={dur}>
      <div className="ps-center">
        <span className="ps-label ps-a ps-a--rise" style={at(0.4)}>
          SUPPORTED BY
        </span>
        <div className="ps-marquee ps-a ps-a--rise" style={at(1)}>
          <div className="ps-marquee__track">
            {[...logos, ...logos].map((s, i) => (
              <img key={i} src={s.logoUrl} alt={i < logos.length ? s.name : ""} aria-hidden={i >= logos.length || undefined} />
            ))}
          </div>
        </div>
      </div>
    </SceneFrame>
  );
}
