import { useState } from "react";
import { LiveTile } from "@/components/domain/Cards";
import { StreamDialog } from "@/components/domain/StreamDialog";
import { PageHeader } from "@/components/layout/PageHeader";
import { ButtonLink, EmptyState, ErrorState, Field, Select, Skeleton, Tabs } from "@/components/ui";
import { SourceNote } from "@/components/domain/SourceNote";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useResource } from "@/hooks/useResource";
import { api, type LiveItem } from "@/services";
import type { LivePlatform } from "@/types";

type PlatformFilter = "all" | LivePlatform;
type Sort = "viewers" | "recent" | "name";

export default function LivePage() {
  useDocumentTitle("Live now");
  const [platform, setPlatform] = useState<PlatformFilter>("all");
  const [sort, setSort] = useState<Sort>("viewers");
  const [stream, setStream] = useState<LiveItem | null>(null);
  const res = useResource(() => api.listLiveNow(), []);

  const all = res.data ?? [];
  const items = all
    .filter((s) => platform === "all" || s.platform === platform)
    .sort((a, b) =>
      sort === "viewers" ? (b.viewers ?? 0) - (a.viewers ?? 0) : sort === "recent" ? b.startedAt.localeCompare(a.startedAt) : a.member.name.localeCompare(b.member.name),
    );
  const count = (p: PlatformFilter) => (p === "all" ? all.length : all.filter((s) => s.platform === p).length);

  return (
    <div className="page">
      <PageHeader label="IDN Live · SHOWROOM" title="Live now" lead="Members streaming on IDN Live and SHOWROOM. Tap a stream for details." aside={<SourceNote />} />
      <div className="container page-body">
        <div className="toolbar">
          <Tabs
            segmented
            label="Platform"
            value={platform}
            onChange={setPlatform}
            items={(["all", "IDN Live", "SHOWROOM"] as PlatformFilter[]).map((p) => ({ id: p, label: p === "all" ? "All" : p, count: res.data ? count(p) : undefined }))}
          />
          <Field label="Sort" hideLabel>
            {({ id }) => (
              <Select id={id} aria-label="Sort streams" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                <option value="viewers">Most watched</option>
                <option value="recent">Newest first</option>
                <option value="name">Name A–Z</option>
              </Select>
            )}
          </Field>
        </div>

        {res.status === "error" ? (
          <ErrorState error={res.error} onRetry={res.reload} />
        ) : !res.data ? (
          <div className="live-grid" role="status" aria-label="Loading">
            {[0, 1, 2, 3].map((k) => (
              <Skeleton key={k} height={340} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon="broadcast"
            title={all.length === 0 ? "Nobody is live right now" : `Nobody is live on ${platform}`}
            action={
              all.length === 0 ? (
                <ButtonLink to="/recent-live" size="sm" variant="secondary">
                  See recent streams
                </ButtonLink>
              ) : undefined
            }
          >
            {all.length === 0 ? "Members usually stream in the evening." : "Try another platform."}
          </EmptyState>
        ) : (
          <>
            <p className="sr-only" role="status">
              {items.length} streams
            </p>
            <div className="live-grid" key={`${platform}-${sort}`}>
              {items.map((item, k) => (
                <LiveTile key={item.id} item={item} onOpen={setStream} index={k} />
              ))}
            </div>
          </>
        )}
      </div>
      <StreamDialog stream={stream} onClose={() => setStream(null)} />
    </div>
  );
}
