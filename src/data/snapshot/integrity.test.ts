import { describe, expect, it } from "vitest";
import { buildDataset } from "../adapt";
import { membersResponse } from "./members";
import { recentResponse } from "./recent";
import { theaterResponse } from "./theater";
import { SNAPSHOT_NOW, snapshotDataset } from "./index";

const ds = snapshotDataset();
const NOW = new Date(SNAPSHOT_NOW).getTime();

describe("snapshot data", () => {
  it("has unique member slugs and no stand-ins", () => {
    expect(new Set(ds.members.map((m) => m.slug)).size).toBe(ds.members.length);
    expect(ds.members.length).toBe(membersResponse.length);
  });

  it("resolves every /recent session to a member", () => {
    expect(ds.streams.filter((s) => recentResponse.some((r) => r._id === s.id)).length).toBe(recentResponse.length);
  });

  it("resolves every theater lineup entry", () => {
    expect(ds.shows.reduce((n, s) => n + s.lineup.length, 0)).toBe(theaterResponse.reduce((n, t) => n + t.lineup.length, 0));
  });

  it("only marks streams live when they span the replay instant", () => {
    for (const s of ds.streams) {
      expect(new Date(s.startedAt).getTime()).toBeLessThanOrEqual(NOW);
      if (s.status === "ended") expect(new Date(s.endedAt!).getTime()).toBeLessThanOrEqual(NOW);
    }
    expect(ds.streams.some((s) => s.status === "live")).toBe(true);
  });

  it("links news to the official site", () => {
    for (const n of ds.news) expect(n.url.startsWith("https://jkt48.com/news/")).toBe(true);
  });
});

describe("live adapter", () => {
  it("maps /live entries, resolving keys like JKT48-Jesslyn", () => {
    const out = buildDataset(
      {
        members: membersResponse,
        birthdays: [],
        live: [{ name: "Jesslyn", url_key: "JKT48-Jesslyn", platform: "showroom", img: "/media/api/img/i/x.jpg", stream_url: "https://example.invalid/playlist.m3u8", started_at: "2026-10-11T05:00:00Z" }],
        recent: [],
        theater: [],
        news: [],
      },
      new Date("2026-10-11T06:00:00Z").getTime(),
    );
    const live = out.streams.filter((s) => s.status === "live");
    expect(live).toHaveLength(1);
    expect(live[0].memberSlug).toBe("jesslyn-elly");
    expect(live[0].url).toContain(".m3u8");
  });

  it("creates a stand-in for a streamer missing from /members", () => {
    const out = buildDataset(
      { members: [], birthdays: [], live: [{ name: "Someone", url_key: "JKT48-Someone", platform: "idn", img: "", stream_url: null, started_at: "" }], recent: [], theater: [], news: [] },
      Date.now(),
    );
    expect(out.members).toHaveLength(1);
    expect(out.streams[0].memberSlug).toBe(out.members[0].slug);
  });
});
