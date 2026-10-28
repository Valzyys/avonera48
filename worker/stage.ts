/**
 * The theater shows sold in the dashboard, from the IDN Plus listing.
 *
 * Only what the dashboard shows is passed on. The listing's own playback URL
 * and room id are dropped here: the shows are sold, so the browser must never
 * get a way to the picture other than the paid room.
 */

export interface StageShow {
  slug: string;
  /** The theater's show code, when the listing has one. */
  code: string | null;
  /** Title without the trailing " - YYYY/MM/DD". */
  title: string;
  startsAt: string;
  endsAt: string;
  status: "live" | "scheduled" | "ended";
  /** An admin switched the room live (true) ahead of the listing; absent when the listing decides. */
  forced?: boolean;
  image: string | null;
  /** Free text from the listing, without the "Show start / Team / Birthday" lines. */
  description: string;
  viewers: number;
  /** Upper-case team name (PASSION, LOVE, …) when the listing says. */
  team: string | null;
  /** Member(s) celebrating a birthday at this show. */
  birthday: string | null;
  /** Wide banner and poster from the theater schedule (/api/v1/theater), via /media. */
  banner: string | null;
  poster: string | null;
}

export interface RawStage {
  slug?: string;
  title?: string;
  image_url?: string | null;
  status?: string;
  end_at?: number;
  scheduled_at?: number;
  view_count?: number;
  idnliveplus?: { description?: string | null } | null;
  showId?: string | null;
}

/** How long a show runs when the listing gives no end. */
const SHOW_MS = 3 * 3600_000;
/** The listing opens the room 15 minutes before the curtain. */
const DOORS_MS = 15 * 60_000;

export function parseStage(raw: RawStage, now = Date.now()): StageShow | null {
  if (!raw?.slug || !raw.title) return null;
  const dated = /^(.*?)\s*-\s*(\d{4})\/(\d{2})\/(\d{2})\s*$/.exec(raw.title);
  const title = (dated ? dated[1] : raw.title).trim();
  const text = raw.idnliveplus?.description ?? "";
  const line = (label: string) => new RegExp(`^\\s*${label}\\s*:\\s*(.+?)\\s*$`, "im").exec(text)?.[1] ?? null;

  const clock = /(\d{1,2})[.:](\d{2})/.exec(line("Show start") ?? "");
  let start = NaN;
  if (dated && clock) start = Date.parse(`${dated[2]}-${dated[3]}-${dated[4]}T${clock[1].padStart(2, "0")}:${clock[2]}:00+07:00`);
  if (Number.isNaN(start) && raw.scheduled_at) start = raw.scheduled_at * 1000 + DOORS_MS;
  if (Number.isNaN(start)) return null;

  const end = raw.end_at ? raw.end_at * 1000 : start + SHOW_MS;
  const status = raw.status === "live" ? "live" : raw.end_at || raw.status === "ended" || end < now ? "ended" : "scheduled";
  const team = line("Team");

  return {
    slug: raw.slug,
    code: raw.showId || null,
    title,
    startsAt: new Date(start).toISOString(),
    endsAt: new Date(end).toISOString(),
    status,
    image: raw.image_url || null,
    description: text
      .split("\n")
      .filter((l) => !/^\s*(show start|team|birthday)\s*:/i.test(l))
      .join("\n")
      .trim(),
    viewers: Math.max(0, raw.view_count ?? 0),
    team: team ? team.toUpperCase() : null,
    birthday: line("Birthday"),
    banner: null,
    poster: null,
  };
}

/** A row of the theater schedule (/api/v1/theater). */
export interface TheaterRow {
  date?: string;
  title?: string;
  start_time?: string;
  banner?: string | null;
  poster?: string | null;
}

/** The data API's image URLs, served through this site's /media proxy. */
const viaMedia = (u: string | null | undefined) => (u ? u.replace(/^https?:\/\/(?:www\.)?jkt48connect\.com\/((?:api\/)?img\/)/i, "/media/$1") : null);
const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "");
const wib = (iso: string) => new Date(Date.parse(iso) + 7 * 3600_000).toISOString();

/**
 * Gives each show the schedule's banner and poster: the schedule row on the
 * same day at the same start time, else the same title on the same day.
 */
export function withArt(shows: StageShow[], rows: TheaterRow[]): StageShow[] {
  return shows.map((s) => {
    const at = wib(s.startsAt);
    const day = at.slice(0, 10);
    const hm = at.slice(11, 16);
    const sameDay = rows.filter((r) => r.date === day);
    const row = sameDay.find((r) => r.start_time?.slice(0, 5) === hm) ?? sameDay.find((r) => r.title && norm(r.title) === norm(s.title));
    return row ? { ...s, banner: viaMedia(row.banner), poster: viaMedia(row.poster) } : s;
  });
}

export function parseStageList(data: unknown, now = Date.now()): StageShow[] {
  const rows = (data as { data?: RawStage[] } | null)?.data;
  if (!Array.isArray(rows)) return [];
  return rows
    .map((r) => parseStage(r, now))
    .filter((s): s is StageShow => !!s)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}
