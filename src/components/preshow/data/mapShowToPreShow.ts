import type { DashShow } from "@/features/members/stage";
import { teamLabel } from "@/utils/team";
import type { PreShowData } from "./types";

const text = (v: string | null | undefined) => {
  const t = v?.replace(/\s+/g, " ").trim();
  return t ? t : undefined;
};

/** An ISO string (with zone) → Date; a zone-less "YYYY-MM-DD HH:mm" is read as WIB. */
export function parseStart(v: string | null | undefined): Date | undefined {
  const s = text(v);
  if (!s) return undefined;
  const zoned = /([zZ]|[+-]\d\d:?\d\d)$/.test(s);
  const d = new Date(zoned ? s : `${s.replace(" ", "T")}+07:00`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/**
 * The dashboard's show (IDN Plus listing joined with the theater schedule)
 * as pre-show data. Pure: same show in, same data out. Members keep the
 * listing's order.
 */
export function mapShowToPreShow(show: DashShow | null | undefined): PreShowData {
  if (!show) return { members: [] };
  const team = text(show.team);
  return {
    setlist: text(show.title),
    // "JKT48" is the default when the listing names no team: not worth a line.
    team: team && team.toUpperCase() !== "JKT48" ? teamLabel(team) : undefined,
    startAt: parseStart(show.startsAt),
    special: text(show.birthday) ? `Birthday show · ${text(show.birthday)}` : show.birthdayShow ? "Birthday show" : undefined,
    members: (show.lineupMembers ?? [])
      .filter((m) => text(m.name) || text(m.nickname))
      .map((m) => ({ name: text(m.name) ?? text(m.nickname)!, nickname: text(m.nickname), photoUrl: text(m.photoUrl) })),
  };
}
