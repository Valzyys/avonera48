import { buildDataset, type Dataset, type RawData } from "@/data/adapt";
import { SNAPSHOT_NOW, snapshotDataset } from "@/data/snapshot";
import type { ApiEnvelope } from "@/data/snapshot/types";
import type { LiveStream, Member, TheaterShow } from "@/types";
import type { DataService, LiveItem, LiveQuery, ShowSummary } from "./types";

const DAY_MS = 86_400_000;
const WIB_MS = 7 * 3_600_000;

/* ------------------------------------------------------------ source state */

type Mode = "live" | "snapshot";
let mode: Mode = "live";
const listeners = new Set<() => void>();
function setMode(next: Mode) {
  if (next === mode) return;
  mode = next;
  listeners.forEach((l) => l());
}
/** For useSyncExternalStore: which source the UI is currently showing. */
export const dataSource = {
  get: () => mode,
  subscribe: (l: () => void) => (listeners.add(l), () => void listeners.delete(l)),
};

/* `?source=snapshot` forces the bundled snapshot; `?simulate=error|empty` checks states. */
const param = (k: string) => (typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get(k));
const forceSnapshot = () => param("source") === "snapshot";
const simulate = () => param("simulate");

/* ------------------------------------------------------------ fetching */

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  const body = (await res.json()) as ApiEnvelope<T>;
  if (!body.ok) throw new Error(`${path} → not ok`);
  return body.data;
}

/** Slow-changing endpoints are kept for 5 minutes, live ones for 30 seconds. */
const SLOW_TTL = 5 * 60_000;
const FAST_TTL = 30_000;
let slow: { at: number; p: Promise<Pick<RawData, "members" | "birthdays" | "theater" | "news">> } | null = null;
let fast: { at: number; p: Promise<Pick<RawData, "live" | "recent">> } | null = null;

function fetchSlow() {
  if (!slow || Date.now() - slow.at > SLOW_TTL) {
    const p = Promise.all([get<RawData["members"]>("/api/v1/members"), get<RawData["birthdays"]>("/api/v1/birthday"), get<RawData["theater"]>("/api/v1/theater"), get<RawData["news"]>("/api/v1/news")]).then(
      ([members, birthdays, theater, news]) => ({ members, birthdays, theater, news }),
    );
    slow = { at: Date.now(), p };
    p.catch(() => (slow = null));
  }
  return slow.p;
}
function fetchFast() {
  if (!fast || Date.now() - fast.at > FAST_TTL) {
    const p = Promise.all([get<RawData["live"]>("/api/v1/live"), get<RawData["recent"]>("/api/v1/recent")]).then(([live, recent]) => ({ live, recent }));
    fast = { at: Date.now(), p };
    p.catch(() => (fast = null));
  }
  return fast.p;
}

let cached: { key: string; ds: Dataset } | null = null;
let snapshot: Dataset | null = null;
const loadedAt = Date.now();

async function dataset(): Promise<Dataset> {
  if (simulate() === "error") throw new Error("The data source returned an error (simulated).");
  if (!forceSnapshot()) {
    try {
      const [s, f] = await Promise.all([fetchSlow(), fetchFast()]);
      const key = `${slow?.at}:${fast?.at}`;
      if (cached?.key !== key) cached = { key, ds: buildDataset({ ...s, ...f }, Date.now()) };
      setMode("live");
      return { ...cached.ds, now: Date.now() };
    } catch {
      // Not configured or unreachable: fall back to the bundled snapshot.
    }
  }
  snapshot ??= snapshotDataset();
  setMode("snapshot");
  return snapshot;
}

/* ------------------------------------------------------------ queries */

const clone = <T,>(v: T): T => structuredClone(v);
const empty = () => simulate() === "empty";
const byStart = (a: TheaterShow, b: TheaterShow) => a.startsAt.localeCompare(b.startsAt);
const genOrder = (m: Member) => m.generation ?? 999;

function helpers(ds: Dataset) {
  const bySlug = new Map(ds.members.map((m) => [m.slug, m]));
  const member = (slug: string) => bySlug.get(slug)!;
  return {
    bySlug,
    toLive: (s: LiveStream): LiveItem => ({ ...s, member: member(s.memberSlug) }),
    toSummary: (show: TheaterShow): ShowSummary => ({ ...show, lineupMembers: show.lineup.map(member).filter(Boolean) }),
    matches: (s: LiveStream, q: LiveQuery) => (!q.platform || s.platform === q.platform) && (!q.memberSlug || s.memberSlug === q.memberSlug),
  };
}

function birthdays(ds: Dataset, withinDays: number) {
  const today = new Date(ds.now + WIB_MS);
  const y = today.getUTCFullYear();
  const todayUtc = Date.UTC(y, today.getUTCMonth(), today.getUTCDate());
  return ds.members
    .filter((m): m is Member & { birthday: string } => !!m.birthday && m.status !== "graduated")
    .map((member) => {
      const [, mm, dd] = member.birthday.split("-").map(Number);
      let next = Date.UTC(y, mm - 1, dd);
      if (next < todayUtc) next = Date.UTC(y + 1, mm - 1, dd);
      return { member, date: new Date(next).toISOString().slice(0, 10), inDays: Math.round((next - todayUtc) / DAY_MS) };
    })
    .filter((b) => b.inDays <= withinDays)
    .sort((a, b) => a.inDays - b.inDays);
}

// Records already delivered to the UI, for instant detail-page renders.
const seenMembers = new Map<string, Member>();
const seenShows = new Map<string, ShowSummary>();
const remember = <T,>(map: Map<string, T>, items: T[], key: (t: T) => string) => {
  for (const it of items) map.set(key(it), it);
  return items;
};

export const dataService: DataService = {
  get mode() {
    return mode;
  },
  /** Real time when live; the snapshot instant (advancing since load) otherwise. */
  get now() {
    return new Date(mode === "live" ? Date.now() : new Date(SNAPSHOT_NOW).getTime() + (Date.now() - loadedAt)).toISOString();
  },

  listGenerations: async () => clone((await dataset()).generations),

  async listMembers(query = {}) {
    const ds = await dataset();
    const q = query.search?.trim().toLowerCase();
    const items = ds.members
      .filter(
        (m) =>
          (!q || m.name.toLowerCase().includes(q) || m.nickname.toLowerCase().includes(q)) &&
          (query.generation === undefined || (m.generation ?? 0) === query.generation) &&
          (!query.status || m.status === query.status) &&
          (!query.team || m.team === query.team),
      )
      .sort((a, b) => (query.sort === "generation" ? genOrder(a) - genOrder(b) || a.name.localeCompare(b.name) : a.name.localeCompare(b.name)));
    return empty() ? [] : clone(remember(seenMembers, items, (m) => m.slug));
  },

  peekMember: (slug) => seenMembers.get(slug),
  peekShow: (slug) => seenShows.get(slug),

  async getMember(slug) {
    const ds = await dataset();
    const h = helpers(ds);
    const member = h.bySlug.get(slug);
    if (!member) return null;
    const lives = ds.streams.filter((s) => s.memberSlug === slug);
    const live = lives.find((s) => s.status === "live");
    return clone({
      member,
      isLive: live ? h.toLive(live) : null,
      recentLives: lives.filter((s) => s.status === "ended").map(h.toLive),
      shows: ds.shows.filter((s) => s.lineup.includes(slug)).sort(byStart).map(h.toSummary),
      news: ds.news.filter((n) => n.title.toLowerCase().includes(member.name.toLowerCase())),
    });
  },

  async listLiveNow(query = {}) {
    const ds = await dataset();
    const h = helpers(ds);
    const items = ds.streams.filter((s) => s.status === "live" && h.matches(s, query)).sort((a, b) => a.startedAt.localeCompare(b.startedAt));
    return empty() ? [] : clone(items.map(h.toLive));
  },

  async listTopStreams(days, limit) {
    const ds = await dataset();
    const h = helpers(ds);
    const from = ds.now - days * DAY_MS;
    const items = ds.streams
      .filter((s) => s.status === "ended" && new Date(s.startedAt).getTime() >= from)
      .sort((a, b) => (b.viewers ?? 0) - (a.viewers ?? 0))
      .slice(0, limit);
    return empty() ? [] : clone(items.map(h.toLive));
  },

  async listBirthdays(withinDays) {
    const ds = await dataset();
    return empty() ? [] : clone(birthdays(ds, withinDays));
  },

  async getOverview() {
    const ds = await dataset();
    const dayStart = Math.floor((ds.now + WIB_MS) / DAY_MS) * DAY_MS - WIB_MS;
    return {
      liveNow: ds.streams.filter((s) => s.status === "live").length,
      showsThisWeek: ds.shows.filter((s) => {
        const t = new Date(s.startsAt).getTime();
        return s.status === "upcoming" && t >= ds.now && t <= ds.now + 7 * DAY_MS;
      }).length,
      streamsToday: ds.streams.filter((s) => new Date(s.startedAt).getTime() >= dayStart).length,
      birthdaysThisMonth: birthdays(ds, 31).filter((b) => b.date.slice(5, 7) === new Date(ds.now + WIB_MS).toISOString().slice(5, 7)).length,
    };
  },

  async listRecentLives(query = {}) {
    const ds = await dataset();
    const h = helpers(ds);
    const items = ds.streams.filter((s) => s.status === "ended" && h.matches(s, query));
    return empty() ? [] : clone(items.map(h.toLive));
  },

  async listShows(status) {
    const ds = await dataset();
    const h = helpers(ds);
    const items = ds.shows.filter((s) => !status || s.status === status).sort(byStart);
    return empty() ? [] : clone(remember(seenShows, items.map(h.toSummary), (x) => x.slug));
  },

  async getShow(slug) {
    const ds = await dataset();
    const h = helpers(ds);
    const show = ds.shows.find((s) => s.slug === slug);
    if (!show) return null;
    return clone({ ...h.toSummary(show), sameTitle: ds.shows.filter((s) => s.title === show.title && s.slug !== slug).sort(byStart).map(h.toSummary) });
  },

  async listNews(category) {
    const ds = await dataset();
    const items = ds.news.filter((n) => !category || n.category === category).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
    return empty() ? [] : clone(items);
  },

  async getNews(slug) {
    const ds = await dataset();
    const article = ds.news.find((n) => n.slug === slug);
    if (!article) return null;
    const related = ds.members.filter((m) => article.title.toLowerCase().includes(m.name.toLowerCase()));
    return clone({ article, related, more: ds.news.filter((n) => n.slug !== slug).slice(0, 4) });
  },
};
