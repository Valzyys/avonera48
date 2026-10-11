/**
 * Domain models for the Avonera48 fan site. The preview (mock) adapter and
 * any future real data source both return these shapes.
 */

export type ISODate = string;

/* ---------------------------------------------------------------- members */

export type MemberStatus = "active" | "trainee" | "graduated";

export interface Member {
  /** Stable id, also used as the URL slug (/members/:slug). */
  slug: string;
  name: string;
  nickname: string;
  generation: number;
  status: MemberStatus;
  /** Official photo URL when a real source provides one. Preview data has none. */
  photoUrl?: string;
  /** Hue for the neutral placeholder tile shown when there is no photo. */
  hue: number;
  /** Optional profile text. Preview records carry placeholder copy, never real biography. */
  bio: string;
  joinedYear: number;
  /** Fictional in preview data. */
  birthday: string; // YYYY-MM-DD
  tags: string[];
}

export interface Generation {
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
  /** Viewer count reported by the platform, if any. */
  viewers?: number;
  /** Link to the stream on its platform. Null in preview data. */
  url: string | null;
  /** Replay link, only when the platform actually provides one. */
  replayUrl: string | null;
  thumbnailUrl?: string;
}

/* ---------------------------------------------------------------- theater */

export type ShowStatus = "upcoming" | "completed" | "cancelled";

export interface LineupEntry {
  memberSlug: string;
  role?: "center" | "unit";
  unitSong?: string;
}

export interface TheaterShow {
  slug: string;
  title: string;
  /** Setlist / stage name. */
  setlist: string;
  description: string;
  startsAt: ISODate;
  venue: string;
  status: ShowStatus;
  lineup: LineupEntry[];
  /** Poster/artwork URL from a real source. Preview data has none. */
  posterUrl?: string;
  /** Hue for the placeholder tile shown when there is no poster. */
  hue: number;
  note?: string;
}

/* ---------------------------------------------------------------- news */

export type NewsCategory = "Theater" | "Release" | "Event" | "Announcement";

export interface NewsArticle {
  slug: string;
  title: string;
  category: NewsCategory;
  publishedAt: ISODate;
  summary: string;
  body: string[];
  relatedMemberSlugs: string[];
  featured?: boolean;
  imageUrl?: string;
  hue: number;
}
