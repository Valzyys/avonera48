/**
 * Fixed reference time for the preview environment. Every relative date,
 * chart window and "last used" value is computed against this instant so the
 * UI is identical on every load.
 */
export const DEMO_NOW = "2026-10-10T16:00:00+07:00";
export const DEMO_NOW_MS = new Date(DEMO_NOW).getTime();
export const DAY_MS = 86_400_000;

export function daysAgo(days: number, hour = 12, minute = 0) {
  const d = new Date(DEMO_NOW_MS - days * DAY_MS);
  // Express in Jakarta time (UTC+7) without depending on the host timezone.
  const utc = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hour - 7, minute);
  return new Date(utc).toISOString();
}

export function daysAhead(days: number, hour = 19, minute = 0) {
  return daysAgo(-days, hour, minute);
}

const JKT_OFFSET_MS = 7 * 3_600_000;

/** Midnight (Asia/Jakarta) of the demo "today", as epoch ms. */
export const DEMO_TODAY_START_MS = Math.floor((DEMO_NOW_MS + JKT_OFFSET_MS) / DAY_MS) * DAY_MS - JKT_OFFSET_MS;

/** YYYY-MM-DD in Asia/Jakarta for an epoch value. */
export function jktDateKey(ms: number) {
  return new Date(ms + JKT_OFFSET_MS).toISOString().slice(0, 10);
}
