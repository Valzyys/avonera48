import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router";
import { Avatar, Flag, MemberPhoto, PlatformMark, ShowArt, oshi } from "@/components/media/Media";
import { LineupAvatars, LiveFor, ShowRow, StreamCard, vtShow } from "@/components/domain/Cards";
import { StreamDialog } from "@/components/domain/StreamDialog";
import { TodayTimeline } from "@/components/domain/TodayTimeline";
import { ButtonLink, ErrorState, Icon, Skeleton } from "@/components/ui";
import { formatCountdown, useClock } from "@/hooks/useClock";
import { SourceNote } from "@/components/domain/SourceNote";
import { retryOrigin } from "@/utils/media";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useResource } from "@/hooks/useResource";
import { enter, gsap, reducedMotion, useGSAP } from "@/motion/gsap";
import { useSectionReveal, useStagger } from "@/motion/hooks";
import { api, type LiveItem, type ShowSummary } from "@/services";
import { compact, formatDate, formatDuration, formatTime, formatWeekday } from "@/utils/format";

const DAY = 86_400_000;
const WIB = 7 * 3_600_000;
const dayStartOf = (ms: number) => Math.floor((ms + WIB) / DAY) * DAY - WIB;
const INTRO_KEY = "avn.intro.v5";
const TEAM_TINTS = ["#e5679c", "#4b8fe2", "#ef7a3c", "#3aa877"];

/* ------------------------------------------------------------------ */
/* Section heading: big uppercase word that rises out of a mask (GSAP) */

function SectionHead({ id, title, desc, to, cta }: { id: string; title: string; desc?: string; to?: string; cta?: string }) {
  return (
    <div className="sh">
      <h2 id={id} className="h-section">
        <span className="h-section__mask">
          <span className="h-section__inner">{title}</span>
        </span>
      </h2>
      {desc && (
        <p className="sh__desc" data-reveal>
          {desc}
        </p>
      )}
      {to && (
        <Link to={to} viewTransition className="more-link sh__more" data-reveal>
          {cta} <Icon name="arrowRight" size={14} />
        </Link>
      )}
    </div>
  );
}

function Section({ id, children, band }: { id: string; children: ReactNode; band?: boolean }) {
  const ref = useRef<HTMLElement>(null);
  useSectionReveal(ref);
  return (
    <section ref={ref} className={`section ${band ? "band" : ""}`} aria-labelledby={id}>
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* INTRO — the members                                                 */

/**
 * A row of member photo strips rises and closes over the page, the
 * wordmark plate opens on top, then the strips lift away in reverse order
 * to reveal the board. GSAP timeline, ~2.5s, once per session, skippable,
 * never shown with reduced motion.
 */
function Intro({ onReveal, onDone }: { onReveal: () => void; onDone: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const members = useResource(() => api.listMembers({ sort: "generation" }), []);
  const live = useResource(() => api.listLiveNow(), []);
  // The intro never waits for data: tiles start in team colours and the
  // portraits drop in whenever the member list arrives.
  const [grid] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 900px)").matches);

  useGSAP(
    () => {
      if (!ref.current) return;
      const stripes = ref.current.querySelectorAll(".intro__stripe");
      const word = ref.current.querySelectorAll(".intro__char");
      const meta = ref.current.querySelector(".intro__meta");
      const plate = ref.current.querySelector(".intro__center");
      const finish = () => {
        tl.kill();
        onDone();
      };
      // Paper covers the page; colours rise over it; the name plate opens;
      // then the paper drops away and the stripes lift off the page while
      // the hero builds itself underneath.
      const tl = gsap.timeline({ onComplete: finish });
      // Narrow screens get a 3×4 grid of portraits (strips would be too thin
      // to show a face); wide screens get the row of strips.
      if (grid) enter(stripes, { autoAlpha: 0, scale: 0.6, rotate: () => gsap.utils.random(-8, 8), duration: 0.55, ease: "back.out(1.6)", stagger: { each: 0.06, grid: [4, 3], from: "center" } }, tl);
      else enter(stripes, { yPercent: 101, duration: 0.6, ease: "power3.inOut", stagger: { each: 0.03, from: "start" } }, tl);
      enter(plate, { clipPath: "inset(0% 50% 0% 50%)", duration: 0.45, ease: "power3.inOut" }, tl, "-=0.2");
      enter(word, { yPercent: 110, duration: 0.55, ease: "power4.out", stagger: 0.035 }, tl, "-=0.15");
      enter(meta, { autoAlpha: 0, y: 8, duration: 0.35 }, tl, "-=0.25");
      tl.to({}, { duration: 0.25 })
        .to(plate, { clipPath: "inset(0% 50% 0% 50%)", duration: 0.35, ease: "power3.in" })
        .set(ref.current, { backgroundColor: "transparent" })
        .call(onReveal)
        .to(
          stripes,
          grid
            ? { autoAlpha: 0, scale: 0.8, yPercent: -20, duration: 0.5, ease: "power3.in", stagger: { each: 0.05, grid: [4, 3], from: "edges" } }
            : { yPercent: -101, duration: 0.7, ease: "power3.inOut", stagger: { each: 0.03, from: "end" } },
        );

      const skip = () => void tl.timeScale(4);
      const el = ref.current;
      el.addEventListener("pointerdown", skip);
      window.addEventListener("keydown", skip, { once: true });
      window.addEventListener("wheel", skip, { once: true, passive: true });
      return () => {
        el.removeEventListener("pointerdown", skip);
        window.removeEventListener("keydown", skip);
        window.removeEventListener("wheel", skip);
      };
    },
    { scope: ref },
  );

  const count = grid ? 12 : 14;
  const cast = (members.data ?? []).filter((m) => m.status === "active" && m.photoUrl).slice(0, count);
  const tiles = Array.from({ length: count }, (_, k) => cast[k] ?? null);
  return (
    <div ref={ref} className={`intro ${grid ? "intro--grid" : ""}`} aria-hidden>
      <div className="intro__stripes">
        {tiles.map((m, k) => (
          <span key={k} className="intro__stripe" style={{ background: m?.color ?? TEAM_TINTS[k % TEAM_TINTS.length] }}>
            {m && <img src={m.photoUrl} alt="" decoding="async" referrerPolicy="no-referrer" onLoad={(e) => e.currentTarget.classList.add("is-in")} onError={(e) => retryOrigin(e.currentTarget, () => (e.currentTarget.style.display = "none"))} />}
            {grid && m && <span className="intro__tile-name">{m.nickname}</span>}
          </span>
        ))}
      </div>
      <div className="intro__center">
          <span className="intro__word">
            {"AVONERA48".split("").map((ch, k) => (
              <span key={k} className="intro__mask">
                <span className="intro__char">{ch}</span>
              </span>
            ))}
          </span>
          <span className="intro__meta">JKT48 fan site · {live.data ? `${live.data.length} live now` : "today"}</span>
        </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* HERO — Today                                                         */

function LiveCard({ item, onOpen }: { item: LiveItem; onOpen: (i: LiveItem) => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  // Subtle pointer tilt (GSAP quickTo), mouse only.
  useGSAP(
    () => {
      const el = ref.current;
      if (!el || reducedMotion()) return;
      const rx = gsap.quickTo(el, "rotationX", { duration: 0.5, ease: "power3.out" });
      const ry = gsap.quickTo(el, "rotationY", { duration: 0.5, ease: "power3.out" });
      const move = (e: PointerEvent) => {
        if (e.pointerType !== "mouse") return;
        const r = el.getBoundingClientRect();
        ry(((e.clientX - r.left) / r.width - 0.5) * 10);
        rx(-((e.clientY - r.top) / r.height - 0.5) * 10);
      };
      const leave = () => {
        rx(0);
        ry(0);
      };
      el.addEventListener("pointermove", move);
      el.addEventListener("pointerleave", leave);
      return () => {
        el.removeEventListener("pointermove", move);
        el.removeEventListener("pointerleave", leave);
      };
    },
    { scope: ref },
  );
  return (
    <button ref={ref} type="button" className="hero-card" onClick={() => onOpen(item)} style={oshi(item.member)}>
      <span className="hero-card__photo">
        <MemberPhoto member={item.member} eager />
        {item.status === "live" ? (
          <Flag tone="live" className="card-flag">
            LIVE
          </Flag>
        ) : (
          <Flag tone="light" className="card-flag">
            ENDED {formatTime(item.endedAt!)}
          </Flag>
        )}
        <span className="hero-card__name">{item.member.nickname}</span>
      </span>
      <span className="hero-card__info">
        <span className="hero-card__title">{item.title}</span>
        <span className="hero-card__meta">
          <PlatformMark platform={item.platform} />
          {item.status === "live" ? <LiveFor since={item.startedAt} /> : <span className="num">{compact.format(item.viewers ?? 0)} viewers</span>}
        </span>
      </span>
    </button>
  );
}

function Digits({ value }: { value: string }) {
  return <span className="digits">{value}</span>;
}

function NextShow({ show }: { show: ShowSummary }) {
  const now = useClock();
  const left = new Date(show.startsAt).getTime() - now;
  const c = formatCountdown(left);
  return (
    <Link to={`/theater/${show.slug}`} viewTransition className="next-show">
      <span className="label">Next show</span>
      <span className="next-show__countdown" role="timer" aria-label={`Starts in ${c.d} days ${c.h} hours ${c.m} minutes`}>
        {left > 0 ? (
          <>
            {c.d > 0 && (
              <span className="next-show__unit">
                <Digits value={String(c.d)} />
                <span className="meta">D</span>
              </span>
            )}
            <span className="next-show__unit">
              <Digits value={c.h} />
              <span className="meta">H</span>
            </span>
            <span className="next-show__unit">
              <Digits value={c.m} />
              <span className="meta">M</span>
            </span>
            <span className="next-show__unit">
              <Digits value={c.s} />
              <span className="meta">S</span>
            </span>
          </>
        ) : (
          <span className="next-show__started">On stage now</span>
        )}
      </span>
      <span className="next-show__show">
        <span className="next-show__art" style={vtShow(show.slug)}>
          <ShowArt show={show} use="poster" />
        </span>
        <span className="next-show__info">
          <span className="h-card">{show.title}</span>
          <span className="meta">
            {formatWeekday(show.startsAt)} {formatDate(show.startsAt, { year: undefined })} · {formatTime(show.startsAt)} WIB
          </span>
          <LineupAvatars members={show.lineupMembers} max={7} size={24} />
        </span>
      </span>
    </Link>
  );
}

function Today({ onOpen, introDone }: { onOpen: (i: LiveItem) => void; introDone: boolean }) {
  const ref = useRef<HTMLElement>(null);
  const now = useClock();
  const dayStart = dayStartOf(now);
  const live = useResource(() => api.listLiveNow(), []);
  const recent = useResource(() => api.listRecentLives(), []);
  const shows = useResource(() => api.listShows(), []);
  const bdays = useResource(() => api.listBirthdays(30), []);
  const ready = !!(live.data && recent.data && shows.data);

  const todayStreams = ready ? [...live.data!, ...recent.data!.filter((s) => new Date(s.startedAt).getTime() >= dayStart)] : [];
  const todayShows = (shows.data ?? []).filter((s) => {
    const t = new Date(s.startsAt).getTime();
    return t >= dayStart && t < dayStart + DAY;
  });
  const upcoming = (shows.data ?? []).filter((s) => s.status === "upcoming" && new Date(s.startsAt).getTime() > now);
  const next = upcoming[0];
  const liveCount = live.data?.length ?? 0;
  const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: "Asia/Jakarta" }).format(new Date(now));
  const date = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Jakarta" }).format(new Date(now));
  const clock = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "Asia/Jakarta" }).format(new Date(now));

  // Entrance: title lines rise from their masks, then cards, board, panels.
  useGSAP(
    () => {
      if (!ready || !introDone || !ref.current) return;
      const q = gsap.utils.selector(ref);
      const tl = gsap.timeline();
      enter(q(".today__line > span"), { yPercent: 105, duration: 0.9, ease: "power4.out", stagger: 0.08 }, tl);
      enter(q(".today__intro [data-in]"), { autoAlpha: 0, y: 14, duration: 0.6, stagger: 0.06, clearProps: "all" }, tl, "-=0.55");
      enter(q(".hero-card"), { autoAlpha: 0, y: 40, rotate: (k: number) => (k - 1) * 3, duration: 0.8, stagger: 0.09, ease: "power3.out", clearProps: "opacity,visibility,transform" }, tl, "-=0.6");
      enter(q(".today__board"), { autoAlpha: 0, y: 24, duration: 0.7, clearProps: "all" }, tl, "-=0.45");
      enter(q(".today__below > *"), { autoAlpha: 0, y: 20, duration: 0.6, stagger: 0.08, clearProps: "all" }, tl, "-=0.35");
    },
    { scope: ref, revertOnUpdate: true, dependencies: [ready, introDone] },
  );

  return (
    <section ref={ref} className="today" aria-labelledby="today-title">
      <div className="container">
        <div className="today__top">
          <div className="today__intro">
            <p className="label today__kicker" data-in>
              Today in JKT48 <span className="today__clock mono">{clock} WIB</span>
            </p>
            <h1 id="today-title" className="today__title">
              <span className="today__line">
                <span>{weekday}</span>
              </span>
              <span className="today__line">
                <span>{date}</span>
              </span>
            </h1>
            <p className="today__summary" data-in>
              {ready ? (
                <>
                  <span className="today__live">
                    <span className="today__dot" aria-hidden /> {liveCount} {liveCount === 1 ? "member" : "members"} live
                  </span>
                  <span>{todayStreams.length} streams today</span>
                  {next && (
                    <span>
                      <Link to={`/theater/${next.slug}`} viewTransition className="link">
                        {next.title}
                      </Link>{" "}
                      {new Date(next.startsAt).getTime() < dayStart + DAY ? "tonight" : formatWeekday(next.startsAt)} {formatTime(next.startsAt)}
                    </span>
                  )}
                </>
              ) : (
                " "
              )}
            </p>
            <div className="today__actions" data-in>
              <ButtonLink to="/live" viewTransition variant="primary" iconRight="arrowRight">
                Watch live
              </ButtonLink>
              <ButtonLink to="/theater" viewTransition variant="secondary">
                Theater schedule
              </ButtonLink>
            </div>
            <p className="today__note" data-in>
              <SourceNote />
            </p>
          </div>

          <div className="today__cards" aria-label="Live now and just ended">
            {ready ? [...live.data!, ...recent.data!].slice(0, 3).map((l) => <LiveCard key={l.id} item={l} onOpen={onOpen} />) : [0, 1, 2].map((k) => <Skeleton key={k} height={300} />)}
          </div>
        </div>

        <div className="today__board">
          {ready ? (
            <TodayTimeline dayStartMs={dayStart} now={now} streams={todayStreams} shows={todayShows} onOpen={onOpen} play={introDone} />
          ) : (
            <Skeleton height={330} />
          )}
        </div>

        <div className="today__below">
          {next ? <NextShow show={next} /> : <Skeleton height={260} />}
          <div className="panel">
            <div className="panel__head">
              <span className="label">Coming up</span>
              <Link to="/theater" viewTransition className="more-link">
                All <Icon name="arrowRight" size={14} />
              </Link>
            </div>
            <ul className="later">
              {upcoming.slice(1, 5).map((s) => (
                <li key={s.slug}>
                  <Link to={`/theater/${s.slug}`} viewTransition className="later__row">
                    <span className="later__date">
                      <span className="num">{formatDate(s.startsAt, { day: "2-digit", month: undefined, year: undefined })}</span>
                      <span className="meta">{formatWeekday(s.startsAt)}</span>
                    </span>
                    <span className="later__main">
                      <span className="later__title">{s.title}</span>
                      <span className="meta">
                        {formatTime(s.startsAt)} · {s.lineupMembers.length ? `${s.lineupMembers.length} members` : "lineup TBA"}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="panel">
            <div className="panel__head">
              <span className="label">Birthdays</span>
            </div>
            {bdays.data && bdays.data.length === 0 ? (
              <p className="meta">No birthdays in the next 30 days.</p>
            ) : (
              <ul className="bday">
                {(bdays.data ?? []).slice(0, 4).map((b) => (
                  <li key={b.member.slug}>
                    <Link to={`/members/${b.member.slug}`} viewTransition className="bday__row">
                      <span className="bday__date">
                        <span className="num">{Number(b.date.slice(8))}</span>
                        <span className="meta">{formatDate(`${b.date}T12:00:00+07:00`, { day: undefined, month: "short", year: undefined })}</span>
                      </span>
                      <Avatar member={b.member} size={32} />
                      <span className="bday__name">{b.member.name}</span>
                      <span className={`bday__when ${b.inDays <= 2 ? "is-soon" : ""}`}>{b.inDays === 0 ? "Today" : b.inDays === 1 ? "Tomorrow" : `${b.inDays} days`}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function Ranking() {
  const top = useResource(() => api.listTopStreams(7, 5), []);
  const news = useResource(() => api.listNews(), []);
  const max = Math.max(1, ...(top.data ?? []).map((t) => t.viewers ?? 0));
  const rankRef = useRef<HTMLOListElement>(null);
  const newsRef = useRef<HTMLUListElement>(null);
  useStagger(rankRef, [top.data]);
  useStagger(newsRef, [news.data]);
  // Bars grow from zero once the ranking scrolls into view.
  useGSAP(
    () => {
      if (!rankRef.current || !top.data || reducedMotion()) return;
      enter(rankRef.current.querySelectorAll(".rank__bar span"), {
        scaleX: 0,
        transformOrigin: "left center",
        duration: 1.1,
        ease: "power3.out",
        stagger: 0.08,
        scrollTrigger: { trigger: rankRef.current, start: "top 85%", once: true },
      });
    },
    { scope: rankRef, revertOnUpdate: true, dependencies: [top.data] },
  );

  return (
    <Section id="rank-title" band>
      <div className="container split">
        <div>
          <SectionHead id="rank-title" title="Ranking" desc="Most watched streams, last 7 days" to="/recent-live" cta="History" />
          {top.status === "error" ? (
            <ErrorState error={top.error} onRetry={top.reload} />
          ) : !top.data ? (
            <Skeleton height={300} />
          ) : (
            <ol className="rank" ref={rankRef}>
              {top.data.map((t, k) => (
                <li key={t.id} className="rank__row" style={oshi(t.member)}>
                  <span className="rank__pos">{String(k + 1).padStart(2, "0")}</span>
                  <Avatar member={t.member} size={40} />
                  <span className="rank__main">
                    <Link to={`/members/${t.member.slug}`} viewTransition className="rank__name">
                      {t.member.nickname}
                    </Link>
                    <span className="meta rank__title">
                      {t.title} · {formatDuration(t.startedAt, t.endedAt!)}
                    </span>
                    <span className="rank__bar" aria-hidden>
                      <span style={{ width: `${((t.viewers ?? 0) / max) * 100}%` }} />
                    </span>
                  </span>
                  <span className="rank__val">
                    <span className="num">{compact.format(t.viewers ?? 0)}</span>
                    <span className="meta">peak</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
        <div>
          <SectionHead id="news-title" title="News" desc="Theater, releases and events" to="/news" cta="All news" />
          {news.status === "error" ? (
            <ErrorState error={news.error} onRetry={news.reload} />
          ) : !news.data ? (
            <Skeleton height={300} />
          ) : (
            <ul className="news-list" ref={newsRef}>
              {news.data.slice(0, 5).map((a) => (
                <li key={a.slug}>
                  <Link to={`/news/${a.slug}`} viewTransition className="news-row news-row--compact">
                    <time className="news-row__date num" dateTime={a.publishedAt}>
                      {formatDate(a.publishedAt, { year: "numeric", month: "2-digit", day: "2-digit" }).split("/").reverse().join(".")}
                    </time>
                    <span className="news-row__cat">{a.category}</span>
                    <span className="news-row__title">{a.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Section>
  );
}

function RecentStreams({ onOpen }: { onOpen: (i: LiveItem) => void }) {
  const res = useResource(() => api.listRecentLives(), []);
  const track = useRef<HTMLUListElement>(null);
  useStagger(track, [res.data], { y: 30, each: 0.06 });
  return (
    <Section id="recent-title">
      <div className="container">
        <SectionHead id="recent-title" title="Archive" desc="Recent streams you might have missed" to="/recent-live" cta="Live history" />
      </div>
      {res.status === "error" ? (
        <div className="container">
          <ErrorState error={res.error} onRetry={res.reload} />
        </div>
      ) : (
        <div className="shelf" role="region" aria-label="Recent streams — scroll sideways" tabIndex={0}>
          <ul className="shelf__track" ref={track}>
            {(res.data ?? Array.from({ length: 5 }, () => null)).slice(0, 8).map((item, k) => (
              <li key={item?.id ?? k} className="shelf__item">
                {item ? <StreamCard item={item} onOpen={onOpen} /> : <Skeleton height={250} />}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Section>
  );
}

function Schedule() {
  const res = useResource(() => api.listShows(), []);
  const list = useRef<HTMLUListElement>(null);
  const shows = (res.data ?? []).filter((s) => s.status !== "completed").slice(0, 5);
  useStagger(list, [res.data], { y: 12, each: 0.06 });
  return (
    <Section id="week-title" band>
      <div className="container">
        <SectionHead id="week-title" title="Schedule" desc="Upcoming theater shows" to="/theater" cta="Full schedule" />
        {res.status === "error" ? (
          <ErrorState error={res.error} onRetry={res.reload} />
        ) : !res.data ? (
          <Skeleton height={300} />
        ) : (
          <ul className="show-list" ref={list}>
            {shows.map((s) => (
              <ShowRow key={s.slug} show={s} withDate shareName={false} art="poster" />
            ))}
          </ul>
        )}
      </div>
    </Section>
  );
}

function Roster() {
  const gens = useResource(() => api.listGenerations(), []);
  const res = useResource(() => api.listMembers({ sort: "generation" }), []);
  const live = useResource(() => api.listLiveNow(), []);
  const liveSet = new Set(live.data?.map((l) => l.member.slug));
  const list = useRef<HTMLDivElement>(null);
  useStagger(list, [res.data, gens.data], { y: 16, each: 0.07 });
  return (
    <Section id="roster-title">
      <div className="container">
        <SectionHead id="roster-title" title="Member" desc="Every member, by generation" to="/members" cta="Member directory" />
        {res.status === "error" ? (
          <ErrorState error={res.error} onRetry={res.reload} />
        ) : !res.data || !gens.data ? (
          <Skeleton height={300} />
        ) : (
          <div className="roster" ref={list}>
            {gens.data.map((g) => {
              const members = res.data!.filter((m) => (m.generation ?? 0) === g.number);
              return (
                <div key={g.number} className="roster__gen">
                  <div className="roster__head">
                    <span className="roster__num">{g.number ? String(g.number).padStart(2, "0") : "—"}</span>
                    <span className="label">{g.number ? "Generation" : "Generation not listed"}</span>
                    <span className="roster__count">{members.length === 1 ? "1 member" : `${members.length} members`}</span>
                  </div>
                  <ul className="roster__list">
                    {members.map((m) => (
                      <li key={m.slug}>
                        <Link to={`/members/${m.slug}`} viewTransition className={`roster__member ${m.status === "graduated" ? "is-grad" : ""}`} style={oshi(m)}>
                          <Avatar member={m} size={44} />
                          <span className="roster__text">
                            <span className="roster__name">{m.nickname}</span>
                            <span className="roster__full">{m.name}</span>
                          </span>
                          {liveSet.has(m.slug) && <Flag tone="live">LIVE</Flag>}
                          {m.status === "trainee" && <span className="roster__note">Trainee</span>}
                          {m.status === "graduated" && <span className="roster__note">Graduated</span>}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Section>
  );
}

export function HomePage() {
  useDocumentTitle("");
  const [stream, setStream] = useState<LiveItem | null>(null);
  const [intro, setIntro] = useState(() => {
    try {
      // Read only here: the key is written when the intro finishes, so a
      // double-invoked initializer (StrictMode) cannot swallow it.
      return !sessionStorage.getItem(INTRO_KEY) && !reducedMotion();
    } catch {
      return false;
    }
  });
  const [revealed, setRevealed] = useState(!intro);
  return (
    <div className="home">
      {intro && (
        <Intro
          onReveal={() => setRevealed(true)}
          onDone={() => {
            try {
              sessionStorage.setItem(INTRO_KEY, "1");
            } catch {
              /* private mode: the intro simply plays again next time */
            }
            setIntro(false);
          }}
        />
      )}
      <Today onOpen={setStream} introDone={revealed} />
      <Ranking />
      <RecentStreams onOpen={setStream} />
      <Schedule />
      <Roster />
      <StreamDialog stream={stream} onClose={() => setStream(null)} />
    </div>
  );
}

export type { CSSProperties };
