import * as snap from "@/data/snapshot";
import type { LiveStream, Member, TheaterShow } from "@/types";
import type { DataService, LiveItem, LiveQuery, ShowSummary } from "./types";

/** Short fixed latency so loading states are visible but brief. */
function respond<T>(value: T, ms = 240): Promise<T> {
  if (shouldSimulateError()) {
    return new Promise((_, reject) => setTimeout(() => reject(new Error("The sample data source returned an error (simulated).")), ms));
  }
  return new Promise((resolve) => setTimeout(() => resolve(structuredClone(value)), ms));
}

/** `?simulate=error` or `?simulate=empty` in the URL — for checking error / empty states. */
function simulate() {
  return typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("simulate");
}
const shouldSimulateError = () => simulate() === "error";
const empty = () => simulate() === "empty";

const memberBySlug = new Map(snap.members.map((m) => [m.slug, m]));
const getMember = (slug: string): Member => {
  const m = memberBySlug.get(slug);
  if (!m) throw new Error(`Snapshot references unknown member “${slug}”`);
  return m;
};

const toLive = (s: LiveStream): LiveItem => ({ ...s, member: getMember(s.memberSlug) });
const matches = (s: LiveStream, q: LiveQuery) => (!q.platform || s.platform === q.platform) && (!q.memberSlug || s.memberSlug === q.memberSlug);
const toSummary = (show: TheaterShow): ShowSummary => ({ ...show, lineupMembers: show.lineup.map(getMember) });
const byStart = (a: TheaterShow, b: TheaterShow) => a.startsAt.localeCompare(b.startsAt);

function birthdays(withinDays: number) {
  const today = new Date(snap.DEMO_TODAY_START_MS + 7 * 3600e3);
  const y = today.getUTCFullYear();
  const todayUtc = Date.UTC(y, today.getUTCMonth(), today.getUTCDate());
  return snap.members
    .filter((m): m is Member & { birthday: string } => !!m.birthday && m.status !== "graduated")
    .map((member) => {
      const [, mm, dd] = member.birthday.split("-").map(Number);
      let next = Date.UTC(y, mm - 1, dd);
      if (next < todayUtc) next = Date.UTC(y + 1, mm - 1, dd);
      return { member, date: new Date(next).toISOString().slice(0, 10), inDays: Math.round((next - todayUtc) / snap.DAY_MS) };
    })
    .filter((b) => b.inDays <= withinDays)
    .sort((a, b) => a.inDays - b.inDays);
}

// Client-side cache of records already delivered to the UI.
const seenMembers = new Map<string, Member>();
const seenShows = new Map<string, ShowSummary>();
const remember = <T,>(map: Map<string, T>, items: T[], key: (t: T) => string) => {
  for (const it of items) map.set(key(it), it);
  return items;
};

const genOrder = (m: Member) => m.generation ?? 999;

export const snapshotService: DataService = {
  mode: "snapshot",
  now: snap.DEMO_NOW,

  listGenerations: () => respond(snap.generations, 80),

  listMembers(query = {}) {
    const q = query.search?.trim().toLowerCase();
    const items = snap.members
      .filter(
        (m) =>
          (!q || m.name.toLowerCase().includes(q) || m.nickname.toLowerCase().includes(q)) &&
          (query.generation === undefined || (m.generation ?? 0) === query.generation) &&
          (!query.status || m.status === query.status) &&
          (!query.team || m.team === query.team),
      )
      .sort((a, b) => (query.sort === "generation" ? genOrder(a) - genOrder(b) || a.name.localeCompare(b.name) : a.name.localeCompare(b.name)));
    return respond(empty() ? [] : remember(seenMembers, items, (m) => m.slug));
  },

  peekMember: (slug) => seenMembers.get(slug) ?? memberBySlug.get(slug),
  peekShow: (slug) => seenShows.get(slug),

  getMember(slug) {
    const member = memberBySlug.get(slug);
    if (!member) return respond(null);
    const lives = snap.streams.filter((s) => s.memberSlug === slug);
    const live = lives.find((s) => s.status === "live");
    return respond({
      member,
      isLive: live ? toLive(live) : null,
      recentLives: lives.filter((s) => s.status === "ended").map(toLive),
      shows: snap.shows.filter((s) => s.lineup.includes(slug)).sort(byStart).map(toSummary),
      news: snap.news.filter((n) => n.title.toLowerCase().includes(member.name.toLowerCase())),
    });
  },

  listLiveNow(query = {}) {
    const items = snap.streams.filter((s) => s.status === "live" && matches(s, query)).sort((a, b) => (b.viewers ?? 0) - (a.viewers ?? 0));
    return respond(empty() ? [] : items.map(toLive));
  },

  listTopStreams(days, limit) {
    const from = snap.DEMO_NOW_MS - days * snap.DAY_MS;
    const items = snap.streams
      .filter((s) => s.status === "ended" && new Date(s.startedAt).getTime() >= from)
      .sort((a, b) => (b.viewers ?? 0) - (a.viewers ?? 0))
      .slice(0, limit);
    return respond(empty() ? [] : items.map(toLive));
  },

  listBirthdays(withinDays) {
    return respond(empty() ? [] : birthdays(withinDays));
  },

  getOverview() {
    const weekEnd = snap.DEMO_NOW_MS + 7 * snap.DAY_MS;
    return respond({
      liveNow: snap.streams.filter((s) => s.status === "live").length,
      showsThisWeek: snap.shows.filter((s) => {
        const t = new Date(s.startsAt).getTime();
        return s.status === "upcoming" && t >= snap.DEMO_NOW_MS && t <= weekEnd;
      }).length,
      streamsToday: snap.streams.filter((s) => new Date(s.startedAt).getTime() >= snap.DEMO_TODAY_START_MS).length,
      birthdaysThisMonth: birthdays(31).filter((b) => b.date.slice(5, 7) === new Date(snap.DEMO_NOW_MS + 7 * 3600e3).toISOString().slice(5, 7)).length,
    });
  },

  listRecentLives(query = {}) {
    const items = snap.streams.filter((s) => s.status === "ended" && matches(s, query));
    return respond(empty() ? [] : items.map(toLive));
  },

  listShows(status) {
    const items = snap.shows.filter((s) => !status || s.status === status).sort(byStart);
    return respond(empty() ? [] : remember(seenShows, items.map(toSummary), (x) => x.slug));
  },

  getShow(slug) {
    const show = snap.shows.find((s) => s.slug === slug);
    if (!show) return respond(null);
    return respond({ ...toSummary(show), sameTitle: snap.shows.filter((s) => s.title === show.title && s.slug !== slug).sort(byStart).map(toSummary) });
  },

  listNews(category) {
    const items = snap.news.filter((n) => !category || n.category === category).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
    return respond(empty() ? [] : items);
  },

  getNews(slug) {
    const article = snap.news.find((n) => n.slug === slug);
    if (!article) return respond(null);
    return respond({ article, related: snap.membersInTitle(article.title), more: snap.news.filter((n) => n.slug !== slug).slice(0, 4) });
  },
};
