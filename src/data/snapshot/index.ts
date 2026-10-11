/**
 * Snapshot adapter: turns the sample jkt48connect.com API responses into the
 * site's domain models. Only the snapshot service imports from here — UI
 * components go through `@/services`.
 */
import type { Generation, LiveStream, Member, NewsArticle, TheaterShow } from "@/types";
import { asTeam, teamColor } from "@/utils/team";
import { birthdayResponse } from "./birthday";
import { membersResponse } from "./members";
import { newsResponse } from "./news";
import { recentDetailResponse, recentResponse } from "./recent";
import { theaterResponse } from "./theater";
import type { ApiMember } from "./types";

/**
 * The instant the snapshot is replayed at (WIB). Streams in the /recent
 * response that were running at this moment are shown as live; everything
 * else is relative to it, so every load looks the same.
 */
export const DEMO_NOW = "2026-10-10T23:20:00+07:00";
export const DEMO_NOW_MS = new Date(DEMO_NOW).getTime();
export const DAY_MS = 86_400_000;
const WIB_MS = 7 * 3_600_000;
/** Midnight (WIB) of the demo day, as epoch ms. */
export const DEMO_TODAY_START_MS = Math.floor((DEMO_NOW_MS + WIB_MS) / DAY_MS) * DAY_MS - WIB_MS;

const birthdayFor = (m: ApiMember) => {
  const nick = m.nicknames[0]?.toLowerCase();
  const hit = birthdayResponse.find((b) => b.url_key === m.url_key || b.url_key === nick || m.url_key.startsWith(`${b.url_key}-`));
  return hit?.birthdate.slice(0, 10);
};

export const members: Member[] = membersResponse.map((m) => {
  const team = asTeam(m.team);
  const gen = /^gen(\d+)/.exec(m.generation)?.[1];
  return {
    slug: m.url_key,
    name: m.name,
    nickname: m.nicknames[0] ?? m.name.split(" ")[0],
    generation: gen ? Number(gen) : null,
    team,
    status: m.is_graduate ? "graduated" : team === "TRAINEE" ? "trainee" : "active",
    photoUrl: m.img || undefined,
    color: teamColor(team),
    jkt48Id: m.jkt48_id,
    showroomRoomId: m.room_id || undefined,
    idnUsername: m.idn_username || undefined,
    socials: m.socials,
    birthday: birthdayFor(m),
  };
});

const bySlug = new Map(members.map((m) => [m.slug, m]));
const byJkt48Id = new Map(members.map((m) => [m.jkt48Id, m]));
/** Resolve the `member.url` / `name` used by the live endpoints to a member. */
export function findMember(key: string): Member | undefined {
  const k = key.toLowerCase().replace(/\s*jkt48$/, "");
  return bySlug.get(k) ?? members.find((m) => m.nickname.toLowerCase() === k || m.slug.startsWith(`${k}-`));
}

export const generations: Generation[] = [
  ...[...new Set(members.map((m) => m.generation).filter((g): g is number => g !== null))].sort((a, b) => a - b).map((n) => ({ number: n, label: `Generation ${n}` })),
  ...(members.some((m) => m.generation === null) ? [{ number: 0, label: "Not listed" }] : []),
];

/* ---------------------------------------------------------------- streams */

const recentStreams: LiveStream[] = recentResponse.flatMap((r) => {
  const member = findMember(r.member.url) ?? findMember(r.member.name);
  if (!member) return [];
  const start = new Date(r.live_info.date.start).getTime();
  const end = new Date(r.live_info.date.end).getTime();
  if (start > DEMO_NOW_MS) return [];
  const live = end > DEMO_NOW_MS;
  return [
    {
      id: r._id,
      memberSlug: member.slug,
      platform: r.type === "idn" ? "IDN Live" : "SHOWROOM",
      title: r.idn.title.trim(),
      status: live ? "live" : "ended",
      startedAt: r.live_info.date.start,
      endedAt: live ? undefined : r.live_info.date.end,
      viewers: r.live_info.viewers.num,
      url: null,
      replayUrl: null,
      thumbnailUrl: r.idn.image || r.member.img,
      giftTotal: r.total_gift,
    } satisfies LiveStream,
  ];
});

const detailStreams: LiveStream[] = recentDetailResponse.flatMap((d) => {
  const member = findMember(d.name);
  if (!member || d.end_time > DEMO_NOW_MS) return [];
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

export const streams: LiveStream[] = [...recentStreams, ...detailStreams].sort((a, b) => b.startedAt.localeCompare(a.startedAt));

/* ---------------------------------------------------------------- theater */

export const shows: TheaterShow[] = theaterResponse.map((t) => {
  const startsAt = `${t.date}T${t.start_time}:00+07:00`;
  const endsAt = `${t.date}T${t.end_time}:00+07:00`;
  return {
    slug: t.reference_code.toLowerCase(),
    code: t.reference_code,
    title: t.title,
    startsAt,
    endsAt,
    status: new Date(endsAt).getTime() < DEMO_NOW_MS ? "completed" : "upcoming",
    team: t.jkt48_member_type,
    lineup: t.lineup.map((l) => byJkt48Id.get(l.id)?.slug).filter((s): s is string => !!s),
    posterUrl: t.poster || undefined,
    bannerUrl: t.banner || undefined,
    birthdayShow: t.is_birthday_show,
  };
});

/* ---------------------------------------------------------------- news */

export const news: NewsArticle[] = newsResponse.map((n) => ({ slug: n.slug, title: n.title, category: n.category, publishedAt: n.date, url: n.url }));

/** Members whose full name appears in a headline. */
export const membersInTitle = (title: string) => members.filter((m) => title.toLowerCase().includes(m.name.toLowerCase()));
