import type { Generation, LivePlatform, LiveStream, Member, MemberStatus, NewsArticle, NewsCategory, ShowStatus, TheaterShow } from "@/types";

export interface MemberQuery {
  search?: string;
  generation?: number;
  status?: MemberStatus;
  sort?: "name" | "generation";
}

export interface LiveQuery {
  platform?: LivePlatform;
  memberSlug?: string;
}

/** A stream joined with its member record. */
export interface LiveItem extends LiveStream {
  member: Member;
}

export interface ShowSummary extends TheaterShow {
  center: Member | null;
  lineupMembers: Member[];
}

export interface ShowDetail extends ShowSummary {
  lineupDetail: { member: Member; role?: "center" | "unit"; unitSong?: string }[];
}

export interface MemberDetail {
  member: Member;
  recentLives: LiveItem[];
  isLive: LiveItem | null;
  shows: ShowSummary[];
  news: NewsArticle[];
}

export interface Birthday {
  member: Member;
  /** Next occurrence, YYYY-MM-DD. */
  date: string;
  inDays: number;
}

export interface Overview {
  liveNow: number;
  showsThisWeek: number;
  streamsToday: number;
  birthdaysThisMonth: number;
}

export interface NewsDetail {
  article: NewsArticle;
  related: Member[];
  more: NewsArticle[];
}

/**
 * Contract between the UI and its data source. The preview build uses the
 * mock adapter; a real adapter can implement the same interface later
 * without changes to the pages.
 */
export interface DataService {
  readonly mode: "preview" | "live";
  /** The data source's notion of "now" — relative times are computed from it. */
  readonly now: string;

  listGenerations(): Promise<Generation[]>;
  listMembers(query?: MemberQuery): Promise<Member[]>;
  getMember(slug: string): Promise<MemberDetail | null>;

  listLiveNow(query?: LiveQuery): Promise<LiveItem[]>;
  /** Finished streams in the last `days`, most watched first. */
  listTopStreams(days: number, limit: number): Promise<LiveItem[]>;
  listBirthdays(withinDays: number): Promise<Birthday[]>;
  getOverview(): Promise<Overview>;
  listRecentLives(query?: LiveQuery): Promise<LiveItem[]>;

  listShows(status?: ShowStatus): Promise<ShowSummary[]>;
  getShow(slug: string): Promise<ShowDetail | null>;

  listNews(category?: NewsCategory): Promise<NewsArticle[]>;
  getNews(slug: string): Promise<NewsDetail | null>;

  /**
   * Synchronous peeks at records the client has already received (e.g. from
   * a list). Detail pages render these instantly so shared-element route
   * transitions have something to morph into while the full record loads.
   */
  peekMember(slug: string): Member | undefined;
  peekShow(slug: string): ShowSummary | undefined;
}
