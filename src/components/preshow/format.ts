const day = new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", weekday: "long", day: "numeric", month: "long", year: "numeric" });
const time = new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const hour = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", hour: "numeric", hourCycle: "h23" });

/** "Minggu, 18 Oktober 2026" */
export const formatDay = (d: Date) => day.format(d);
/** "19:00 WIB" */
export const formatClock = (d: Date) => `${time.format(d).replace(".", ":")} WIB`;
/** Hour of day in WIB, 0–23. */
export const wibHour = (d: Date) => Number(hour.format(d)) % 24;

const pad = (n: number) => String(n).padStart(2, "0");

/** "2 hari 03:15:20" over a day, "HH:MM:SS" over an hour, else "MM:SS". */
export function formatRemaining(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d} hari ${pad(h)}:${pad(m)}:${pad(sec)}`;
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(sec)}`;
  return `${pad(m)}:${pad(sec)}`;
}

/** The info line: setlist · day · time, skipping what's missing. */
export function infoLine(setlist?: string, startAt?: Date) {
  return [setlist, startAt && formatDay(startAt), startAt && formatClock(startAt)].filter(Boolean) as string[];
}
