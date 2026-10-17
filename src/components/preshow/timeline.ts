import type { PreShowData } from "./data/types";

export type SceneId = "opening" | "info" | "lineup" | "interlude" | "etiquette" | "partner" | "connect" | "staytuned";

export type Cue =
  | { at: number; kind: "sfx"; name: SfxName; rate?: number; gain?: number }
  | { at: number; kind: "vo"; name: VoName };

export type SfxName = "riser" | "impact" | "whoosh-in" | "whoosh-out" | "shimmer" | "tick" | "pop" | "swell" | "final-hit" | "beep" | "beep-high";
export type VoName = "welcome" | "etiquette" | "stay-tuned" | "countdown" | "outro";

export interface Scene {
  id: SceneId;
  start: number;
  dur: number;
}

export interface Timeline {
  length: number;
  scenes: Scene[];
  cues: Cue[];
  /** Lineup layout: pages of at most 16 cards. */
  lineupPages: number;
}

export const LOOP = 150;
export const PAGE_SIZE = 16;
const BASE: [SceneId, number][] = [
  ["opening", 10],
  ["info", 18],
  ["lineup", 35],
  ["interlude", 17],
  ["etiquette", 28],
  ["partner", 12],
  ["connect", 10],
  ["staytuned", 20],
];

/** When card i of n on a page appears, seconds after the page starts (all in within ~8 s). */
export const cardDelay = (i: number, n: number) => 1.6 + i * Math.min(0.45, 8 / Math.max(1, n));

/** The info blocks shown, in order, so cues and scene agree. */
export const infoBlocks = (d: PreShowData) =>
  (["setlist", "team", "date", "time", "venue"] as const).filter((b) =>
    b === "setlist" ? !!d.setlist : b === "team" ? !!d.team : b === "venue" ? !!d.venue : !!d.startAt,
  );
export const infoBlockAt = (k: number) => 1.2 + k * 1.3;

/**
 * Scene times for one loop. Skipped scenes give their time to the Stage
 * Interlude, so the loop is always exactly 150 s.
 */
export function buildTimeline(data: PreShowData, opts: { sponsors: number; socials: number; rules: number }): Timeline {
  const skip: Partial<Record<SceneId, boolean>> = {
    info: !data.setlist && !data.startAt,
    lineup: data.members.length === 0,
    partner: opts.sponsors === 0,
    connect: opts.socials === 0,
  };
  const freed = BASE.reduce((n, [id, d]) => n + (skip[id] ? d : 0), 0);
  const scenes: Scene[] = [];
  let t = 0;
  for (const [id, d] of BASE) {
    if (skip[id]) continue;
    const dur = id === "interlude" ? d + freed : d;
    scenes.push({ id, start: t, dur });
    t += dur;
  }

  const n = data.members.length;
  const lineupPages = Math.max(1, Math.ceil(n / PAGE_SIZE));
  const cues: Cue[] = [];
  for (const s of scenes) {
    const at = (x: number) => s.start + x;
    switch (s.id) {
      case "opening":
        cues.push({ at: at(0), kind: "sfx", name: "riser" }, { at: at(2.6), kind: "sfx", name: "impact" }, { at: at(3.1), kind: "sfx", name: "shimmer" }, { at: at(3), kind: "vo", name: "welcome" });
        break;
      case "info":
        cues.push({ at: at(0.3), kind: "sfx", name: "whoosh-in" });
        infoBlocks(data).forEach((b, k) => cues.push(b === "setlist" ? { at: at(infoBlockAt(k)), kind: "sfx", name: "impact", gain: 0.5 } : { at: at(infoBlockAt(k)), kind: "sfx", name: "whoosh-in", gain: 0.6 }));
        if (data.special) cues.push({ at: at(8.6), kind: "sfx", name: "shimmer" });
        cues.push({ at: at(s.dur - 0.9), kind: "sfx", name: "whoosh-out" });
        break;
      case "lineup": {
        const pageDur = (s.dur - 1) / lineupPages;
        for (let p = 0; p < lineupPages; p++) {
          const count = Math.min(PAGE_SIZE, n - p * PAGE_SIZE);
          const base = 1 + p * pageDur;
          for (let i = 0; i < count; i++) cues.push({ at: at(base + cardDelay(i, count)), kind: "sfx", name: "tick", rate: 1 + Math.min(i, 24) * 0.035, gain: 0.7 });
          cues.push({ at: at(base + cardDelay(count, count)), kind: "sfx", name: "swell", gain: 0.6 });
        }
        break;
      }
      case "interlude":
        for (let i = 0; i < 7; i++) cues.push({ at: at(1.5 + i * 0.55), kind: "sfx", name: "tick", rate: 0.8 + i * 0.06 });
        cues.push({ at: at(5.8), kind: "sfx", name: "swell" });
        break;
      case "etiquette":
        cues.push({ at: at(0.4), kind: "sfx", name: "whoosh-in" }, { at: at(1.5), kind: "vo", name: "etiquette" });
        for (let i = 0; i < opts.rules; i++) cues.push({ at: at(3 + i * 5), kind: "sfx", name: "pop" });
        break;
      case "partner":
        cues.push({ at: at(0.3), kind: "sfx", name: "whoosh-in" }, { at: at(s.dur - 0.9), kind: "sfx", name: "whoosh-out" });
        break;
      case "connect":
        cues.push({ at: at(0.6), kind: "sfx", name: "shimmer" });
        break;
      case "staytuned":
        cues.push({ at: at(2), kind: "vo", name: "stay-tuned" });
        break;
    }
  }
  return { length: LOOP, scenes, cues: cues.sort((a, b) => a.at - b.at), lineupPages };
}

/** The scene playing at loop time t, and the time inside it. */
export function sceneAt(tl: Timeline, t: number) {
  const x = ((t % tl.length) + tl.length) % tl.length;
  const s = tl.scenes.find((sc) => x >= sc.start && x < sc.start + sc.dur) ?? tl.scenes[tl.scenes.length - 1];
  return { scene: s, local: x - s.start };
}
