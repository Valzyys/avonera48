import { Link, useParams } from "react-router";
import { MemberPhoto, ShowArt } from "@/components/media/Media";
import { ShowStatusBadge } from "@/components/domain/Badges";
import { vtShow } from "@/components/domain/Cards";
import { ShareButton } from "@/components/domain/ShareButton";
import { Breadcrumb, ButtonLink, Callout, EmptyState, ErrorState, PreviewTag, Skeleton } from "@/components/ui";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useResource } from "@/hooks/useResource";
import { api } from "@/services";
import { formatDate, formatLongDate, formatTime } from "@/utils/format";

export default function ShowDetailPage() {
  const { slug = "" } = useParams();
  const res = useResource(() => api.getShow(slug), [slug]);
  // Render what the schedule already delivered so the artwork morphs in instantly.
  const show = res.data ?? api.peekShow(slug);
  const d = res.data;
  const all = useResource(() => api.listShows(), []);
  const sameSetlist = (all.data ?? []).filter((x) => show && x.setlist === show.setlist && x.slug !== slug).slice(0, 4);
  useDocumentTitle(show ? `${show.title} · ${formatDate(show.startsAt)}` : "Theater show");

  if (res.status === "error") return <div className="container page-body"><ErrorState error={res.error} onRetry={res.reload} /></div>;
  if (res.status === "success" && !d)
    return (
      <div className="container page-body">
        <EmptyState icon="ticket" title="Show not found" action={<ButtonLink to="/theater" size="sm" variant="secondary">Back to schedule</ButtonLink>}>
          It may have been removed, or the link is wrong.
        </EmptyState>
      </div>
    );

  return (
    <div className="page">
      <div className="container page-body">
        <div className="detail-top">
          <Breadcrumb items={[{ label: "Theater", to: "/theater" }, { label: show ? `${show.title}, ${formatDate(show.startsAt, { year: undefined })}` : "…" }]} />
        </div>
        <div className="show-hero">
          <div className="show-hero__art" style={vtShow(slug)}>
            {show ? <ShowArt show={show} /> : <Skeleton height="100%" />}
          </div>
          <div className="show-hero__info">
            {show ? (
              <>
                <div className="show-hero__badges enter">
                  <ShowStatusBadge status={show.status} />
                  <PreviewTag>Sample schedule</PreviewTag>
                </div>
                <h1 className="h-page enter" style={{ ["--i" as string]: 1 }}>
                  {show.title}
                </h1>
                <dl className="facts enter" style={{ ["--i" as string]: 2 }}>
                  <div>
                    <dt>Date</dt>
                    <dd>{formatLongDate(show.startsAt)}</dd>
                  </div>
                  <div>
                    <dt>Time</dt>
                    <dd className="mono">{formatTime(show.startsAt)} WIB</dd>
                  </div>
                  <div>
                    <dt>Venue</dt>
                    <dd>{show.venue}</dd>
                  </div>
                  <div>
                    <dt>Lineup</dt>
                    <dd>{show.lineup.length ? `${show.lineup.length} members` : "Not announced"}</dd>
                  </div>
                </dl>
                <p className="lead enter" style={{ ["--i" as string]: 3 }}>
                  {show.description}
                </p>
                {show.note && <Callout tone={show.status === "cancelled" ? "danger" : "info"}>{show.note}</Callout>}
                <div className="actions-row">
                  <ShareButton />
                </div>
                {sameSetlist.length > 0 && (
                  <div className="other-dates enter" style={{ ["--i" as string]: 4 }}>
                    <h2 className="meta">Other dates for {show.setlist}</h2>
                    <ul>
                      {sameSetlist.map((x) => (
                        <li key={x.slug}>
                          <Link to={`/theater/${x.slug}`} viewTransition className="other-dates__row">
                            <span className="num">{formatDate(x.startsAt, { year: undefined })}</span>
                            <span className="mono muted">{formatTime(x.startsAt)}</span>
                            <ShowStatusBadge status={x.status} />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <>
                <Skeleton height={22} width={140} />
                <Skeleton height={56} width="70%" />
                <Skeleton height={120} />
              </>
            )}
          </div>
        </div>

        <section className="lineup" aria-labelledby="lineup-title">
          <div className="section-head">
            <h2 id="lineup-title" className="h-section">
              Lineup
            </h2>
            {d && d.lineupDetail.length > 0 && <span className="meta">{d.lineupDetail.length} members</span>}
          </div>
          {!d ? (
            <Skeleton height={260} />
          ) : d.lineupDetail.length === 0 ? (
            <EmptyState icon="users" title="Lineup not announced yet">
              It usually appears closer to the show date.
            </EmptyState>
          ) : (
            <ul className="lineup-grid">
              {[...d.lineupDetail]
                .sort((a, b) => (a.role === "center" ? -1 : b.role === "center" ? 1 : 0))
                .map((l, k) => (
                  <li key={l.member.slug} className="enter" style={{ ["--i" as string]: k }}>
                    <Link to={`/members/${l.member.slug}`} viewTransition className="lineup-member">
                      <span className="lineup-member__photo">
                        <MemberPhoto member={l.member} />
                        {l.role === "center" && <span className="role-tag">Center</span>}
                        {l.role === "unit" && <span className="role-tag">Unit</span>}
                      </span>
                      <span className="lineup-member__name">{l.member.nickname}</span>
                      <span className="meta">Gen {l.member.generation}</span>
                    </Link>
                  </li>
                ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
