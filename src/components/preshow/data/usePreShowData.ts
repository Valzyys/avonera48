import { useMemo, useState } from "react";
import type { DashShow } from "@/features/members/stage";
import { serverNow } from "@/utils/serverClock";
import { mapShowToPreShow } from "./mapShowToPreShow";
import { mockShow } from "./mock";
import type { PreShowData } from "./types";

/**
 * Development / admin overrides from the query string:
 *   ?preshow=1 | standby | outro | hold   force the pre-show (or one of its modes)
 *   &in=90                                 start 90 s from now (final countdown test)
 *   &mock=1 | bare                         mock data (long setlist, 16 members / no setlist or date)
 *   &members=N                             lineup size for the mock (0 hides the lineup)
 *   &seek=S                                start the loop S seconds in (look at one scene)
 */
export interface PreShowOverride {
  force: "standby" | "outro" | "hold" | null;
  inSeconds: number | null;
  mock: string | null;
  members: number | null;
  seek: number | null;
}

export function readOverride(params: URLSearchParams, allowed: boolean): PreShowOverride | null {
  const p = params.get("preshow");
  if (!allowed || !p) return null;
  const num = (k: string) => {
    const v = params.get(k);
    return v != null && /^\d{1,5}$/.test(v) ? Number(v) : null;
  };
  return {
    force: p === "standby" || p === "outro" || p === "hold" ? p : null,
    inSeconds: num("in"),
    mock: params.get("mock"),
    members: num("members"),
    seek: num("seek"),
  };
}

/** The show as pre-show data: the listing's show, or the mock and fake start time an override asks for. */
export function usePreShowData(show: DashShow | null, ov: PreShowOverride | null): PreShowData {
  // A fake start is fixed when the page opens, so the countdown really counts down.
  const [fakeStart] = useState(() => (ov?.inSeconds != null ? new Date(serverNow() + ov.inSeconds * 1000) : undefined));
  return useMemo(() => {
    const base = ov?.mock ? mockShow(ov.mock, ov.members) : mapShowToPreShow(show);
    return fakeStart ? { ...base, startAt: fakeStart } : base;
  }, [show, ov?.mock, ov?.members, fakeStart]);
}
