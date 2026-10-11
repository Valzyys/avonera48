import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router";
import { Avatar, MemberPhoto, PlatformMark, ShowArt } from "@/components/media/Media";
import { LogoMark } from "@/components/layout/Logo";
import { LineupAvatars, LiveTile, MemberCard, ShowRow, StreamCard, vtShow } from "@/components/domain/Cards";
import { StreamDialog } from "@/components/domain/StreamDialog";
import { ButtonLink, EmptyState, ErrorState, Icon, PreviewTag, Skeleton, Tabs } from "@/components/ui";
import { formatCountdown, useClock } from "@/hooks/useClock";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useResource } from "@/hooks/useResource";
import { api, type LiveItem, type ShowSummary } from "@/services";
import { compact, formatDate, formatDuration, formatTime, formatWeekday } from "@/utils/format";

const i = (n: number) => ({ ["--i" as string]: n }) as CSSProperties;

function SectionHead({ id, title, to, cta, children }: { id?: string; title: string; to?: string; cta?: string; children?: ReactNode }) {
  return (
    <div className="section-head">
      <h2 id={id} className="h-section">
        {title}
      </h2>
      <div className="section-head__aside">
        {children}
        {to && (
          <Link to={to} viewTransition className="more-link">
            {cta} <Icon name="chevronRight" size={16} />
          </Link>
        )}
      </div>
    </div>
  );
}

/** Digits re-key on change so each new value slides in. */
function Digits({ value }: { value: string }) {
  return (
    <span className="digits mono" aria-hidden>
      {value.split("").map((ch, k) => (
        <span key={`${k}-${ch}`} className="digits__d">
          {ch}
        </span>
      ))}
    </span>
  );
}

function NextShow({ show }: { show: ShowSummary }) {
  const now = useClock();
  const left = new Date(show.startsAt).getTime() - now;
  const c = formatCountdown(left);
  return (
    <Link to={`/theater/${show.slug}`} viewTransition className="next-show enter" style={i(2)}>
      <span className="next-show__head">
        <span className="meta">Next theater show</span>
        <span className="meta num">
          {formatWeekday(show.startsAt)} {formatDate(show.startsAt, { year: undefined })} · {formatTime(show.startsAt)}
        </span>
      </span>
      <span className="next-show__countdown" role="timer" aria-label={`Starts in ${c.d} days ${c.h} hours ${c.m} minutes`}>
        {left > 0 ? (
          <>
            {c.d > 0 && (
              <span className="next-show__unit">
                <Digits value={String(c.d)} />
                <span className="meta">d</span>
              </span>
            )}
            <span className="next-show__unit">
              <Digits value={c.h} />
              <span className="meta">h</span>
            </span>
            <span className="next-show__unit">
              <Digits value={c.m} />
              <span className="meta">m</span>
            </span>
            <span className="next-show__unit">
              <Digits value={c.s} />
              <span className="meta">s</span>
            </span>
          </>
        ) : (
          <span className="next-show__started">Starting now</span>
        )}
      </span>
      <span className="next-show__show">
        <span className="next-show__art" style={vtShow(show.slug)}>
          <ShowArt show={show} />
        </span>
        <span className="next-show__info">
          <span className="h-card">{show.title}</span>
          {show.center && (
            <span className="next-show__center small">
              <Avatar member={show.center} size={22} /> Center · {show.center.nickname}
            </span>
          )}
          <LineupAvatars members={show.lineupMembers} max={7} size={26} />
        </span>
      </span>
      <span className="next-show__cta">
        Lineup & details <Icon name="arrowRight" size={16} />
      </span>
    </Link>
  );
}

function NowBoard({ onOpen }: { onOpen: (i: LiveItem) => void }) {
  const live = useResource(() => api.listLiveNow(), []);
  const shows = useResource(() => api.listShows("upcoming"), []);
  const overview = useResource(() => api.getOverview(), []);
  const next = shows.data?.[0];
  const o = overview.data;
  // Stage light behind the board, tinted by whoever is live.
  const hues = (live.data ?? []).slice(0, 3).map((l) => l.member.hue);
  const glow = { ["--g1" as string]: hues[0] ?? 220, ["--g2" as string]: hues[1] ?? hues[0] ?? 260, ["--g3" as string]: hues[2] ?? hues[0] ?? 200 } as CSSProperties;

  return (
    <section className="now" aria-labelledby="now-title" style={glow}>
      <div className="now__glow" aria-hidden />
      <div className="container">
        <div className="now__intro">
          <p className="meta now__eyebrow enter">
            Unofficial JKT48 fan site <span aria-hidden>·</span> <PreviewTag>Preview with sample data</PreviewTag>
          </p>
          <h1 id="now-title" className="now__title">
            <span className="enter" style={i(1)}>
              Who&rsquo;s live,
            </span>{" "}
            <span className="enter" style={i(2)}>
              what&rsquo;s on stage,
            </span>{" "}
            <span className="enter muted" style={i(3)}>
              and everyone in between.
            </span>
          </h1>
          <dl className="stats enter" style={i(4)}>
            <Link to="/live" viewTransition className="stat">
              <dt>Live now</dt>
              <dd>
                <span className="stat__num num">{o ? o.liveNow : "–"}</span>
                <span className="live-tile__dot stat__live" aria-hidden />
              </dd>
            </Link>
            <Link to="/recent-live" viewTransition className="stat">
              <dt>Streams today</dt>
              <dd className="stat__num num">{o ? o.streamsToday : "–"}</dd>
            </Link>
            <Link to="/theater" viewTransition className="stat">
              <dt>Shows this week</dt>
              <dd className="stat__num num">{o ? o.showsThisWeek : "–"}</dd>
            </Link>
            <a href="#birthdays-title" className="stat">
              <dt>Birthdays this month</dt>
              <dd className="stat__num num">{o ? o.birthdaysThisMonth : "–"}</dd>
            </a>
          </dl>
        </div>

        <div className="now__grid">
          <section className="now__live" aria-labelledby="live-title">
            <SectionHead id="live-title" title="Live now" to="/live" cta="All live">
              {live.data && (
                <span className="live-count">
                  <span className="live-tile__dot" aria-hidden /> <span className="num">{live.data.length}</span> streaming
                </span>
              )}
            </SectionHead>
            {live.status === "error" ? (
              <ErrorState error={live.error} onRetry={live.reload} />
            ) : !live.data ? (
              <div className="live-grid">
                {[0, 1, 2].map((k) => (
                  <Skeleton key={k} height={360} />
                ))}
              </div>
            ) : live.data.length === 0 ? (
              <EmptyState icon="broadcast" title="Nobody is live right now" action={<ButtonLink to="/recent-live" size="sm" variant="secondary">See recent streams</ButtonLink>}>
                Members usually stream in the evening.
              </EmptyState>
            ) : (
              <div className="live-grid">
                {live.data.slice(0, 3).map((item, k) => (
                  <LiveTile key={item.id} item={item} onOpen={onOpen} index={k + 3} />
                ))}
              </div>
            )}
          </section>

          <aside className="now__side" aria-label="Theater">
            {shows.status === "error" ? (
              <ErrorState error={shows.error} onRetry={shows.reload} />
            ) : !next ? (
              <Skeleton height={420} />
            ) : (
              <>
                <NextShow show={next} />
                <ul className="later enter" style={i(4)}>
                  {shows.data!.slice(1, 4).map((s) => (
                    <li key={s.slug}>
                      <Link to={`/theater/${s.slug}`} viewTransition className="later__row">
                        <span className="later__date">
                          <span className="meta">{formatWeekday(s.startsAt)}</span>
                          <span className="num">{formatDate(s.startsAt, { day: "numeric", month: undefined, year: undefined })}</span>
                        </span>
                        <span className="later__main">
                          <span className="later__title">{s.title}</span>
                          <span className="meta mono">{formatTime(s.startsAt)}</span>
                        </span>
                        <Icon name="chevronRight" size={16} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </aside>
        </div>
      </div>
    </section>
  );
}

function RecentStreams({ onOpen }: { onOpen: (i: LiveItem) => void }) {
  const res = useResource(() => api.listRecentLives(), []);
  return (
    <section className="section reveal" aria-labelledby="recent-title">
      <div className="container">
        <SectionHead id="recent-title" title="Recent streams" to="/recent-live" cta="Live history" />
      </div>
      {res.status === "error" ? (
        <div className="container">
          <ErrorState error={res.error} onRetry={res.reload} />
        </div>
      ) : (
        <div className="shelf" role="region" aria-label="Recent streams — scroll sideways" tabIndex={0}>
          <ul className="shelf__track">
            {(res.data ?? Array.from({ length: 5 }, () => null)).slice(0, 8).map((item, k) => (
              <li key={item?.id ?? k} className="shelf__item">
                {item ? <StreamCard item={item} onOpen={onOpen} index={k} /> : <Skeleton height={250} />}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function ThisWeek() {
  const res = useResource(() => api.listShows(), []);
  const shows = (res.data ?? []).filter((s) => s.status !== "completed").slice(0, 5);
  return (
    <section className="section band reveal" aria-labelledby="week-title">
      <div className="container">
        <SectionHead id="week-title" title="Theater schedule" to="/theater" cta="Full schedule" />
        {res.status === "error" ? (
          <ErrorState error={res.error} onRetry={res.reload} />
        ) : !res.data ? (
          <Skeleton height={300} />
        ) : (
          <ul className="show-list">
            {shows.map((s, k) => (
              <ShowRow key={s.slug} show={s} index={k} withDate shareName={false} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function Members() {
  const [gen, setGen] = useState("all");
  const gens = useResource(() => api.listGenerations(), []);
  const res = useResource(() => api.listMembers({ status: undefined, generation: gen === "all" ? undefined : Number(gen), sort: "generation" }), [gen]);
  const live = useResource(() => api.listLiveNow(), []);
  const liveSet = new Set(live.data?.map((l) => l.member.slug));
  const list = (res.data ?? []).filter((m) => m.status !== "graduated").slice(0, 14);
  return (
    <section className="section reveal" aria-labelledby="members-title">
      <div className="container">
        <SectionHead id="members-title" title="Members" to="/members" cta="Full directory">
          <Tabs
            segmented
            label="Generation"
            value={gen}
            onChange={setGen}
            items={[{ id: "all", label: "All" }, ...(gens.data ?? []).map((g) => ({ id: String(g.number), label: `Gen ${g.number}` }))]}
          />
        </SectionHead>
        {res.status === "error" ? (
          <ErrorState error={res.error} onRetry={res.reload} />
        ) : (
          <ul className={`member-grid ${res.status === "loading" ? "is-refreshing" : ""}`} key={gen}>
            {list.map((m, k) => (
              <MemberCard key={m.slug} member={m} live={liveSet.has(m.slug)} index={k} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function Digest() {
  const top = useResource(() => api.listTopStreams(7, 5), []);
  const bdays = useResource(() => api.listBirthdays(30), []);
  const news = useResource(() => api.listNews(), []);
  const max = Math.max(1, ...(top.data ?? []).map((t) => t.viewers ?? 0));
  return (
    <section className="section band reveal" aria-label="This week">
      <div className="container digest">
        <div className="digest__col" aria-labelledby="top-title">
          <SectionHead id="top-title" title="Most watched · 7 days" to="/recent-live" cta="History" />
          {top.status === "error" ? (
            <ErrorState error={top.error} onRetry={top.reload} />
          ) : !top.data ? (
            <Skeleton height={300} />
          ) : (
            <ol className="rank">
              {top.data.map((t, k) => (
                <li key={t.id} className="rank__row enter" style={i(k)}>
                  <span className="rank__pos num">{k + 1}</span>
                  <Avatar member={t.member} size={36} />
                  <span className="rank__main">
                    <Link to={`/members/${t.member.slug}`} viewTransition className="rank__name">
                      {t.member.nickname}
                    </Link>
                    <span className="meta rank__title">{t.title}</span>
                    <span className="rank__bar" aria-hidden>
                      <span style={{ width: `${((t.viewers ?? 0) / max) * 100}%` }} />
                    </span>
                  </span>
                  <span className="rank__val">
                    <span className="num">{compact.format(t.viewers ?? 0)}</span>
                    <span className="meta">
                      <PlatformMark platform={t.platform} /> {formatDuration(t.startedAt, t.endedAt!)}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="digest__col" aria-labelledby="birthdays-title">
          <SectionHead id="birthdays-title" title="Birthdays" />
          {bdays.status === "error" ? (
            <ErrorState error={bdays.error} onRetry={bdays.reload} />
          ) : !bdays.data ? (
            <Skeleton height={300} />
          ) : bdays.data.length === 0 ? (
            <EmptyState icon="gift" title="No birthdays in the next 30 days" />
          ) : (
            <ul className="bday">
              {bdays.data.slice(0, 5).map((b, k) => (
                <li key={b.member.slug} className="enter" style={i(k)}>
                  <Link to={`/members/${b.member.slug}`} viewTransition className="bday__row">
                    <span className="bday__date">
                      <span className="num">{Number(b.date.slice(8))}</span>
                      <span className="meta">{formatDate(`${b.date}T12:00:00+07:00`, { day: undefined, month: "short", year: undefined })}</span>
                    </span>
                    <Avatar member={b.member} size={36} />
                    <span className="bday__main">
                      <span className="bday__name">{b.member.name}</span>
                      <span className="meta">Gen {b.member.generation}</span>
                    </span>
                    <span className={`bday__when ${b.inDays === 0 ? "is-today" : ""}`}>{b.inDays === 0 ? "Today" : b.inDays === 1 ? "Tomorrow" : `in ${b.inDays} days`}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="digest__col" aria-labelledby="news-title">
          <SectionHead id="news-title" title="News" to="/news" cta="All news" />
          {news.status === "error" ? (
            <ErrorState error={news.error} onRetry={news.reload} />
          ) : !news.data ? (
            <Skeleton height={300} />
          ) : (
            <ul className="digest-news">
              {news.data.slice(0, 5).map((a, k) => (
                <li key={a.slug} className="enter" style={i(k)}>
                  <Link to={`/news/${a.slug}`} viewTransition className="digest-news__row">
                    <span className="meta">
                      {a.category} · {formatDate(a.publishedAt, { year: undefined })}
                    </span>
                    <span className="digest-news__title">{a.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

const INTRO_KEY = "avn.intro.v3";

/**
 * Roll call: every member's card washes in diagonally, the ones streaming
 * right now get their LIVE tag, the wordmark sits on a plate in the middle
 * with today's one-line status — then the sheet lifts to reveal the board.
 * ~1.6s, once per session; any click, key or scroll skips it; never shown
 * with reduced motion.
 */
function Intro() {
  const [phase, setPhase] = useState<"off" | "in" | "out">(() => {
    try {
      if (sessionStorage.getItem(INTRO_KEY) || matchMedia("(prefers-reduced-motion: reduce)").matches) return "off";
      sessionStorage.setItem(INTRO_KEY, "1");
    } catch {
      return "off";
    }
    return "in";
  });
  const members = useResource(() => api.listMembers({ sort: "generation" }), []);
  const live = useResource(() => api.listLiveNow(), []);
  const shows = useResource(() => api.listShows("upcoming"), []);
  const overview = useResource(() => api.getOverview(), []);
  const ready = !!members.data;

  useEffect(() => {
    if (phase === "in") document.documentElement.classList.add("intro-playing");
  }, [phase]);

  useEffect(() => {
    if (phase !== "in" || !ready) return;
    const skip = () => setPhase("out");
    const t = window.setTimeout(skip, 1650);
    window.addEventListener("pointerdown", skip, { once: true });
    window.addEventListener("keydown", skip, { once: true });
    window.addEventListener("wheel", skip, { once: true, passive: true });
    window.addEventListener("touchmove", skip, { once: true, passive: true });
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("pointerdown", skip);
      window.removeEventListener("keydown", skip);
      window.removeEventListener("wheel", skip);
      window.removeEventListener("touchmove", skip);
    };
  }, [phase, ready]);

  useEffect(() => {
    if (phase !== "out") return;
    document.documentElement.classList.remove("intro-playing");
    const t = window.setTimeout(() => setPhase("off"), 650);
    return () => window.clearTimeout(t);
  }, [phase]);

  if (phase === "off") return null;
  const liveSet = new Set(live.data?.map((l) => l.member.slug));
  const next = shows.data?.[0];
  const cols = 6;
  return (
    <div className={`intro intro--${phase} ${ready ? "is-ready" : ""}`} aria-hidden>
      <div className="intro__grid">
        {(members.data ?? []).map((m, k) => {
          const wave = (k % cols) + Math.floor(k / cols); // diagonal order
          return (
            <span key={m.slug} className="intro__card" style={i(wave)}>
              <MemberPhoto member={m} />
              {liveSet.has(m.slug) && (
                <span className="intro__live">
                  <span className="live-tile__dot" /> Live
                </span>
              )}
            </span>
          );
        })}
      </div>
      <div className="intro__plate">
        <span className="intro__mark">
          <LogoMark size={40} />
        </span>
        <span className="intro__word">
          {"Avonera48".split("").map((ch, k) => (
            <span key={k} style={i(k)}>
              {ch}
            </span>
          ))}
        </span>
        <span className="intro__line">
          <span className="intro__stat">
            <span className="live-tile__dot" /> {live.data ? live.data.length : "–"} live now
          </span>
          {next && (
            <span className="intro__stat">
              Next show · {formatWeekday(next.startsAt)} {formatTime(next.startsAt)}
            </span>
          )}
          {overview.data && <span className="intro__stat">{overview.data.birthdaysThisMonth} birthdays this month</span>}
        </span>
      </div>
      <span className="intro__skip">Tap to skip</span>
    </div>
  );
}

export function HomePage() {
  useDocumentTitle("");
  const [stream, setStream] = useState<LiveItem | null>(null);
  return (
    <div className="home">
      <Intro />
      <NowBoard onOpen={setStream} />
      <Digest />
      <RecentStreams onOpen={setStream} />
      <ThisWeek />
      <Members />
      <StreamDialog stream={stream} onClose={() => setStream(null)} />
    </div>
  );
}
