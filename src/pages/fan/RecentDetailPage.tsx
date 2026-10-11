import { useRef } from "react";
import { Link, useParams } from "react-router";
import { Avatar, PlatformMark, StreamThumb } from "@/components/media/Media";
import { StreamCard } from "@/components/domain/Cards";
import { ShareButton } from "@/components/domain/ShareButton";
import { SourceNote } from "@/components/domain/SourceNote";
import { Breadcrumb, ButtonLink, EmptyState, ErrorState, Icon, Skeleton } from "@/components/ui";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useResource } from "@/hooks/useResource";
import { enter, gsap, useGSAP } from "@/motion/gsap";
import { useEntrance } from "@/motion/hooks";
import { api } from "@/services";
import { compact, formatDuration, formatLongDate, formatTime, nf } from "@/utils/format";

const youtubeId = (url: string | null) => url?.match(/(?:youtu\.be\/|v=|embed\/)([\w-]{6,})/)?.[1] ?? null;

/** Big number that counts up from zero when it scrolls into view. */
function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const o = { v: 0 };
      gsap.to(o, {
        v: value,
        duration: 1.4,
        ease: "power3.out",
        onUpdate: () => (el.textContent = nf.format(Math.round(o.v))),
        scrollTrigger: { trigger: el, start: "top 95%", once: true },
      });
    },
    { scope: ref, revertOnUpdate: true, dependencies: [value] },
  );
  return (
    <div className="stat">
      <span className="stat__label">{label}</span>
      <span className="stat__value num" ref={ref}>
        {nf.format(value)}
      </span>
      {hint && <span className="stat__hint">{hint}</span>}
    </div>
  );
}

export default function RecentDetailPage() {
  const { id = "" } = useParams();
  const res = useResource(() => api.getStream(id), [id]);
  const d = res.data;
  const s = d?.stream;
  useDocumentTitle(s ? `${s.member.nickname} · ${s.title}` : "Recent live");
  const top = useRef<HTMLDivElement>(null);
  const lists = useRef<HTMLDivElement>(null);
  useEntrance(top, [!!s, id]);
  useGSAP(
    () => {
      if (!lists.current || !s?.stats) return;
      enter(lists.current.querySelectorAll(".gift"), { autoAlpha: 0, y: 16, scale: 0.9, duration: 0.5, stagger: 0.04, scrollTrigger: { trigger: lists.current, start: "top 90%", once: true } });
      const max = Math.max(1, ...s.stats.topSenders.map((t) => t.gold + t.points));
      lists.current.querySelectorAll<HTMLElement>(".sender__bar i").forEach((bar, k) => {
        const t = s.stats!.topSenders[k];
        gsap.fromTo(bar, { scaleX: 0 }, { scaleX: (t.gold + t.points) / max, duration: 1.1, ease: "power3.out", delay: k * 0.06, scrollTrigger: { trigger: bar, start: "top 95%", once: true } });
      });
    },
    { scope: lists, revertOnUpdate: true, dependencies: [s?.id] },
  );

  if (res.status === "error")
    return (
      <div className="container page-body">
        <ErrorState error={res.error} onRetry={res.reload} />
      </div>
    );
  if (res.status === "success" && !d)
    return (
      <div className="container page-body">
        <EmptyState icon="broadcast" title="Stream not found" action={<ButtonLink to="/recent-live" size="sm" variant="secondary">Back to recent live</ButtonLink>}>
          It may be older than the history the source keeps.
        </EmptyState>
      </div>
    );

  const yt = youtubeId(s?.replayUrl ?? null);
  const st = s?.stats;
  const gifts = st?.giftSummary.slice(0, 12) ?? [];
  const senders = st?.topSenders.slice(0, 10) ?? [];

  return (
    <div className="page">
      <div className="container page-body">
        <div className="detail-top">
          <Breadcrumb items={[{ label: "Recent live", to: "/recent-live" }, { label: s ? `${s.member.nickname} · ${s.title}` : "…" }]} />
        </div>

        <div className="rd-hero" ref={top}>
          <div className="rd-hero__media">{s ? <StreamThumb stream={s} member={s.member} /> : <Skeleton height="100%" />}</div>
          <div className="rd-hero__info">
            {s ? (
              <>
                <Link to={`/members/${s.member.slug}`} viewTransition className="rd-member" data-in>
                  <Avatar member={s.member} size={44} />
                  <span>
                    <span className="rd-member__name">{s.member.nickname}</span>
                    <span className="meta">{s.member.name}</span>
                  </span>
                </Link>
                <h1 className="h-page rd-title" data-in>
                  {s.title}
                </h1>
                <p className="rd-when" data-in>
                  <PlatformMark platform={s.platform} />
                  <span>{formatLongDate(s.startedAt)}</span>
                  <span className="mono">
                    {formatTime(s.startedAt)}
                    {s.endedAt && `–${formatTime(s.endedAt)}`} WIB
                  </span>
                  {s.endedAt && <span>{formatDuration(s.startedAt, s.endedAt)}</span>}
                </p>
                <div className="actions-row" data-in>
                  {s.replayUrl && (
                    <a className="btn btn--primary btn--md" href={s.replayUrl} target="_blank" rel="noreferrer noopener">
                      <span className="btn__label">Watch replay</span>
                      <Icon name="arrowUpRight" size={16} />
                    </a>
                  )}
                  <ShareButton />
                </div>
                <div data-in>
                  <SourceNote />
                </div>
              </>
            ) : (
              <>
                <Skeleton height={44} width={220} />
                <Skeleton height={64} />
                <Skeleton height={24} width="60%" />
              </>
            )}
          </div>
        </div>

        {s && (
          <section className="rd-stats" aria-label="Stats">
            {st ? (
              <>
                <Stat label="Peak viewers" value={st.peakViewers} />
                <Stat label="Comments" value={st.comments} />
                <Stat label="Gifts sent" value={st.gifts} />
                {st.gold > 0 && <Stat label="Gold" value={st.gold} hint={s.platform === "IDN Live" ? "IDN gold" : "paid gifts"} />}
                {st.points > 0 && <Stat label="Points" value={st.points} hint="SHOWROOM points" />}
              </>
            ) : (
              <>
                <Stat label="Viewers" value={s.viewers ?? 0} />
                {s.giftTotal && (
                  <div className="stat">
                    <span className="stat__label">Gift total</span>
                    <span className="stat__value num">{s.giftTotal}</span>
                  </div>
                )}
                <p className="meta rd-stats__note">Detailed stats for this session aren’t available from the source yet.</p>
              </>
            )}
          </section>
        )}

        {yt && (
          <section className="rd-section" aria-labelledby="rd-replay">
            <div className="section-head">
              <h2 id="rd-replay" className="h-section">
                Replay
              </h2>
            </div>
            <div className="rd-video">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${yt}`}
                title={`${s?.member.nickname} — ${s?.title} (replay)`}
                loading="lazy"
                allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </section>
        )}

        {st && (gifts.length > 0 || senders.length > 0) && (
          <div className="rd-lists" ref={lists}>
            {gifts.length > 0 && (
              <section aria-labelledby="rd-gifts">
                <div className="section-head">
                  <h2 id="rd-gifts" className="h-section">
                    Gifts
                  </h2>
                  <span className="meta">Top {gifts.length}</span>
                </div>
                <ul className="gifts">
                  {gifts.map((g, k) => (
                    <li key={`${g.name}-${k}`} className="gift">
                      <span className="gift__icon">{g.image ? <img src={g.image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(e) => (e.currentTarget.style.visibility = "hidden")} /> : null}</span>
                      <span className="gift__name">{g.name.replace(/\(anime\)|\(free\)/g, "").trim()}</span>
                      <span className="gift__count num">×{nf.format(g.count)}</span>
                      <span className="gift__value meta">{g.gold ? `${compact.format(g.gold)} gold` : `${compact.format(g.points)} pts`}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {senders.length > 0 && (
              <section aria-labelledby="rd-senders">
                <div className="section-head">
                  <h2 id="rd-senders" className="h-section">
                    Top gifters
                  </h2>
                </div>
                <ol className="senders">
                  {senders.map((t, k) => (
                    <li key={`${t.name}-${k}`} className="sender">
                      <span className="sender__pos num">{String(k + 1).padStart(2, "0")}</span>
                      <span className="sender__avatar">{t.avatar ? <img src={t.avatar} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(e) => (e.currentTarget.style.display = "none")} /> : null}
                        <span className="sender__initial">{t.name[0]}</span></span>
                      <span className="sender__main">
                        <span className="sender__name">{t.name}</span>
                        <span className="sender__bar" aria-hidden>
                          <i />
                        </span>
                      </span>
                      <span className="sender__value num">{t.gold ? `${nf.format(t.gold)} gold` : `${nf.format(t.points)} pts`}</span>
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </div>
        )}

        {d && d.more.length > 0 && (
          <section className="rd-section" aria-labelledby="rd-more">
            <div className="section-head">
              <h2 id="rd-more" className="h-section">
                More from {d.stream.member.nickname}
              </h2>
            </div>
            <div className="stream-grid">
              {d.more.map((m) => (
                <StreamCard key={m.id} item={m} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
