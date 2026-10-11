/**
 * Pure mapping from jkt48connect.com API v1 responses to the site's domain
 * models. Used for both the live API (through the Worker) and the bundled
 * snapshot fallback.
 */
import type { Generation, LiveStream, Member, NewsArticle, TheaterShow } from "@/types";
import { asTeam, teamColor } from "@/utils/team";
import type { ApiBirthday, ApiLive, ApiMember, ApiNews, ApiRecent, ApiRecentDetail, ApiTheater } from "./snapshot/types";

export interface Dataset {
  /** The instant "now" refers to (epoch ms). */
  now: number;
  members: Member[];
  generations: Generation[];
  streams: LiveStream[];
  shows: TheaterShow[];
  news: NewsArticle[];
}

export interface RawData {
  members: ApiMember[];
  birthdays: ApiBirthday[];
  live: ApiLive[];
  recent: ApiRecent[];
  recentDetail?: ApiRecentDetail[];
  theater: ApiTheater[];
  news: ApiNews[];
}

const birthdayFor = (m: ApiMember, birthdays: ApiBirthday[]) => {
  const nick = m.nicknames?.[0]?.toLowerCase();
  const hit = birthdays.find((b) => b.url_key === m.url_key || b.url_key === nick || m.url_key.startsWith(`${b.url_key}-`));
  // The date part is the birthday (the source pairs it with `next_birthday` on that date).
  return hit?.birthdate?.slice(0, 10);
};

function toMember(m: ApiMember, birthdays: ApiBirthday[]): Member {
  const team = asTeam(m.team ?? "");
  const gen = /^gen(\d+)/.exec(m.generation ?? "")?.[1];
  return {
    slug: m.url_key,
    name: m.name,
    nickname: m.nicknames?.[0] ?? m.name.split(" ")[0],
    generation: gen ? Number(gen) : null,
    team,
    status: m.is_graduate ? "graduated" : team === "TRAINEE" ? "trainee" : "active",
    photoUrl: m.img || undefined,
    color: teamColor(team),
    jkt48Id: String(m.jkt48_id ?? ""),
    showroomRoomId: m.room_id || undefined,
    idnUsername: m.idn_username || undefined,
    socials: m.socials ?? [],
    birthday: birthdayFor(m, birthdays),
  };
}

/** Builds a lookup that resolves the keys used by the live endpoints ("lily", "Lily JKT48", "JKT48-Jesslyn"). */
function finder(members: Member[]) {
  const bySlug = new Map(members.map((m) => [m.slug.toLowerCase(), m]));
  return (key: string): Member | undefined => {
    const k = key
      .toLowerCase()
      .replace(/^jkt48[-_ ]/, "")
      .replace(/[-_ ]?jkt48$/, "")
      .trim();
    if (!k) return undefined;
    return (
      bySlug.get(k) ??
      members.find((m) => m.nickname.toLowerCase() === k) ??
      members.find((m) => m.slug.startsWith(`${k}-`)) ??
      members.find((m) => m.name.toLowerCase() === k)
    );
  };
}

/** A minimal record for someone who streams but is missing from /members. */
function standIn(key: string, name: string, img?: string): Member {
  const nickname = name.replace(/\s*JKT48$/i, "").trim() || key;
  return {
    slug: key.toLowerCase().replace(/[^a-z0-9-]+/g, "-"),
    name: nickname,
    nickname,
    generation: null,
    team: "JKT48",
    status: "active",
    photoUrl: img,
    color: teamColor("JKT48"),
    jkt48Id: "",
    socials: [],
  };
}

export function buildDataset(raw: RawData, now: number): Dataset {
  const members = raw.members.map((m) => toMember(m, raw.birthdays));
  const find = finder(members);
  const resolve = (key: string, name: string, img?: string) => {
    const hit = find(key) ?? find(name);
    if (hit) return hit;
    const extra = standIn(key || name, name, img);
    members.push(extra);
    return extra;
  };

  const live: LiveStream[] = raw.live.map((l) => {
    const member = resolve(l.url_key, l.name, l.img);
    const platform = l.platform === "idn" ? "IDN Live" : "SHOWROOM";
    return {
      id: `live:${l.platform}:${l.url_key}:${l.started_at ?? ""}`,
      memberSlug: member.slug,
      platform,
      title: l.title?.trim() || `${member.nickname} on ${platform}`,
      status: "live",
      startedAt: l.started_at || new Date(now).toISOString(),
      url: l.stream_url || null,
      replayUrl: null,
      thumbnailUrl: l.img || member.photoUrl,
    };
  });
  const liveSlugs = new Set(live.map((l) => l.memberSlug));

  const recent: LiveStream[] = raw.recent.flatMap((r) => {
    const start = new Date(r.live_info.date.start).getTime();
    const end = new Date(r.live_info.date.end).getTime();
    if (start > now) return [];
    const member = resolve(r.member.url, r.member.name, r.member.img);
    // A session that spans "now" is live (used when replaying a snapshot).
    const isLive = end > now;
    if (isLive && liveSlugs.has(member.slug)) return [];
    return [
      {
        id: r._id,
        memberSlug: member.slug,
        platform: r.type === "idn" ? "IDN Live" : "SHOWROOM",
        title: r.idn.title.trim(),
        status: isLive ? "live" : "ended",
        startedAt: r.live_info.date.start,
        endedAt: isLive ? undefined : r.live_info.date.end,
        viewers: r.live_info.viewers.num,
        url: null,
        replayUrl: null,
        thumbnailUrl: r.idn.image || r.member.img,
        giftTotal: r.total_gift,
      } satisfies LiveStream,
    ];
  });
  const seen = new Set(recent.map((r) => r.id));

  const detail: LiveStream[] = (raw.recentDetail ?? []).flatMap((d) => {
    if (seen.has(d.id) || d.end_time > now) return [];
    const member = resolve(d.name, d.name, d.image);
    return [
      {
        id: d.id,
        memberSlug: member.slug,
        platform: d.type === "idn" ? "IDN Live" : "SHOWROOM",
        title: d.title,
        status: "ended",
        startedAt: new Date(d.start_time).toISOString(),
        endedAt: new Date(d.end_time).toISOString(),
        viewers: d.max_viewers,
        url: null,
        replayUrl: d.youtube_url,
        thumbnailUrl: d.image,
        comments: d.comment_count,
      } satisfies LiveStream,
    ];
  });

  const byJkt48Id = new Map(members.filter((m) => m.jkt48Id).map((m) => [m.jkt48Id, m]));
  const shows: TheaterShow[] = raw.theater.map((t) => {
    const startsAt = `${t.date}T${t.start_time}:00+07:00`;
    const endsAt = `${t.date}T${t.end_time || t.start_time}:00+07:00`;
    return {
      slug: t.reference_code.toLowerCase(),
      code: t.reference_code,
      title: t.title,
      startsAt,
      endsAt,
      status: new Date(endsAt).getTime() < now ? "completed" : "upcoming",
      team: t.jkt48_member_type ?? "JKT48",
      lineup: (t.lineup ?? []).map((l) => byJkt48Id.get(String(l.id))?.slug ?? find(l.url_key)?.slug).filter((s): s is string => !!s),
      posterUrl: t.poster || undefined,
      bannerUrl: t.banner || undefined,
      birthdayShow: !!t.is_birthday_show,
    };
  });

  const generations: Generation[] = [
    ...[...new Set(members.map((m) => m.generation).filter((g): g is number => g !== null))].sort((a, b) => a - b).map((n) => ({ number: n, label: `Generation ${n}` })),
    ...(members.some((m) => m.generation === null) ? [{ number: 0, label: "Not listed" }] : []),
  ];

  return {
    now,
    members,
    generations,
    streams: [...live, ...recent, ...detail].sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
    shows,
    news: raw.news.map((n) => ({ slug: n.slug, title: n.title, category: n.category, publishedAt: n.date, url: n.url })),
  };
}
