import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { StreamCard } from "@/components/domain/Cards";
import { StreamDialog } from "@/components/domain/StreamDialog";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button, EmptyState, ErrorState, Field, PreviewTag, Select, Skeleton, Tabs } from "@/components/ui";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useResource } from "@/hooks/useResource";
import { api, type LiveItem } from "@/services";
import type { LivePlatform } from "@/types";
import { formatLongDate } from "@/utils/format";

type PlatformFilter = "all" | LivePlatform;
const dayKey = (iso: string) => new Date(new Date(iso).getTime() + 7 * 3600e3).toISOString().slice(0, 10);

/** Filters live in the URL so shared links and back/forward restore the view. */
export default function RecentLivePage() {
  useDocumentTitle("Recent live");
  const [params, setParams] = useSearchParams();
  const platform = (params.get("platform") as PlatformFilter) || "all";
  const memberSlug = params.get("member") ?? "";
  const [stream, setStream] = useState<LiveItem | null>(null);
  const res = useResource(() => api.listRecentLives(), []);
  const members = useResource(() => api.listMembers({ sort: "name" }), []);

  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (!v || v === "all") next.delete(k);
    else next.set(k, v);
    setParams(next, { replace: true });
  };

  const items = (res.data ?? []).filter((s) => (platform === "all" || s.platform === platform) && (!memberSlug || s.member.slug === memberSlug));
  const groups = useMemo(() => {
    const map = new Map<string, LiveItem[]>();
    for (const s of items) map.set(dayKey(s.startedAt), [...(map.get(dayKey(s.startedAt)) ?? []), s]);
    return [...map.entries()];
  }, [items]);

  return (
    <div className="page">
      <PageHeader label="Archive" title="Recent live" lead="Finished streams, newest first. Replays are linked only when the platform provides one." aside={<PreviewTag>Sample data</PreviewTag>} />
      <div className="container page-body">
        <div className="toolbar">
          <Tabs
            segmented
            label="Platform"
            value={platform}
            onChange={(p) => set("platform", p)}
            items={(["all", "IDN Live", "SHOWROOM"] as PlatformFilter[]).map((p) => ({ id: p, label: p === "all" ? "All" : p }))}
          />
          <Field label="Member" hideLabel>
            {({ id }) => (
              <Select id={id} aria-label="Filter by member" value={memberSlug} onChange={(e) => set("member", e.target.value)}>
                <option value="">All members</option>
                {members.data?.map((m) => (
                  <option key={m.slug} value={m.slug}>
                    {m.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        {res.status === "error" ? (
          <ErrorState error={res.error} onRetry={res.reload} />
        ) : !res.data ? (
          <div className="stream-grid">
            {Array.from({ length: 6 }, (_, k) => (
              <Skeleton key={k} height={230} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState icon="history" title="No streams match" action={<Button size="sm" variant="secondary" onClick={() => setParams(new URLSearchParams())}>Clear filters</Button>}>
            Try another platform or member.
          </EmptyState>
        ) : (
          groups.map(([day, list]) => (
            <section key={`${day}-${platform}-${memberSlug}`} className="day-group" aria-labelledby={`d-${day}`}>
              <h2 id={`d-${day}`} className="day-group__title">
                {formatLongDate(`${day}T12:00:00+07:00`)}
                <span className="meta">
                  {list.length} {list.length === 1 ? "stream" : "streams"}
                </span>
              </h2>
              <div className="stream-grid">
                {list.map((s, k) => (
                  <StreamCard key={s.id} item={s} onOpen={setStream} index={k} />
                ))}
              </div>
            </section>
          ))
        )}
      </div>
      <StreamDialog stream={stream} onClose={() => setStream(null)} />
    </div>
  );
}
