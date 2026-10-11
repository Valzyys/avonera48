import { useMemo } from "react";
import { useSearchParams } from "react-router";
import { ShowRow } from "@/components/domain/Cards";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button, EmptyState, ErrorState, Field, Input, PreviewTag, SkeletonRows, Tabs } from "@/components/ui";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useResource } from "@/hooks/useResource";
import { api } from "@/services";
import { formatLongDate } from "@/utils/format";

type Filter = "upcoming" | "completed" | "all";
const dayKey = (iso: string) => new Date(new Date(iso).getTime() + 7 * 3600e3).toISOString().slice(0, 10);

export default function TheaterPage() {
  useDocumentTitle("Theater schedule");
  const [params, setParams] = useSearchParams();
  const filter = (["upcoming", "completed", "all"].includes(params.get("status") ?? "") ? params.get("status") : "upcoming") as Filter;
  const q = params.get("q") ?? "";
  const res = useResource(() => api.listShows(), []);

  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (!v) next.delete(k);
    else next.set(k, v);
    setParams(next, { replace: true });
  };

  const counts = useMemo(() => {
    const all = res.data ?? [];
    return { upcoming: all.filter((s) => s.status !== "completed").length, completed: all.filter((s) => s.status === "completed").length, all: all.length };
  }, [res.data]);

  const shows = (res.data ?? [])
    .filter((s) => (filter === "all" ? true : filter === "completed" ? s.status === "completed" : s.status !== "completed"))
    .filter((s) => {
      const t = q.trim().toLowerCase();
      return !t || s.title.toLowerCase().includes(t) || s.lineupMembers.some((m) => m.name.toLowerCase().includes(t) || m.nickname.toLowerCase().includes(t));
    });
  if (filter === "completed") shows.reverse();

  const groups = new Map<string, typeof shows>();
  for (const s of shows) groups.set(dayKey(s.startsAt), [...(groups.get(dayKey(s.startsAt)) ?? []), s]);

  return (
    <div className="page">
      <PageHeader title="Theater" lead="Upcoming and past shows with lineups. Times in WIB (UTC+7)." aside={<PreviewTag>Sample schedule — not official</PreviewTag>} />
      <div className="container page-body">
        <div className="toolbar">
          <Tabs
            segmented
            label="Show filter"
            value={filter}
            onChange={(f) => set("status", f === "upcoming" ? "" : f)}
            items={[
              { id: "upcoming", label: "Upcoming", count: res.data ? counts.upcoming : undefined },
              { id: "completed", label: "Past", count: res.data ? counts.completed : undefined },
              { id: "all", label: "All", count: res.data ? counts.all : undefined },
            ]}
          />
          <Field label="Search shows" hideLabel className="toolbar__search">
            {({ id }) => <Input id={id} icon="search" type="search" placeholder="Setlist or member" value={q} onChange={(e) => set("q", e.target.value)} />}
          </Field>
        </div>

        {res.status === "error" ? (
          <ErrorState error={res.error} onRetry={res.reload} />
        ) : !res.data ? (
          <SkeletonRows rows={8} label="Loading schedule" />
        ) : shows.length === 0 ? (
          <EmptyState icon="ticket" title={q ? `No shows match “${q}”` : "No shows here"} action={q ? <Button size="sm" variant="secondary" onClick={() => set("q", "")}>Clear search</Button> : undefined} />
        ) : (
          [...groups.entries()].map(([day, list]) => (
            <section key={`${day}-${filter}-${q}`} className="day-group" aria-labelledby={`t-${day}`}>
              <h2 id={`t-${day}`} className="day-group__title">
                {formatLongDate(`${day}T12:00:00+07:00`)}
                <span className="meta">
                  {list.length} {list.length === 1 ? "show" : "shows"}
                </span>
              </h2>
              <ul className="show-list">
                {list.map((s, k) => (
                  <ShowRow key={s.slug} show={s} index={k} />
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
