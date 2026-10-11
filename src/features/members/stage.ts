import type { ShowSummary } from "@/services/types";
import type { StageShow } from "./api";

/** A show on sale in the dashboard: the listing's facts plus the site schedule's lineup. */
export interface DashShow extends ShowSummary {
  /** The listing says it is on air right now. */
  onAir: boolean;
  viewers: number;
  birthday: string | null;
  /** Free text from the listing. */
  blurb: string;
}

/** Two listings name the same performance when they start within this window. */
const SAME_SHOW_MS = 45 * 60_000;

/**
 * Joins the IDN Plus listing (what is sold, and whether it is live) with the
 * site's theater schedule (team, lineup, poster), matched on start time.
 * Shows the listing has ended are left out.
 */
export function toDashShows(stage: StageShow[], schedule: ShowSummary[] = []): DashShow[] {
  return stage
    .filter((s) => s.status !== "ended")
    .map((s) => {
      const at = Date.parse(s.startsAt);
      const match = schedule.find((t) => Math.abs(Date.parse(t.startsAt) - at) <= SAME_SHOW_MS);
      return {
        slug: s.slug,
        code: s.code ?? match?.code ?? "",
        title: s.title,
        startsAt: s.startsAt,
        endsAt: s.endsAt,
        status: "upcoming",
        team: s.team ?? match?.team ?? "JKT48",
        lineup: match?.lineup ?? [],
        lineupMembers: match?.lineupMembers ?? [],
        posterUrl: s.image ?? match?.posterUrl,
        bannerUrl: match?.bannerUrl ?? s.image ?? undefined,
        birthdayShow: !!s.birthday || !!match?.birthdayShow,
        onAir: s.status === "live",
        viewers: s.viewers,
        birthday: s.birthday,
        blurb: s.description,
      };
    });
}
