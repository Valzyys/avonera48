import * as mock from "@/data/mock";
import type { LiveStream, Member, TheaterShow } from "@/types";
import type { DataService, LiveItem, LiveQuery, ShowSummary } from "./types";

/** Short fixed latency so loading states are visible but brief. */
function respond<T>(value: T, ms = 240): Promise<T> {
  if (shouldSimulateError()) {
    return new Promise((_, reject) => setTimeout(() => reject(new Error("The preview data source returned an error (simulated).")), ms));
  }
  return new Promise((resolve) => setTimeout(() => resolve(structuredClone(value)), ms));
}

/** `?simulate=error` or `?simulate=empty` in the URL — for checking error / empty states. */
function simulate() {
  return typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("simulate");
}
const shouldSimulateError = () => simulate() === "error";
const empty = () => simulate() === "empty";

const memberBySlug = new Map(mock.members.map((m) => [m.slug, m]));
const getMember = (slug: string): Member => {
  const m = memberBySlug.get(slug);
  if (!m) throw new Error(`Preview data references unknown member “${slug}”`);
  return m;
};

const toLive = (s: LiveStream): LiveItem => ({ ...s, member: getMember(s.memberSlug) });
const matches = (s: LiveStream, q: LiveQuery) => (!q.platform || s.platform === q.platform) && (!q.memberSlug || s.memberSlug === q.memberSlug);

const toSummary = (show: TheaterShow): ShowSummary => {
  const center = show.lineup.find((l) => l.role === "center");
  return { ...show, center: center ? getMember(center.memberSlug) : null, lineupMembers: show.lineup.map((l) => getMember(l.memberSlug)) };
};

function birthdays(withinDays: number) {
  const today = new Date(mock.DEMO_TODAY_START_MS + 7 * 3600e3);
  const y = today.getUTCFullYear();
  const todayUtc = Date.UTC(y, today.getUTCMonth(), today.getUTCDate());
  return mock.members
    .filter((m) => m.status !== "graduated")
    .map((member) => {
      const [, mm, dd] = member.birthday.split("-").map(Number);
      let next = Date.UTC(y, mm - 1, dd);
      if (next < todayUtc) next = Date.UTC(y + 1, mm - 1, dd);
      return { member, date: new Date(next).toISOString().slice(0, 10), inDays: Math.round((next - todayUtc) / mock.DAY_MS) };
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

export const mockService: DataService = {
  mode: "preview",
  now: mock.DEMO_NOW,

  listGenerations: () => respond(mock.generations, 80),

  listMembers(query = {}) {
    const q = query.search?.trim().toLowerCase();
    const items = mock.members
      .filter(
        (m) =>
          (!q || m.name.toLowerCase().includes(q) || m.nickname.toLowerCase().includes(q)) &&
          (query.generation === undefined || m.generation === query.generation) &&
          (!query.status || m.status === query.status),
      )
      .sort((a, b) => (query.sort === "generation" ? a.generation - b.generation || a.name.localeCompare(b.name) : a.name.localeCompare(b.name)));
    return respond(empty() ? [] : remember(seenMembers, items, (m) => m.slug));
  },

  peekMember: (slug) => seenMembers.get(slug),
  peekShow: (slug) => seenShows.get(slug),

  getMember(slug) {
    const member = memberBySlug.get(slug);
    if (!member) return respond(null);
    const lives = mock.liveStreams.filter((s) => s.memberSlug === slug);
    return respond({
      member,
      isLive: lives.find((s) => s.status === "live") ? toLive(lives.find((s) => s.status === "live")!) : null,
      recentLives: lives.filter((s) => s.status === "ended").sort((a, b) => b.startedAt.localeCompare(a.startedAt)).map(toLive),
      shows: mock.shows.filter((s) => s.lineup.some((l) => l.memberSlug === slug)).sort((a, b) => b.startsAt.localeCompare(a.startsAt)).map(toSummary),
      news: mock.news.filter((n) => n.relatedMemberSlugs.includes(slug)),
    });
  },

  listLiveNow(query = {}) {
    const items = mock.liveStreams.filter((s) => s.status === "live" && matches(s, query)).sort((a, b) => (b.viewers ?? 0) - (a.viewers ?? 0));
    return respond(empty() ? [] : items.map(toLive));
  },

  listTopStreams(days, limit) {
    const from = mock.DEMO_NOW_MS - days * mock.DAY_MS;
    const items = mock.liveStreams
      .filter((s) => s.status === "ended" && new Date(s.startedAt).getTime() >= from)
      .sort((a, b) => (b.viewers ?? 0) - (a.viewers ?? 0))
      .slice(0, limit);
    return respond(empty() ? [] : items.map(toLive));
  },

  listBirthdays(withinDays) {
    return respond(empty() ? [] : birthdays(withinDays));
  },

  getOverview() {
    const weekEnd = mock.DEMO_NOW_MS + 7 * mock.DAY_MS;
    return respond({
      liveNow: mock.liveStreams.filter((s) => s.status === "live").length,
      showsThisWeek: mock.shows.filter((s) => {
        const t = new Date(s.startsAt).getTime();
        return s.status === "upcoming" && t >= mock.DEMO_NOW_MS && t <= weekEnd;
      }).length,
      streamsToday: mock.liveStreams.filter((s) => new Date(s.startedAt).getTime() >= mock.DEMO_TODAY_START_MS).length,
      birthdaysThisMonth: birthdays(31).filter((b) => b.date.slice(5, 7) === new Date(mock.DEMO_NOW_MS + 7 * 3600e3).toISOString().slice(5, 7)).length,
    });
  },

  listRecentLives(query = {}) {
    const items = mock.liveStreams.filter((s) => s.status === "ended" && matches(s, query)).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    return respond(empty() ? [] : items.map(toLive));
  },

  listShows(status) {
    const items = mock.shows.filter((s) => !status || s.status === status).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    return respond(empty() ? [] : remember(seenShows, items.map(toSummary), (x) => x.slug));
  },

  getShow(slug) {
    const show = mock.shows.find((s) => s.slug === slug);
    if (!show) return respond(null);
    return respond({ ...toSummary(show), lineupDetail: show.lineup.map((l) => ({ member: getMember(l.memberSlug), role: l.role, unitSong: l.unitSong })) });
  },

  listNews(category) {
    const items = mock.news.filter((n) => !category || n.category === category).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
    return respond(empty() ? [] : items);
  },

  getNews(slug) {
    const article = mock.news.find((n) => n.slug === slug);
    if (!article) return respond(null);
    return respond({
      article,
      related: article.relatedMemberSlugs.map(getMember),
      more: mock.news.filter((n) => n.slug !== slug).slice(0, 3),
    });
  },
};
