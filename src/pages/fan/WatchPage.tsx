import { useMemo, useRef } from "react";
import { Link, useParams } from "react-router";
import { LiveFor } from "@/components/domain/Cards";
import { SourceNote } from "@/components/domain/SourceNote";
import { TheaterPlayer, type Playback } from "@/components/domain/TheaterPlayer";
import { Avatar, MemberPhoto, oshi, PlatformMark } from "@/components/media/Media";
import { Breadcrumb, Icon, Skeleton } from "@/components/ui";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useResource } from "@/hooks/useResource";
import { enter, useGSAP } from "@/motion/gsap";
import { api, type LiveItem } from "@/services";
import { formatTime } from "@/utils/format";
import { teamLabel } from "@/utils/team";

/** On-site player for a member's SHOWROOM live. */
export default function WatchPage() {
  const { slug = "" } = useParams();
  const ref = useRef<HTMLDivElement>(null);
  const live = useResource(() => api.listLiveNow(), []);
  const item = live.data?.find((i) => i.member.slug === slug && i.watchPath);
  const member = item?.member ?? api.peekMember(slug);
  useDocumentTitle(member ? `${member.nickname} · Watch` : "Watch");

  const playback = useMemo<Playback | null>(() => {
    const sources = item?.sources ?? [];
    return sources.length ? { playlistUrl: sources[0].url, qualities: sources.length > 1 ? sources : [] } : null;
  }, [item]);
  const others = (live.data ?? []).filter((i) => i !== item);

  useGSAP(
    () => {
      enter(".watch-grid > *", { autoAlpha: 0, y: 18, duration: 0.7, stagger: 0.08, clearProps: "transform,opacity,visibility" });
    },
    { scope: ref, dependencies: [!!item] },
  );

  return (
    <div className="page watch-page" ref={ref}>
      <div className="container page-body">
        <div className="detail-top">
          <Breadcrumb items={[{ label: "Live", to: "/live" }, { label: member?.nickname ?? "…" }]} />
        </div>

        <div className="watch-grid">
          <section className="watch-main" aria-label="Player">
            {live.status === "loading" && !live.data ? (
              <div className="watch-screen">
                <Skeleton height="100%" />
              </div>
            ) : item && playback ? (
              <TheaterPlayer key={item.id} playback={playback} title={item.title} />
            ) : (
              <div className="watch-screen watch-screen--off" style={member ? oshi(member) : undefined}>
                {member && <MemberPhoto member={member} className="watch-screen__photo" />}
                <div className="watch-screen__msg">
                  <span className="watch-screen__kicker">Off air</span>
                  <p>{member ? `${member.nickname} isn’t live on SHOWROOM right now.` : "This live isn’t on air right now."}</p>
                  <span className="watch-screen__links">
                    <Link to="/live" className="btn btn--secondary btn--sm">
                      <span className="btn__label">Who’s live now</span>
                    </Link>
                    <Link to="/recent-live" className="btn btn--ghost btn--sm">
                      <span className="btn__label">Recent lives</span>
                    </Link>
                  </span>
                </div>
              </div>
            )}

            {item && (
              <div className="watch-caption">
                <span className="watch-caption__live">
                  <i aria-hidden />
                  Live · <LiveFor since={item.startedAt} />
                </span>
                <PlatformMark platform={item.platform} />
                <span className="meta">Started {formatTime(item.startedAt)} WIB</span>
                {item.viewers !== undefined && <span className="meta num">{item.viewers.toLocaleString("en-US")} watching</span>}
              </div>
            )}
            {item && <h1 className="watch-title">{item.title}</h1>}
            <SourceNote />
          </section>

          <aside className="watch-side">
            {member && (
              <Link to={`/members/${member.slug}`} viewTransition className="watch-member" style={oshi(member)}>
                <MemberPhoto member={member} className="watch-member__photo" />
                <span className="watch-member__info">
                  <span className="label">Member</span>
                  <span className="watch-member__name">{member.name}</span>
                  <span className="meta">
                    {teamLabel(member.team)}
                    {member.generation ? ` · Generation ${member.generation}` : ""}
                  </span>
                  <span className="watch-member__more">
                    Profile <Icon name="arrowRight" size={14} />
                  </span>
                </span>
              </Link>
            )}

            <div className="room-card">
              <div className="room-card__head">
                <p className="label">Also live</p>
                <Link to="/live" className="room-card__more">
                  All <Icon name="arrowRight" size={14} />
                </Link>
              </div>
              {others.length ? (
                <ul className="watch-others">
                  {others.slice(0, 8).map((o) => (
                    <li key={o.id}>
                      <OtherLive item={o} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="meta">{live.data ? "No one else is live right now." : "Loading…"}</p>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function OtherLive({ item }: { item: LiveItem }) {
  const body = (
    <>
      <Avatar member={item.member} size={40} />
      <span className="watch-others__main">
        <span className="watch-others__name">{item.member.nickname}</span>
        <span className="meta">
          <LiveFor since={item.startedAt} />
        </span>
      </span>
      <PlatformMark platform={item.platform} />
    </>
  );
  if (item.watchPath) {
    return (
      <Link to={item.watchPath} viewTransition className="watch-others__item">
        {body}
      </Link>
    );
  }
  return item.url ? (
    <a href={item.url} target="_blank" rel="noreferrer noopener" className="watch-others__item">
      {body}
    </a>
  ) : (
    <span className="watch-others__item">{body}</span>
  );
}
