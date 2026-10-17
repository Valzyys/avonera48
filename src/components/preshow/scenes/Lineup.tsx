import type { CSSProperties } from "react";
import type { PreShowMember } from "../data/types";
import { cardDelay, PAGE_SIZE } from "../timeline";
import { MemberCard } from "../ui/MemberCard";
import { at, SceneFrame, type SceneProps } from "./common";

/**
 * Columns that give the biggest cards for n cards in a w×h box (cqw). A card
 * is a 3:4 photo plus about 0.42 of its width in name lines.
 */
export function gridFor(n: number, w = 88, h = 34) {
  let best = { cols: 1, rows: n, size: 0 };
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols);
    const size = Math.min(w / cols, h / rows / (4 / 3 + 0.42));
    if (size > best.size) best = { cols, rows, size };
  }
  return best;
}

function Page({ members, start, end, last }: { members: PreShowMember[]; start: number; end: number; last: boolean }) {
  const n = members.length;
  const full = start + cardDelay(n, n) + 0.6;
  // Spotlight: each member in turn, if there's time for at least ~0.9 s each.
  const spotFrom = full + 0.6;
  const slot = (end - 0.8 - spotFrom) / n;
  const spot = slot >= 0.9;
  // With a spotlight, the grid leaves room on the right for the name.
  const { cols, rows, size } = gridFor(n, spot ? 62 : 88);
  return (
    <div
      className={`ps-page${last ? " is-last" : ""}`}
      style={{ ...at(start), ["--page-out" as string]: `${end - 0.6}s`, ["--cols" as string]: cols, ["--rows" as string]: rows, ["--card" as string]: `${size}cqw` } as CSSProperties}
    >
      <div className="ps-grid">
        {members.map((m, i) => {
          const r = Math.floor(i / cols);
          const c = i % cols;
          return (
            <MemberCard
              key={`${m.name}-${i}`}
              member={m}
              className={`ps-a ps-a--card${spot ? " ps-spot" : ""}`}
              style={{ ...at(start + cardDelay(i, n)), ["--dx" as string]: `${(c - cols / 2) * -2}cqw`, ["--dy" as string]: `${(r + 1) * -3}cqw`, ["--spot" as string]: `${spotFrom + i * slot}s`, ["--slot" as string]: `${slot}s` } as CSSProperties}
            />
          );
        })}
      </div>
      {spot && (
        <div className="ps-spotname" aria-hidden>
          {members.map((m, i) => (
            <b key={i} style={{ ["--spot" as string]: `${spotFrom + i * slot}s`, ["--slot" as string]: `${slot}s` } as CSSProperties}>
              {m.nickname ?? m.name}
            </b>
          ))}
        </div>
      )}
    </div>
  );
}

/** 28–63 s: the performing members, cascading in; over 16 they come in pages that slide across. */
export function Lineup({ dur, data }: SceneProps) {
  const members = data.members;
  const pages = Math.max(1, Math.ceil(members.length / PAGE_SIZE));
  const pageDur = (dur - 1) / pages;
  return (
    <SceneFrame id="lineup" dur={dur}>
      <div className="ps-lineup">
        <span className="ps-label ps-a ps-a--rise" style={at(0.3)}>
          PERFORMING MEMBERS <small>{members.length}</small>
        </span>
        <div className="ps-pages">
          {Array.from({ length: pages }, (_, p) => (
            <Page key={p} members={members.slice(p * PAGE_SIZE, (p + 1) * PAGE_SIZE)} start={1 + p * pageDur} end={1 + (p + 1) * pageDur} last={p === pages - 1} />
          ))}
        </div>
      </div>
      <ul className="ps-sr">
        {members.map((m, i) => (
          <li key={i}>{m.nickname ? `${m.nickname} (${m.name})` : m.name}</li>
        ))}
      </ul>
    </SceneFrame>
  );
}
