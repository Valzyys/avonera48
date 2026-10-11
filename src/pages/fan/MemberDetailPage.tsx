import { useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { Flag, MemberPhoto } from "@/components/media/Media";
import { MemberStatusBadge } from "@/components/domain/Badges";
import { NewsRow, ShowRow, StreamCard, vtPhoto } from "@/components/domain/Cards";
import { ShareButton } from "@/components/domain/ShareButton";
import { StreamDialog } from "@/components/domain/StreamDialog";
import { Badge, Breadcrumb, Button, ButtonLink, EmptyState, ErrorState, Icon, Skeleton, Tabs } from "@/components/ui";
import { SourceNote } from "@/components/domain/SourceNote";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useResource } from "@/hooks/useResource";
import { enter, shift, useGSAP } from "@/motion/gsap";
import { api, type LiveItem } from "@/services";
import { compact, formatDate } from "@/utils/format";
import { teamLabel } from "@/utils/team";

type Tab = "shows" | "lives" | "news";

export default function MemberDetailPage() {
  const { slug = "" } = useParams();
  const res = useResource(() => api.getMember(slug), [slug]);
  const [tab, setTab] = useState<Tab>("shows");
  const [stream, setStream] = useState<LiveItem | null>(null);
  const d = res.data;
  // The directory already delivered this member: render it at once so the
  // photo morphs from the card while activity loads.
  const m = d?.member ?? api.peekMember(slug);
  useDocumentTitle(m ? m.name : "Member");
  const info = useRef<HTMLDivElement>(null);
  // Profile text arrives line by line beside the (morphing) name card.
  useGSAP(
    () => {
      if (!m) return;
      enter(".profile__info > *", { autoAlpha: 0, y: shift(16), duration: 0.6, stagger: 0.06, delay: 0.15, clearProps: "transform,opacity,visibility" });
    },
    { scope: info, revertOnUpdate: true, dependencies: [!!m, slug] },
  );

  if (res.status === "error") return <div className="container page-body"><ErrorState error={res.error} onRetry={res.reload} /></div>;
  if (res.status === "success" && !d)
    return (
      <div className="container page-body">
        <EmptyState icon="user" title="Member not found" action={<ButtonLink to="/members" size="sm" variant="secondary">Back to members</ButtonLink>} />
      </div>
    );

  return (
    <div className="page">
      <div className="container page-body">
        <div className="detail-top">
          <Breadcrumb items={[{ label: "Members", to: "/members" }, { label: m?.name ?? "…" }]} />
        </div>
        <div className="profile">
          <div className="profile__photo" style={vtPhoto(slug)}>
            {m ? <MemberPhoto member={m} /> : <Skeleton height="100%" />}
            {d?.isLive && (
              <Flag tone="live" className="card-flag">
                LIVE
              </Flag>
            )}
          </div>
          <div className="profile__info" ref={info}>
            {m ? (
              <>
                <div className="profile__badges">
                  <Badge>{teamLabel(m.team)}</Badge>
                  {m.generation !== null && <Badge>Generation {m.generation}</Badge>}
                  {m.status !== "active" && <MemberStatusBadge status={m.status} />}
                </div>
                <h1 className="h-page">{m.nickname}</h1>
                <p className="profile__nick">{m.name}</p>
                <dl className="facts">
                  <div>
                    <dt>Birthday</dt>
                    <dd className="num">{m.birthday ? formatDate(`${m.birthday}T12:00:00+07:00`, { day: "numeric", month: "short", year: undefined }) : "–"}</dd>
                  </div>
                  <div>
                    <dt>Upcoming shows</dt>
                    <dd className="num">{d ? d.shows.filter((s) => s.status === "upcoming").length : "–"}</dd>
                  </div>
                  <div>
                    <dt>Recent streams</dt>
                    <dd className="num">{d ? d.recentLives.length : "–"}</dd>
                  </div>
                  <div>
                    <dt>Peak viewers</dt>
                    <dd className="num">{d && d.recentLives.length ? compact.format(Math.max(...d.recentLives.map((l) => l.viewers ?? 0))) : "–"}</dd>
                  </div>
                </dl>
                {m.socials.length > 0 && (
                  <ul className="socials" aria-label="Official accounts">
                    {m.socials.map((sc) => (
                      <li key={sc.url}>
                        <a href={sc.url} target="_blank" rel="noreferrer noopener" className="socials__link">
                          {sc.title}
                          <Icon name="arrowUpRight" size={13} />
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
                <SourceNote />
                <div className="actions-row">
                  {d?.isLive && (
                    <Button variant="primary" icon="broadcast" onClick={() => setStream(d.isLive)}>
                      Live on {d.isLive.platform}
                    </Button>
                  )}
                  <ShareButton />
                </div>
              </>
            ) : (
              <>
                <Skeleton height={22} width={160} />
                <Skeleton height={56} width="70%" />
                <Skeleton height={140} />
              </>
            )}
          </div>
        </div>

        <section className="activity" aria-label="Activity">
          {!d ? (
            <Skeleton height={240} />
          ) : (
            <>
              <Tabs
                label="Activity"
                value={tab}
                onChange={setTab}
                panelId="activity-panel"
                items={[
                  { id: "shows", label: "Theater", count: d.shows.length },
                  { id: "lives", label: "Streams", count: d.recentLives.length },
                  { id: "news", label: "News", count: d.news.length },
                ]}
              />
              <div id="activity-panel" role="tabpanel" className="activity__panel" key={tab}>
                {tab === "shows" &&
                  (d.shows.length ? (
                    <ul className="show-list">
                      {d.shows.map((s, k) => (
                        <ShowRow key={s.slug} show={s} index={k} withDate />
                      ))}
                    </ul>
                  ) : (
                    <EmptyState icon="ticket" title="No theater shows in the schedule" />
                  ))}
                {tab === "lives" &&
                  (d.recentLives.length ? (
                    <div className="stream-grid">
                      {d.recentLives.map((s, k) => (
                        <StreamCard key={s.id} item={s} onOpen={setStream} index={k} />
                      ))}
                    </div>
                  ) : (
                    <EmptyState icon="broadcast" title="No recent streams">
                      {d.member.nickname} hasn&rsquo;t streamed in this period.
                    </EmptyState>
                  ))}
                {tab === "news" &&
                  (d.news.length ? (
                    <ul className="news-list">
                      {d.news.map((n, k) => (
                        <NewsRow key={n.slug} article={n} index={k} />
                      ))}
                    </ul>
                  ) : (
                    <EmptyState icon="news" title="No related news" />
                  ))}
              </div>
              {tab === "lives" && d.recentLives.length > 0 && (
                <p className="activity__more">
                  <Link to={`/recent-live?member=${d.member.slug}`} viewTransition className="more-link">
                    All streams by {d.member.nickname} <Icon name="chevronRight" size={16} />
                  </Link>
                </p>
              )}
            </>
          )}
        </section>
      </div>
      <StreamDialog stream={stream} onClose={() => setStream(null)} />
    </div>
  );
}
