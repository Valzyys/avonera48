import { describe, expect, it } from "vitest";
import { liveStreams, members, news, shows } from "./index";
import { mockService } from "@/services/mockService";

const slugs = new Set(members.map((m) => m.slug));

describe("preview data integrity", () => {
  it("uses unique member slugs", () => {
    expect(slugs.size).toBe(members.length);
  });

  it("references only existing members", () => {
    for (const s of liveStreams) expect(slugs.has(s.memberSlug), s.id).toBe(true);
    for (const show of shows) for (const l of show.lineup) expect(slugs.has(l.memberSlug), show.slug).toBe(true);
    for (const n of news) for (const m of n.relatedMemberSlugs) expect(slugs.has(m), n.slug).toBe(true);
  });

  it("has at most one center per show and unique show/news slugs", () => {
    for (const show of shows) expect(show.lineup.filter((l) => l.role === "center").length).toBeLessThanOrEqual(1);
    expect(new Set(shows.map((s) => s.slug)).size).toBe(shows.length);
    expect(new Set(news.map((n) => n.slug)).size).toBe(news.length);
  });

  it("never ships stream or replay links in preview data", () => {
    for (const s of liveStreams) {
      expect(s.url).toBeNull();
      expect(s.replayUrl).toBeNull();
    }
  });

  it("is deterministic", async () => {
    const a = await mockService.listRecentLives();
    const b = await mockService.listRecentLives();
    expect(a).toEqual(b);
  });

  it("joins member detail with lives, shows and news", async () => {
    const d = await mockService.getMember("naira");
    expect(d?.isLive?.member.slug).toBe("naira");
    expect(d?.shows.length).toBeGreaterThan(0);
    expect(d?.news.some((n) => n.relatedMemberSlugs.includes("naira"))).toBe(true);
  });
});
