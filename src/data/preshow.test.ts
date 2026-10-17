import { describe, expect, it } from "vitest";
import { countdownPhase } from "@/components/preshow/countdown";
import { mapShowToPreShow, parseStart } from "@/components/preshow/data/mapShowToPreShow";
import { mockMembers } from "@/components/preshow/data/mock";
import { formatClock, formatDay, formatRemaining, infoLine } from "@/components/preshow/format";
import { buildTimeline, sceneAt } from "@/components/preshow/timeline";
import { greetingAt } from "@/components/preshow/useGreeting";
import type { DashShow } from "@/features/members/stage";
import type { Member } from "@/types";
import { noteServerDate, serverNow } from "@/utils/serverClock";

const member = (over: Partial<Member>): Member => ({
  slug: "gita",
  name: "Gita Sekar Andarini",
  nickname: "Gita",
  generation: 6,
  team: "PASSION",
  status: "active",
  photoUrl: "/photos/gita.jpg",
  color: "#000",
  jkt48Id: "1",
  socials: [],
  ...over,
});

const show = (over: Partial<DashShow>): DashShow => ({
  slug: "pajama-drive",
  code: "GSEMD3",
  title: "Pajama Drive",
  startsAt: "2026-10-18T12:00:00.000Z",
  endsAt: "2026-10-18T15:00:00.000Z",
  status: "upcoming",
  team: "PASSION",
  lineup: [],
  lineupMembers: [member({}), member({ slug: "freya", name: "Freyanashifa Jayawardana", nickname: "Freya", photoUrl: undefined })],
  posterUrl: undefined,
  bannerUrl: undefined,
  birthdayShow: false,
  onAir: false,
  viewers: 0,
  birthday: null,
  blurb: "",
  ...over,
});

const opts = { sponsors: 0, socials: 0, rules: 4 };

describe("pre-show data from the API", () => {
  it("maps a full show, keeping the lineup order", () => {
    const d = mapShowToPreShow(show({ birthday: "Gita" }));
    expect(d.setlist).toBe("Pajama Drive");
    expect(d.team).toBe("Team Passion");
    expect(d.startAt?.toISOString()).toBe("2026-10-18T12:00:00.000Z");
    expect(d.special).toBe("Birthday show · Gita");
    expect(d.members.map((m) => m.nickname)).toEqual(["Gita", "Freya"]);
    expect(d.members[1].photoUrl).toBeUndefined();
  });

  it("leaves out what the API doesn't have", () => {
    const d = mapShowToPreShow(show({ title: "  ", team: "JKT48", startsAt: "", lineupMembers: [] }));
    expect(d).toEqual({ setlist: undefined, team: undefined, startAt: undefined, special: undefined, members: [] });
    expect(mapShowToPreShow(null)).toEqual({ members: [] });
  });

  it("reads times with a zone as given, and zone-less times as WIB", () => {
    const utc = parseStart("2026-10-18T12:00:00.000Z")!;
    expect(formatDay(utc)).toBe("Minggu, 18 Oktober 2026");
    expect(formatClock(utc)).toBe("19:00 WIB");
    expect(parseStart("2026-10-18 19:00")!.toISOString()).toBe("2026-10-18T12:00:00.000Z");
    // Late UTC evening is already the next day in Jakarta.
    expect(formatDay(parseStart("2026-10-17T18:30:00Z")!)).toBe("Minggu, 18 Oktober 2026");
    expect(parseStart("not a date")).toBeUndefined();
  });

  it("builds the info line without empty parts", () => {
    expect(infoLine("Pajama Drive", parseStart("2026-10-18T12:00:00Z"))).toEqual(["Pajama Drive", "Minggu, 18 Oktober 2026", "19:00 WIB"]);
    expect(infoLine(undefined, parseStart("2026-10-18T12:00:00Z"))).toHaveLength(2);
    expect(infoLine("Pajama Drive")).toEqual(["Pajama Drive"]);
  });
});

describe("pre-show timeline", () => {
  const sum = (t: ReturnType<typeof buildTimeline>) => t.scenes.reduce((n, s) => n + s.dur, 0);

  it("always lasts 150 s, giving skipped scenes' time to the interlude", () => {
    const full = buildTimeline(mapShowToPreShow(show({})), { sponsors: 2, socials: 2, rules: 4 });
    expect(sum(full)).toBe(150);
    expect(full.scenes.map((s) => s.id)).toEqual(["opening", "info", "lineup", "interlude", "etiquette", "partner", "connect", "staytuned"]);

    const bare = buildTimeline({ members: [] }, opts);
    expect(sum(bare)).toBe(150);
    expect(bare.scenes.map((s) => s.id)).toEqual(["opening", "interlude", "etiquette", "staytuned"]);
    expect(bare.scenes.find((s) => s.id === "interlude")!.dur).toBe(17 + 18 + 35 + 12 + 10);
  });

  it("splits a big lineup into pages and ticks once per card", () => {
    const one = buildTimeline({ members: mockMembers(1) }, opts);
    expect(one.lineupPages).toBe(1);
    const many = buildTimeline({ members: mockMembers(25) }, opts);
    expect(many.lineupPages).toBe(2);
    const lineup = many.scenes.find((s) => s.id === "lineup")!;
    const inLineup = (at: number) => at >= lineup.start && at < lineup.start + lineup.dur;
    expect(many.cues.filter((c) => c.kind === "sfx" && c.name === "tick" && inLineup(c.at)).length).toBe(25);
    expect(many.cues.every((c) => c.at >= 0 && c.at < 150)).toBe(true);
  });

  it("finds the scene for any loop time", () => {
    const tl = buildTimeline(mapShowToPreShow(show({})), opts);
    expect(sceneAt(tl, 0).scene.id).toBe("opening");
    expect(sceneAt(tl, 149.99).scene.id).toBe("staytuned");
    expect(sceneAt(tl, 150).scene.id).toBe("opening");
    expect(sceneAt(tl, 12).local).toBeCloseTo(2);
  });
});

describe("pre-show countdown and greeting", () => {
  it("formats the time left", () => {
    expect(formatRemaining((2 * 86400 + 3 * 3600 + 15 * 60 + 20) * 1000)).toBe("2 hari 03:15:20");
    expect(formatRemaining((3600 + 5) * 1000)).toBe("01:00:05");
    expect(formatRemaining(754_000)).toBe("12:34");
    expect(formatRemaining(400)).toBe("00:01");
    expect(formatRemaining(-5)).toBe("00:00");
  });

  it("switches phase at the threshold and at zero", () => {
    expect(countdownPhase(null, 300)).toBe("none");
    expect(countdownPhase(301_000, 300)).toBe("loop");
    expect(countdownPhase(300_000, 300)).toBe("final");
    expect(countdownPhase(0, 300)).toBe("zero");
  });

  it("greets by the hour in Jakarta", () => {
    const at = (wib: string) => new Date(`2026-10-18T${wib}:00+07:00`);
    expect(greetingAt(at("08:00"))).toBe("pagi");
    expect(greetingAt(at("13:00"))).toBe("siang");
    expect(greetingAt(at("16:00"))).toBe("sore");
    expect(greetingAt(at("20:00"))).toBe("malam");
    expect(greetingAt(at("03:59"))).toBe("malam");
    expect(greetingAt(at("04:00"))).toBe("pagi");
  });
});

describe("server clock", () => {
  it("corrects a device clock that is minutes off, using the Date header", () => {
    const device = Date.now();
    // The server says it is five minutes later than this device thinks.
    const server = new Date(device + 5 * 60_000).toUTCString();
    noteServerDate(server, device - 40, device + 40);
    expect(Math.abs(serverNow() - (device + 5 * 60_000))).toBeLessThan(1500);
    noteServerDate("garbage", device, device);
    expect(Math.abs(serverNow() - (device + 5 * 60_000))).toBeLessThan(1500);
  });
});
