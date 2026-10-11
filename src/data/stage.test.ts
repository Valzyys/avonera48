import { describe, expect, it } from "vitest";
import { parseStage, parseStageList, withArt } from "../../worker/stage";

const passion = {
  slug: "passion-200-2026-10-11-261003211051",
  title: "PASSION 200% - 2026/10/11",
  image_url: "https://img.example/08209da7f9cc4a3f98e4.webp",
  view_count: 296,
  playback_url: "https://playback.example/channel.m3u8",
  room_identifier: "d38cfc9e-2ad1-42c8-85c5-80728a2c08cd",
  status: "live",
  live_at: 1791719086,
  end_at: 0,
  scheduled_at: 1791719100,
  idnliveplus: { description: "Show start: 19.00" },
  showId: "GSEH2I",
};

const sambil = {
  slug: "sambil-menggandeng-erat-tanganku-2026-10-17-261010220228",
  title: "Sambil Menggandeng Erat Tanganku - 2026/10/17",
  image_url: "https://img.example/4bd202f675747b1a589c.webp",
  view_count: 0,
  status: "scheduled",
  end_at: 0,
  scheduled_at: 1792237500,
  idnliveplus: { description: "Show start: 19.00\nTeam: Passion" },
  showId: "GS0S8U",
};

const NOW = Date.parse("2026-10-11T19:30:00+07:00");

describe("IDN Plus show listing", () => {
  it("reads the title, start time, team and birthday", () => {
    const s = parseStage(sambil, NOW)!;
    expect(s.title).toBe("Sambil Menggandeng Erat Tanganku");
    expect(s.startsAt).toBe(new Date("2026-10-17T19:00:00+07:00").toISOString());
    expect(s.status).toBe("scheduled");
    expect(s.team).toBe("PASSION");
    expect(s.code).toBe("GS0S8U");
    expect(s.description).toBe("");

    const b = parseStage({ ...sambil, idnliveplus: { description: "Show start: 14.00\nBirthday: Nachia" } }, NOW)!;
    expect(b.birthday).toBe("Nachia");
    expect(b.team).toBeNull();
    expect(b.startsAt).toBe(new Date("2026-10-17T14:00:00+07:00").toISOString());
  });

  it("keeps the live status and never passes on the playback URL", () => {
    const s = parseStage(passion, NOW)!;
    expect(s.status).toBe("live");
    expect(s.viewers).toBe(296);
    expect(JSON.stringify(s)).not.toContain("playback");
    expect(JSON.stringify(s)).not.toContain("d38cfc9e");
  });

  it("falls back to the doors time and marks old shows as ended", () => {
    const s = parseStage({ ...sambil, title: "Sambil Menggandeng Erat Tanganku", idnliveplus: null }, NOW)!;
    expect(s.startsAt).toBe(new Date((1792237500 + 15 * 60) * 1000).toISOString());
    const old = parseStage({ ...sambil, status: "scheduled" }, Date.parse("2026-10-18T12:00:00+07:00"))!;
    expect(old.status).toBe("ended");
    expect(parseStage({ ...sambil, end_at: 1792250000 }, NOW)!.status).toBe("ended");
  });

  it("sorts the list by start and skips broken rows", () => {
    const list = parseStageList({ data: [sambil, { slug: "x" }, passion] }, NOW);
    expect(list.map((s) => s.code)).toEqual(["GSEH2I", "GS0S8U"]);
    expect(parseStageList({ status: 500 })).toEqual([]);
  });

  it("takes the banner and poster from /api/v1/theater, through /media", () => {
    const rows = [
      {
        date: "2026-10-17",
        title: "Sambil Menggandeng Erat Tanganku",
        start_time: "19:00",
        banner: "https://jkt48connect.com/api/img/i/ejol3w32.jpg",
        poster: "https://jkt48connect.com/api/img/i/ykbuwar6.jpg",
      },
      { date: "2026-10-17", title: "DREAM BAKUDAN", start_time: "14:00", banner: "https://jkt48connect.com/api/img/i/suktznhm.jpg", poster: null },
    ];
    const [s] = withArt([parseStage(sambil, NOW)!], rows);
    expect(s.banner).toBe("/media/api/img/i/ejol3w32.jpg");
    expect(s.poster).toBe("/media/api/img/i/ykbuwar6.jpg");

    // Same day, start time off: the title still finds it.
    const [late] = withArt([parseStage({ ...sambil, idnliveplus: { description: "Show start: 19.30" } }, NOW)!], rows);
    expect(late.banner).toBe("/media/api/img/i/ejol3w32.jpg");

    // Nothing on that day: no art.
    expect(withArt([parseStage(passion, NOW)!], rows)[0].banner).toBeNull();
  });
});
