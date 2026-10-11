import { describe, expect, it } from "vitest";
import { buildDataset, idnLiveLink } from "./adapt";

describe("live links", () => {
  it("builds IDN's share link for a live room", () => {
    expect(idnLiveLink("jkt48_michie", "hi-261011192644")).toBe(
      "https://click.idn.media/VKUf?af_dp=idnapp%3A%2F%2Flive%2Fjkt48_michie%2F%3Froom%3Dhi-261011192644&af_web_dp=https%3A%2F%2Fwww.idn.app%2Fjkt48_michie%2Flive%2Fhi-261011192644&c=detail-liveroom&deep_link_value=idnapp%3A%2F%2Flive%2F%3Froom%3Dhi-261011192644&pid=idnapp",
    );
  });

  it("links IDN out and plays SHOWROOM on site, best quality first", () => {
    const d = buildDataset(
      {
        members: [],
        birthdays: [],
        recent: [],
        theater: [],
        news: [],
        live: [
          { name: "Michie JKT48", url_key: "jkt48_michie", platform: "idn", img: "", slug: "hi-261011192644", room_id: 0, stream_url: "https://x.example/a.m3u8", started_at: "2026-10-11T19:26:50+07:00" },
          {
            name: "Nayla",
            url_key: "JKT48_Nayla",
            platform: "showroom",
            img: "",
            slug: null,
            room_id: 510064,
            stream_url: "https://cdn.example/main_ss.m3u8",
            streaming: [
              { label: "低画質", quality: 100, url: "https://cdn.example/main_ll.m3u8" },
              { label: "オリジナル画質", quality: 1000, url: "https://cdn.example/main_ss.m3u8" },
              { label: "中画質", quality: 200, url: "https://cdn.example/main_mm.m3u8" },
            ],
            started_at: "2026-10-11T12:59:24.000Z",
          },
        ],
      },
      Date.parse("2026-10-11T13:10:00Z"),
    );
    const idn = d.streams.find((s) => s.platform === "IDN Live")!;
    expect(idn.url).toContain("click.idn.media");
    expect(idn.watchPath).toBeUndefined();
    const sr = d.streams.find((s) => s.platform === "SHOWROOM")!;
    expect(sr.watchPath).toBe(`/watch/${sr.memberSlug}`);
    expect(sr.sources?.map((s) => s.label)).toEqual(["Original", "Medium", "Low"]);
  });
});
