import { useSearchParams } from "react-router";
import { NewsRow } from "@/components/domain/Cards";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState, ErrorState, PreviewTag, SkeletonRows, Tabs } from "@/components/ui";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useResource } from "@/hooks/useResource";
import { api } from "@/services";
import type { NewsCategory } from "@/types";

type Filter = "all" | NewsCategory;
const CATS: Filter[] = ["all", "Theater", "Release", "Event", "Announcement"];

export default function NewsPage() {
  useDocumentTitle("News");
  const [params, setParams] = useSearchParams();
  const cat = (CATS.includes(params.get("category") as Filter) ? params.get("category") : "all") as Filter;
  const res = useResource(() => api.listNews(cat === "all" ? undefined : cat), [cat]);

  return (
    <div className="page">
      <PageHeader label="Information" title="News" lead="Theater updates, releases, events and announcements." aside={<PreviewTag>Placeholder articles</PreviewTag>} />
      <div className="container page-body">
        <div className="toolbar">
          <Tabs label="Category" value={cat} onChange={(c) => setParams(c === "all" ? {} : { category: c }, { replace: true })} items={CATS.map((c) => ({ id: c, label: c === "all" ? "All" : c }))} />
        </div>
        {res.status === "error" ? (
          <ErrorState error={res.error} onRetry={res.reload} />
        ) : !res.data ? (
          <SkeletonRows rows={6} />
        ) : res.data.length === 0 ? (
          <EmptyState icon="news" title="No articles in this category yet" />
        ) : (
          <ul className={`news-list ${res.status === "loading" ? "is-refreshing" : ""}`} key={cat}>
            {res.data.map((a, k) => (
              <NewsRow key={a.slug} article={a} index={k} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
