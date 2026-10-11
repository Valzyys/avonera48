/*
 * Shapes of the jkt48connect.com API v1 responses, reduced to the fields
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
export interface ApiRecentDetail {
  id: string;
  name: string;
  title: string;
  image: string;
  type: "idn" | "showroom";
  start_time: number;
  end_time: number;
  max_viewers: number;
  comment_count: number;
  gift_count: number;
  total_gold: number;
  total_points: number;
  youtube_url: string | null;
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
}

/** GET /api/v1/birthday → data[] */
export interface ApiBirthday {
  name: string;
  url_key: string;
  img: string;
  birthdate: string;
}
