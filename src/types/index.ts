/**
 * Domain models for the Avonera48 fan site. The snapshot adapter (sample
 * responses from the jkt48connect.com API) and any future live adapter
 * both return these shapes.
 */

export type ISODate = string;

/* ---------------------------------------------------------------- members */

export type MemberStatus = "active" | "trainee" | "graduated";
export type Team = "LOVE" | "DREAM" | "PASSION" | "TRAINEE" | "JKT48";

export interface Social {
  title: string;
  url: string;
}

export interface Member {
  /** API `url_key`, also the URL slug (/members/:slug). */
  slug: string;
  name: string;
  nickname: string;
  /** Generation number; null when the source does not list one. */
  generation: number | null;
  team: Team;
  status: MemberStatus;
  photoUrl?: string;
  /** Site accent colour, derived from the team. A design choice, not an official colour. */
  color: string;
  jkt48Id: string;
  showroomRoomId?: number;
  idnUsername?: string;
  socials: Social[];
  /** YYYY-MM-DD, when the source has it. */
  birthday?: string;
}

export interface Generation {
  /** 0 = generation not listed by the source. */
  number: number;
  label: string;
}

/* ---------------------------------------------------------------- live */

export type LivePlatform = "IDN Live" | "SHOWROOM";

export interface LiveStream {
  id: string;
  memberSlug: string;
  platform: LivePlatform;
  title: string;
  status: "live" | "ended";
  startedAt: ISODate;
  endedAt?: ISODate;
  /** Viewer count (peak when available). */
  viewers?: number;
  /** HLS playback URL, when the source provides one. */
  url: string | null;
  /** Archive link (e.g. YouTube), only when the source provides one. */
  replayUrl: string | null;
  thumbnailUrl?: string;
  /** Gift total as the source formats it, e.g. "Rp 3.067.500". */
  giftTotal?: string;
  /** Full post-live stats, when /recent/detail has the session. */
  stats?: StreamStats;
}

export interface StreamStats {
  peakViewers: number;
  comments: number;
  gifts: number;
  /** IDN gold (or SHOWROOM paid gifts in gold). */
  gold: number;
  /** SHOWROOM points. */
  points: number;
  giftSummary: { name: string; image?: string; count: number; gold: number; points: number }[];
  topSenders: { name: string; avatar?: string; gold: number; points: number; count: number }[];
}

/* ---------------------------------------------------------------- theater */

export type ShowStatus = "upcoming" | "completed";

export interface TheaterShow {
  /** Reference code from the source, lower-case. */
  slug: string;
  code: string;
  title: string;
  startsAt: ISODate;
  endsAt: ISODate;
  status: ShowStatus;
  /** Team performing, as listed by the source. */
  team: string;
  /** Member slugs; empty when the lineup is not announced. */
  lineup: string[];
  posterUrl?: string;
  bannerUrl?: string;
  birthdayShow: boolean;
}

/* ---------------------------------------------------------------- news */

export interface NewsArticle {
  slug: string;
  title: string;
  category: string;
  publishedAt: ISODate;
  /** The article on the official site. */
  url: string;
  image?: string;
  /** Sanitised HTML body, when the detail endpoint has been read. */
  content?: string;
}
