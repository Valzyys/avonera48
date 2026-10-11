import { useRef } from "react";
import { Link, useParams } from "react-router";
import { Flag, MemberPhoto, ShowArt } from "@/components/media/Media";
import { ShowStatusBadge } from "@/components/domain/Badges";
import { vtShow } from "@/components/domain/Cards";
import { ShareButton } from "@/components/domain/ShareButton";
import { Badge, Breadcrumb, ButtonLink, EmptyState, ErrorState, Skeleton } from "@/components/ui";
import { SourceNote } from "@/components/domain/SourceNote";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useResource } from "@/hooks/useResource";
import { useEntrance } from "@/motion/hooks";
import { api } from "@/services";
import { formatDate, formatLongDate, formatTime } from "@/utils/format";
import { teamLabel } from "@/utils/team";

export default function ShowDetailPage() {
  const { slug = "" } = useParams();
  const res = useResource(() => api.getShow(slug), [slug]);
  // Render what the schedule already delivered so the artwork morphs in instantly.
  const show = res.data ?? api.peekShow(slug);
  const d = res.data;
  const sameTitle = d?.sameTitle ?? [];
  useDocumentTitle(show ? `${show.title} · ${formatDate(show.startsAt)}` : "Theater show");
  const info = useRef<HTMLDivElement>(null);
  useEntrance(info, [!!show, slug]);

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
            {show ? <ShowArt show={show} use="poster" /> : <Skeleton height="100%" />}
          </div>
          <div className="show-hero__info" ref={info}>
            {show ? (
              <>
                <div className="show-hero__badges" data-in>
                  <ShowStatusBadge status={show.status} />
                  <Badge>{teamLabel(show.team)}</Badge>
                  {show.birthdayShow && <Flag tone="ink">BIRTHDAY SHOW</Flag>}
                </div>
                <h1 className="h-page" data-in>
                  {show.title}
                </h1>
                <dl className="facts" data-in>
                  <div>
                    <dt>Date</dt>
                    <dd>{formatLongDate(show.startsAt)}</dd>
                  </div>
                  <div>
                    <dt>Time</dt>
                    <dd className="mono">
                      {formatTime(show.startsAt)}–{formatTime(show.endsAt)} WIB
                    </dd>
                  </div>
                  <div>
                    <dt>Code</dt>
                    <dd className="mono">{show.code}</dd>
                  </div>
                  <div>
                    <dt>Lineup</dt>
                    <dd>{show.lineup.length ? `${show.lineup.length} members` : "Not announced"}</dd>
                  </div>
                </dl>
                <SourceNote />
                <div className="actions-row">
                  <ShareButton />
                </div>
                {sameTitle.length > 0 && (
                  <div className="other-dates" data-in>
                    <h2 className="meta">Other dates for {show.title}</h2>
                    <ul>
                      {sameTitle.map((x) => (
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
            {d && d.lineupMembers.length > 0 && <span className="meta">{d.lineupMembers.length} members</span>}
          </div>
          {!d ? (
            <Skeleton height={260} />
          ) : d.lineupMembers.length === 0 ? (
            <EmptyState icon="users" title="Lineup not announced yet">
              It usually appears closer to the show date.
            </EmptyState>
          ) : (
            <ul className="lineup-grid">
              {d.lineupMembers.map((m) => (
                <li key={m.slug}>
                  <Link to={`/members/${m.slug}`} viewTransition className="lineup-member">
                    <span className="lineup-member__photo">
                      <MemberPhoto member={m} />
                    </span>
                    <span className="lineup-member__name">{m.nickname}</span>
                    <span className="meta">{m.generation !== null ? `Gen ${m.generation}` : teamLabel(m.team)}</span>
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
