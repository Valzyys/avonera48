import { Link, useParams } from "react-router";
import { Avatar } from "@/components/media/Media";
import { NewsRow } from "@/components/domain/Cards";
import { ShareButton } from "@/components/domain/ShareButton";
import { Badge, Breadcrumb, ButtonLink, Callout, EmptyState, ErrorState, Skeleton } from "@/components/ui";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useResource } from "@/hooks/useResource";
import { api } from "@/services";
import { formatLongDate } from "@/utils/format";

export default function NewsDetailPage() {
  const { slug = "" } = useParams();
  const res = useResource(() => api.getNews(slug), [slug]);
  const d = res.data;
  useDocumentTitle(d ? d.article.title : "News");

  if (res.status === "error") return <div className="container page-body"><ErrorState error={res.error} onRetry={res.reload} /></div>;
  if (res.status === "success" && !d)
    return (
      <div className="container page-body">
        <EmptyState icon="news" title="Article not found" action={<ButtonLink to="/news" size="sm" variant="secondary">Back to news</ButtonLink>} />
      </div>
    );

  return (
    <div className="page">
      <div className="container page-body">
        <div className="detail-top">
          <Breadcrumb items={[{ label: "News", to: "/news" }, { label: d?.article.category ?? "…" }]} />
        </div>
        <article className="article">
          {!d ? (
            <>
              <Skeleton height={20} width={220} />
              <Skeleton height={80} />
              <Skeleton height={200} />
            </>
          ) : (
            <>
              <div className="article__meta enter">
                <Link to={`/news?category=${d.article.category}`} viewTransition>
                  <Badge>{d.article.category}</Badge>
                </Link>
                <time className="meta" dateTime={d.article.publishedAt}>
                  {formatLongDate(d.article.publishedAt)}
                </time>
              </div>
              <h1 className="h-page enter" style={{ ["--i" as string]: 1 }}>
                {d.article.title}
              </h1>
              <p className="lead article__summary enter" style={{ ["--i" as string]: 2 }}>
                {d.article.summary}
              </p>
              <div className="article__body prose enter" style={{ ["--i" as string]: 3 }}>
                <Callout title="Placeholder article">This is preview content. It is not an official JKT48 announcement.</Callout>
                {d.article.body.map((p, k) => (
                  <p key={k}>{p}</p>
                ))}
              </div>
              {d.related.length > 0 && (
                <section className="article__related" aria-labelledby="related-t">
                  <h2 id="related-t" className="meta">
                    Members in this article
                  </h2>
                  <ul className="related-members">
                    {d.related.map((m) => (
                      <li key={m.slug}>
                        <Link to={`/members/${m.slug}`} viewTransition>
                          <Avatar member={m} size={28} />
                          {m.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              <div className="actions-row" style={{ marginTop: 24 }}>
                <ShareButton />
              </div>
            </>
          )}
        </article>

        {d && d.more.length > 0 && (
          <section className="article__more" aria-labelledby="more-t">
            <div className="section-head">
              <h2 id="more-t" className="h-section">
                More news
              </h2>
            </div>
            <ul className="news-list">
              {d.more.map((n, k) => (
                <NewsRow key={n.slug} article={n} index={k} />
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
