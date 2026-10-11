/*
 * Shapes of the upstream API v1 responses, reduced to the fields
 * the site reads. The snapshot files hold real responses in these shapes;
 * a live adapter (through the Worker, with the key kept server-side) can
 * return the same objects later.
 */

export interface ApiSocial {
  title: string;
  url: string;
}

/** GET /api/v1/members → data[] */
export interface ApiMember {
  name: string;
  url_key: string;
  nicknames: string[];
  team: string;
  /** e.g. "gen12-jkt48"; empty when the source has none. */
  generation: string;
  jkt48_id: string;
  room_id: number;
  idn_username: string;
  img: string;
  socials: ApiSocial[];
  is_graduate?: boolean;
}

/** GET /api/v1/live → data[] */
export interface ApiLive {
  name: string;
  url_key: string;
  platform: "showroom" | "idn";
  img: string;
  stream_url: string | null;
  started_at: string;
  title?: string;
}

/** Envelope every endpoint returns. */
export interface ApiEnvelope<T> {
  ok: boolean;
  data: T;
  cached_at?: string;
}

/** GET /api/v1/recent → data[] */
export interface ApiRecent {
  _id: string;
  type: "idn" | "showroom";
  total_gift: string;
  points: number;
  member: { name: string; nickname: string; url: string; img: string };
  idn: { title: string; image: string };
  live_info: { duration: number; viewers: { num: number }; date: { start: string; end: string } };
}

/** GET /api/v1/recent/detail → data.items[] */
export interface ApiGiftSummary {
  name: string;
  image_url?: string;
  icon?: string;
  count: number;
  total_gold?: number;
  gold?: number;
  total_points?: number;
}

export interface ApiTopSender {
  name?: string;
  username?: string;
  avatar?: string | null;
  total_gold?: number;
  gold?: number;
  total_points?: number;
  count?: number;
}

/** GET /api/v1/recent/detail → data.items[]. Times arrive as epoch ms or ISO strings. */
export interface ApiRecentDetail {
  id: string;
  name: string;
  title: string;
  image: string;
  avatar?: string | null;
  type: "idn" | "showroom";
  start_time: number | string;
  end_time: number | string;
  max_viewers: number;
  comment_count: number;
  gift_count: number;
  total_gold: number;
  total_points: number;
  youtube_url: string | null;
  gifts_summary?: ApiGiftSummary[];
  top_senders?: ApiTopSender[];
}

/** GET /api/v1/news/{slug} → data */
export interface ApiNewsDetail {
  id: string;
  title: string;
  category: string;
  url: string;
  date: string;
  slug: string;
  background_image?: string;
  /** HTML body from the official site. */
  content?: string;
}

/** GET /api/v1/theater → data[] */
export interface ApiTheater {
  date: string;
  title: string;
  start_time: string;
  end_time: string;
  reference_code: string;
  poster: string;
  banner: string;
  lineup: { id: string; name: string; url_key: string }[];
  is_birthday_show: boolean;
  jkt48_member_type: string;
}

/** GET /api/v1/news → data[] */
export interface ApiNews {
  id: string;
  url: string;
  date: string;
  slug: string;
  title: string;
  category: string;
  background_image?: string;
}

/** GET /api/v1/birthday → data[] */
export interface ApiBirthday {
  name: string;
  url_key: string;
  img: string;
  birthdate: string;
}
