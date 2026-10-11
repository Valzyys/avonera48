/**
 * Bundled snapshot of real jkt48connect.com API responses (10–11 Oct 2026).
 * Used when the live API is not reachable — e.g. the API key secret is not
 * set yet, or during local development without the Worker.
 */
import { buildDataset, type Dataset } from "../adapt";
import { birthdayResponse } from "./birthday";
import { membersResponse } from "./members";
import { newsResponse } from "./news";
import { recentDetailResponse, recentResponse } from "./recent";
import { theaterResponse } from "./theater";

/** The snapshot is replayed at this instant (WIB): streams running then show as live. */
export const SNAPSHOT_NOW = "2026-10-10T23:20:00+07:00";

export function snapshotDataset(now = new Date(SNAPSHOT_NOW).getTime()): Dataset {
  return buildDataset(
    { members: membersResponse, birthdays: birthdayResponse, live: [], recent: recentResponse, recentDetail: recentDetailResponse, theater: theaterResponse, news: newsResponse },
    now,
  );
}
