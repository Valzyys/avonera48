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
  image: string | null;
  /** Free text from the listing, without the "Show start / Team / Birthday" lines. */
  description: string;
  viewers: number;
  /** Upper-case team name (PASSION, LOVE, …) when the listing says. */
  team: string | null;
  /** Member(s) celebrating a birthday at this show. */
  birthday: string | null;
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
  };
}

export function parseStageList(data: unknown, now = Date.now()): StageShow[] {
  const rows = (data as { data?: RawStage[] } | null)?.data;
  if (!Array.isArray(rows)) return [];
  return rows
    .map((r) => parseStage(r, now))
    .filter((s): s is StageShow => !!s)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}
