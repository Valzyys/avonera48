import { describe, expect, it } from "vitest";
import { recentResponse } from "./recent";
import { theaterResponse } from "./theater";
import { DEMO_NOW_MS, findMember, members, news, shows, streams } from "./index";

describe("snapshot data", () => {
  it("has unique member slugs", () => {
    expect(new Set(members.map((m) => m.slug)).size).toBe(members.length);
  });

  it("resolves every /recent session to a member", () => {
    for (const r of recentResponse) expect(findMember(r.member.url) ?? findMember(r.member.name), r.member.url).toBeDefined();
  });

  it("resolves every theater lineup entry by jkt48 id", () => {
    const ids = new Set(members.map((m) => m.jkt48Id));
    for (const t of theaterResponse) for (const l of t.lineup) expect(ids.has(l.id), l.name).toBe(true);
    expect(shows.reduce((n, s) => n + s.lineup.length, 0)).toBe(theaterResponse.reduce((n, t) => n + t.lineup.length, 0));
  });

  it("only marks streams live when they span the replay instant", () => {
    for (const s of streams) {
      const start = new Date(s.startedAt).getTime();
      expect(start).toBeLessThanOrEqual(DEMO_NOW_MS);
      if (s.status === "live") expect(s.endedAt).toBeUndefined();
      else expect(new Date(s.endedAt!).getTime()).toBeLessThanOrEqual(DEMO_NOW_MS);
    }
    expect(streams.some((s) => s.status === "live")).toBe(true);
  });

  it("uses proxied image URLs only", () => {
    const urls = [...members.map((m) => m.photoUrl), ...streams.map((s) => s.thumbnailUrl), ...shows.map((s) => s.posterUrl)].filter(Boolean) as string[];
    for (const u of urls) expect(u.startsWith("https://jkt48connect.com/")).toBe(true);
  });

  it("links news to the official site", () => {
    for (const n of news) expect(n.url.startsWith("https://jkt48.com/news/")).toBe(true);
  });
});
