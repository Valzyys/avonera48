import { describe, expect, it } from "vitest";
import { toDashShows } from "@/features/members/stage";
import type { ShowSummary } from "@/services/types";
import type { StageShow } from "../../worker/stage";

const stage = (over: Partial<StageShow>): StageShow => ({
  slug: "pajama-drive-2026-10-16-261010220005",
  code: "GSEMD3",
  title: "Pajama Drive",
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
  title: "Pajama Drive",
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

  it("falls back to the same title on the same day, then to the listing's own art", () => {
    const [byTitle] = toDashShows([stage({})], [scheduled({ startsAt: "2026-10-16T14:00:00+07:00" })]);
    expect(byTitle.bannerUrl).toBe("/media/banner.jpg");
    const [alone] = toDashShows([stage({})], []);
    expect(alone.bannerUrl).toBe("https://img.example/poster.webp");
    expect(alone.team).toBe("JKT48");
  });

  it("leaves out ended shows and keeps the live flag", () => {
    const list = toDashShows([stage({ status: "ended" }), stage({ slug: "live", status: "live", viewers: 296 })]);
    expect(list.map((s) => [s.slug, s.onAir, s.viewers])).toEqual([["live", true, 296]]);
  });
});
