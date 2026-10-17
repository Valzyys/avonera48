export type PreShowMember = {
  name: string;
  nickname?: string;
  photoUrl?: string;
};

/** What the pre-show shows. Every field may be missing; the scene that needs it then steps aside. */
export type PreShowData = {
  setlist?: string;
  team?: string;
  /** Normalised from the API (an absolute instant); shown in Asia/Jakarta. */
  startAt?: Date;
  venue?: string;
  special?: string;
  members: PreShowMember[];
};

/** Where the stream is, from the show listing. */
export type StreamStatus = "upcoming" | "live" | "ended" | "error";
