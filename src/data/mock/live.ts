import type { LiveStream } from "@/types";
import { daysAgo } from "./clock";

/**
 * PREVIEW DATA — sample stream activity. "live" here means live in the sample
 * timeline (DEMO_NOW), not in reality. No stream or replay links are provided.
 */
const s = (
  id: string,
  memberSlug: string,
  platform: LiveStream["platform"],
  title: string,
  start: [number, number, number],
  end?: [number, number, number],
  viewers?: number,
): LiveStream => ({
  id,
  memberSlug,
  platform,
  title,
  status: end ? "ended" : "live",
  startedAt: daysAgo(...start),
  endedAt: end ? daysAgo(...end) : undefined,
  viewers,
  url: null,
  replayUrl: null,
});

export const liveStreams: LiveStream[] = [
  s("lv-5501", "naira", "IDN Live", "Evening chat after rehearsal", [0, 15, 32], undefined, 4210),
  s("lv-5502", "elvaretta", "SHOWROOM", "Homework & karaoke", [0, 15, 48], undefined, 2875),
  s("lv-5503", "kirana", "SHOWROOM", "Trainee diary #12", [0, 15, 51], undefined, 1302),
  s("lv-5500", "larasati", "IDN Live", "Setlist trivia night", [0, 11, 0], [0, 12, 14], 3980),
  s("lv-5499", "cahya", "SHOWROOM", "Cooking attempt #4", [0, 8, 20], [0, 9, 2], 2210),
  s("lv-5497", "arunika", "IDN Live", "Backstage recap", [1, 21, 0], [1, 22, 5], 6390),
  s("lv-5496", "gendis", "IDN Live", "Morning stretch", [1, 7, 15], [1, 7, 52], 1540),
  s("lv-5495", "ivana", "SHOWROOM", "Acoustic request hour", [1, 20, 30], [1, 21, 40], 3105),
  s("lv-5493", "cahya", "SHOWROOM", "Cooking attempt #3", [2, 20, 10], [2, 21, 30], 3322),
  s("lv-5492", "jovanka", "IDN Live", "Dance practice log", [2, 18, 0], [2, 18, 45], 1188),
  s("lv-5490", "tsabita", "IDN Live", "Birthday countdown", [3, 22, 0], [3, 23, 59], 5108),
  s("lv-5489", "naira", "SHOWROOM", "Late night letters", [3, 23, 10], [4, 0, 20], 4012),
  s("lv-5487", "ghea", "IDN Live", "Variety game challenge", [4, 19, 0], [4, 20, 20], 2790),
  s("lv-5485", "diandra", "SHOWROOM", "Vocal warm-up", [5, 9, 0], [5, 9, 35], 980),
  s("lv-5484", "kalista", "IDN Live", "Choreo breakdown", [5, 21, 15], [5, 22, 30], 3466),
];
