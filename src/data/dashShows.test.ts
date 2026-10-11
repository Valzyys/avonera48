import { describe, expect, it } from "vitest";
import { toDashShows } from "@/features/members/stage";
import type { ShowSummary } from "@/services/types";
import type { StageShow } from "../../worker/stage";

const stage = (over: Partial<StageShow>): StageShow => ({
  slug: "pajama-drive-2026-10-16-261010220005",
  code: "GSEMD3",
  title: "Aitakatta",
  startsAt: "2026-10-16T12:00:00.000Z",
  endsAt: "2026-10-16T15:00:00.000Z",
  status: "scheduled",
  image: "https://img.example/poster.webp",
  description: "",
  viewers: 0,
  team: null,
  birthday: null,
  banner: null,
  poster: null,
  ...over,
});

const scheduled = (over: Partial<ShowSummary>): ShowSummary => ({
  slug: "sh6b09",
  code: "SH6B09",
  title: "Aitakatta",
  startsAt: "2026-10-16T19:00:00+07:00",
  endsAt: "2026-10-16T21:00:00+07:00",
  status: "upcoming",
  team: "TRAINEE",
  lineup: ["a"],
  lineupMembers: [],
  posterUrl: "/media/poster.jpg",
  bannerUrl: "/media/banner.jpg",
  birthdayShow: false,
  ...over,
});

describe("dashboard shows", () => {
  it("takes the banner, team and lineup from the schedule show at the same time", () => {
    const [s] = toDashShows([stage({})], [scheduled({})]);
    expect(s.bannerUrl).toBe("/media/banner.jpg");
    expect(s.team).toBe("TRAINEE");
    expect(s.lineup).toEqual(["a"]);
    expect(s.slug).toBe("pajama-drive-2026-10-16-261010220005");
  });

  it("falls back to the same title on the same day, and never uses the IDN Plus image", () => {
    const [byTitle] = toDashShows([stage({})], [scheduled({ startsAt: "2026-10-16T14:00:00+07:00" })]);
    expect(byTitle.bannerUrl).toBe("/media/banner.jpg");
    expect(byTitle.posterUrl).toBeUndefined();
    const [alone] = toDashShows([stage({})], []);
    expect(alone.bannerUrl).toBeUndefined();
    expect(alone.posterUrl).toBeUndefined();
    expect(alone.team).toBe("JKT48");
  });

  it("prefers the banner the server attached", () => {
    const [s] = toDashShows([stage({ banner: "/media/api/img/i/server-banner.jpg" })], [scheduled({})]);
    expect(s.bannerUrl).toBe("/media/api/img/i/server-banner.jpg");
  });

  it("leaves out ended shows and keeps the live flag", () => {
    const list = toDashShows([stage({ status: "ended" }), stage({ slug: "live", status: "live", viewers: 296 })]);
    expect(list.map((s) => [s.slug, s.onAir, s.viewers])).toEqual([["live", true, 296]]);
  });
});

describe("show banner map", () => {
  it("uses the mapped banner first, matching titles loosely", async () => {
    const { bannerFor } = await import("@/features/members/showImages");
    expect(bannerFor("PASSION 200%")).toBe("https://img.jkt48connect.com/jkt48/theater/uploads/y2g3dgukgk8ohxghfxv8lyju.jpg");
    expect(bannerFor("ITADAKI♥LOVE")).toBe("https://img.jkt48connect.com/jkt48/theater/uploads/cq0m6aj6ajj3efolbqtlur0d.jpg");
    expect(bannerFor("ITADAKI🤍LOVE")).toBe("https://img.jkt48connect.com/jkt48/theater/uploads/cq0m6aj6ajj3efolbqtlur0d.jpg");
    expect(bannerFor("Sambil Menggandeng Erat Tanganku")).toContain("zjdka1gtuuoc5gx9kkco");
    expect(bannerFor("Unknown Show")).toBeUndefined();
    const [s] = toDashShows([stage({ title: "Pajama Drive", banner: "/media/api/img/i/x.jpg" })], [scheduled({})]);
    expect(s.bannerUrl).toBe("https://img.jkt48connect.com/jkt48/theater/uploads/ud3mb6r76obaftx4snzy.jpg");
  });
});
