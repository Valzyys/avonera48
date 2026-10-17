import { formatClock, formatDay } from "../format";
import { infoBlockAt, infoBlocks } from "../timeline";
import { at, fitSize, SceneFrame, Words, type SceneProps } from "./common";

/** 10–28 s: today's show — setlist, team, day, the time (largest), venue, and a ribbon for something special. */
export function Info({ dur, data }: SceneProps) {
  const blocks = infoBlocks(data);
  const when = (b: (typeof blocks)[number]) => infoBlockAt(blocks.indexOf(b));
  const clock = data.startAt ? formatClock(data.startAt).replace(" WIB", "") : "";
  return (
    <SceneFrame id="info" dur={dur}>
      <div className="ps-info">
        <span className="ps-label ps-a ps-a--rise" style={at(0.5)}>
          TODAY’S SHOW
        </span>
        {data.setlist && <Words className="ps-info__setlist" style={{ fontSize: `${fitSize(data.setlist, 7.2, 3.2)}cqw` }} text={data.setlist} start={when("setlist")} />}
        {data.team && (
          <span className="ps-info__team ps-a ps-a--rise" style={at(when("team"))}>
            {data.team}
          </span>
        )}
        {data.startAt && (
          <div className="ps-info__when">
            <span className="ps-info__day ps-a ps-a--rise" style={at(when("date"))}>
              {formatDay(data.startAt)}
            </span>
            <span className="ps-info__time ps-a ps-a--pop" style={at(when("time"))}>
              {clock}
              <small>WIB</small>
            </span>
          </div>
        )}
        {data.venue && (
          <span className="ps-info__venue ps-a ps-a--rise" style={at(when("venue"))}>
            {data.venue}
          </span>
        )}
        {data.special && (
          <span className="ps-ribbon ps-a ps-a--mask" style={at(8.6)}>
            {data.special}
          </span>
        )}
      </div>
    </SceneFrame>
  );
}
