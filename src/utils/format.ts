const TZ = "Asia/Jakarta";

export const nf = new Intl.NumberFormat("en-US");
export const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

export function formatNumber(n: number) {
  return nf.format(n);
}

export function formatPercent(part: number, total: number, digits = 1) {
  if (total === 0) return "0%";
  return `${((part / total) * 100).toFixed(digits)}%`;
}

export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = {}) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: TZ, ...opts }).format(new Date(iso));
}

export function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: TZ,
  }).format(new Date(iso));
}

export function formatTime(iso: string) {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ }).format(new Date(iso));
}

export function formatWeekday(iso: string) {
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: TZ }).format(new Date(iso));
}

/** Relative time against a fixed reference so preview data never drifts. */
export function formatRelative(iso: string, reference: string) {
  const diff = (new Date(reference).getTime() - new Date(iso).getTime()) / 1000;
  const abs = Math.abs(diff);
  const units: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, "second"],
    [3600, "minute"],
    [86400, "hour"],
    [604800, "day"],
    [2629800, "week"],
    [31557600, "month"],
  ];
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  let divisor = 1;
  let unit: Intl.RelativeTimeFormatUnit = "second";
  for (const [limit, u] of units) {
    unit = u;
    if (abs < limit) break;
    divisor = limit;
  }
  if (abs >= 31557600) {
    unit = "year";
    divisor = 31557600;
  }
  return rtf.format(-Math.round(diff / divisor), unit);
}

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export function formatDuration(startIso: string, endIso: string) {
  const mins = Math.max(0, Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

export function formatLongDate(iso: string) {
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" }).format(new Date(iso));
}
