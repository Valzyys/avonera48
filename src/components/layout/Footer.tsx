import { useRef } from "react";
import { Link } from "react-router";
import { Avatar, ShowArt } from "@/components/media/Media";
import { formatCountdown, useClock } from "@/hooks/useClock";
import { useResource } from "@/hooks/useResource";
import { gsap, reducedMotion, ScrollTrigger, shift, useGSAP, enter } from "@/motion/gsap";
import { api, type ShowSummary } from "@/services";
import type { Member } from "@/types";
import { formatTime, formatWeekday } from "@/utils/format";
import { SourceNote } from "@/components/domain/SourceNote";

const cols = [
  { title: "Watch", links: [{ to: "/live", label: "Live now" }, { to: "/recent-live", label: "Recent live" }] },
  { title: "Theater", links: [{ to: "/theater", label: "Schedule" }, { to: "/theater?status=completed", label: "Past shows" }] },
  { title: "Explore", links: [{ to: "/members", label: "Members" }, { to: "/news", label: "News" }, { to: "/about", label: "About" }] },
];

const WORD = "AVONERA48";

/** One endless row of member portraits. GSAP moves it; scroll speed nudges it. */
function Parade({ members, reverse }: { members: Member[]; reverse?: boolean }) {
  const track = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      const el = track.current;
      if (!el || !members.length || reducedMotion()) return;
      const half = el.scrollWidth / 2;
      const loop = gsap.fromTo(el, { x: reverse ? -half : 0 }, { x: reverse ? 0 : -half, duration: half / 45, ease: "none", repeat: -1 });
      // Scrolling speeds the parade up for a moment, in the scroll direction.
      const st = ScrollTrigger.create({
        onUpdate: (self) => {
          const boost = gsap.utils.clamp(-4, 4, self.getVelocity() / 400);
          gsap.to(loop, { timeScale: (boost < 0 ? -1 : 1) * (1 + Math.abs(boost)), duration: 0.2, overwrite: true });
          gsap.to(loop, { timeScale: 1, duration: 1.2, delay: 0.25, ease: "power2.out", overwrite: false });
        },
      });
      const slow = () => gsap.to(loop, { timeScale: 0.15, duration: 0.5, overwrite: true });
      const resume = () => gsap.to(loop, { timeScale: 1, duration: 0.6, overwrite: true });
      el.addEventListener("pointerenter", slow);
      el.addEventListener("pointerleave", resume);
      return () => {
        st.kill();
        el.removeEventListener("pointerenter", slow);
        el.removeEventListener("pointerleave", resume);
      };
    },
    { scope: track, revertOnUpdate: true, dependencies: [members.length] },
  );
  return (
    <div className="parade__row">
      <div className="parade__track" ref={track}>
        {[0, 1].map((copy) => (
          <ul key={copy} className="parade__list" aria-hidden={copy === 1 || undefined}>
            {members.map((m) => (
              <li key={`${copy}-${m.slug}`}>
                <Link to={`/members/${m.slug}`} viewTransition className="parade__member" tabIndex={copy === 1 ? -1 : undefined}>
                  <Avatar member={m} size={64} />
                  <span className="parade__name">{m.nickname}</span>
                </Link>
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}

function NextShow({ show }: { show: ShowSummary }) {
  const now = useClock();
  const left = new Date(show.startsAt).getTime() - now;
  const c = formatCountdown(left);
  return (
    <Link to={`/theater/${show.slug}`} viewTransition className="curtain__show" data-rise>
      <span className="curtain__show-art">
        <ShowArt show={show} use="poster" />
      </span>
      <span className="curtain__show-info">
        <span className="curtain__kicker">Next on stage</span>
        <span className="curtain__show-title">{show.title}</span>
        <span className="curtain__show-meta">
          {formatWeekday(show.startsAt)} · {formatTime(show.startsAt)} WIB
        </span>
        <span className="curtain__count mono" role="timer">
          {left > 0 ? `${c.d > 0 ? `${c.d}d ` : ""}${c.h}:${c.m}:${c.s}` : "On stage now"}
        </span>
      </span>
    </Link>
  );
}

export function Footer() {
  const root = useRef<HTMLElement>(null);
  const members = useResource(() => api.listMembers({ sort: "generation" }), []);
  const shows = useResource(() => api.listShows("upcoming"), []);
  const cast = (members.data ?? []).filter((m) => m.status !== "graduated" && m.photoUrl);
  const half = Math.ceil(cast.length / 2);
  const next = shows.data?.[0];
  const live = useResource(() => api.listLiveNow(), []);
  const bdays = useResource(() => api.listBirthdays(60), []);
  const nextBday = bdays.data?.[0];

  useGSAP(
    () => {
      const el = root.current;
      if (!el) return;
      const q = gsap.utils.selector(el);
      if (reducedMotion()) {
        enter(q("[data-rise], .curtain__char"), { autoAlpha: 0, duration: 0.6, stagger: 0.03, scrollTrigger: { trigger: el, start: "top 90%", once: true } });
        return;
      }
      // The panel rises over the page like a curtain coming down, its corners easing flat.
      gsap.fromTo(
        q(".curtain"),
        { y: 140, borderRadius: "64px 64px 0 0" },
        { y: 0, borderRadius: "28px 28px 0 0", ease: "none", scrollTrigger: { trigger: el, start: "top bottom", end: "top 35%", scrub: 0.6 } },
      );
      enter(q(".curtain__line > span"), {
        yPercent: 110,
        duration: 0.9,
        ease: "power4.out",
        stagger: 0.1,
        scrollTrigger: { trigger: q(".curtain__headline")[0], start: "top 88%", once: true },
      });
      enter(q("[data-rise]"), {
        autoAlpha: 0,
        y: shift(24),
        duration: 0.7,
        stagger: 0.08,
        clearProps: "transform,opacity,visibility",
        scrollTrigger: { trigger: q(".curtain__grid")[0], start: "top 90%", once: true },
      });
      // The giant wordmark: each letter climbs out of the floor, one after another.
      gsap.fromTo(
        q(".curtain__char"),
        { yPercent: 105, rotate: (k: number) => (k % 2 ? 8 : -8) },
        { yPercent: 0, rotate: 0, duration: 1.1, ease: "back.out(1.4)", stagger: 0.07, scrollTrigger: { trigger: q(".curtain__word")[0], start: "top 98%", once: true } },
      );
      // The wordmark is painted with the team colours, slowly flowing through it.
      gsap.fromTo(q(".curtain__word"), { "--flow": "0%" }, { "--flow": "50%", duration: 10, ease: "none", repeat: -1 });
      enter(q(".curtain__stat"), { autoAlpha: 0, y: 12, duration: 0.5, stagger: 0.07, scrollTrigger: { trigger: q(".curtain__stats")[0], start: "top bottom", once: true } });
      // Back-to-top ring keeps turning.
      gsap.to(q(".curtain__ring-text"), { rotate: 360, duration: 14, ease: "none", repeat: -1, transformOrigin: "50% 50%" });
    },
    { scope: root, revertOnUpdate: true, dependencies: [cast.length > 0, !!next] },
  );

  const toTop = () => window.scrollTo({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" });

  return (
    <footer className="footer" ref={root}>
      <div className="curtain">
        <div className="container curtain__top">
          <p className="curtain__kicker" data-rise>
            Curtain call
          </p>
          <h2 className="curtain__headline">
            <span className="curtain__line">
              <span>See you</span>
            </span>
            <span className="curtain__line">
              <span>
                at the <em>theater.</em>
              </span>
            </span>
          </h2>
        </div>

        {cast.length > 0 && (
          <div className="parade" aria-label="Members">
            <Parade members={cast.slice(0, half)} />
            <Parade members={cast.slice(half)} reverse />
          </div>
        )}

        <div className="container curtain__grid">
          {next ? <NextShow show={next} /> : <div />}
          {cols.map((c) => (
            <nav key={c.title} aria-label={c.title} className="curtain__col" data-rise>
              <h3 className="curtain__kicker">{c.title}</h3>
              <ul>
                {c.links.map((l) => (
                  <li key={l.to}>
                    <Link to={l.to} viewTransition className="curtain__link">
                      <span>{l.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
          <button type="button" className="curtain__top-btn" onClick={toTop} data-rise>
            <svg viewBox="0 0 120 120" className="curtain__ring" aria-hidden>
              <defs>
                <path id="ring-path" d="M60,60 m-46,0 a46,46 0 1,1 92,0 a46,46 0 1,1 -92,0" />
              </defs>
              <g className="curtain__ring-text">
                <text>
                  <textPath href="#ring-path">BACK TO TOP · AVONERA48 · BACK TO TOP · </textPath>
                </text>
              </g>
            </svg>
            <span className="curtain__arrow" aria-hidden>
              ↑
            </span>
            <span className="sr-only">Back to top</span>
          </button>
        </div>

        <div className="curtain__word" aria-hidden>
          {WORD.split("").map((ch, k) => (
            <span key={k} className="curtain__char" style={{ ["--k" as string]: k }}>
              {ch}
            </span>
          ))}
        </div>

        <ul className="container curtain__stats" aria-label="At a glance">
          <li className="curtain__stat">
            <span className="curtain__stat-num">{members.data?.length ?? "–"}</span> members
          </li>
          <li className="curtain__stat curtain__stat--live">
            <span className="curtain__stat-dot" aria-hidden />
            <span className="curtain__stat-num">{live.data?.length ?? "–"}</span> live now
          </li>
          <li className="curtain__stat">
            <span className="curtain__stat-num">{shows.data?.length ?? "–"}</span> shows coming up
          </li>
          {nextBday && (
            <li className="curtain__stat">
              Next birthday{" "}
              <Link to={`/members/${nextBday.member.slug}`} viewTransition className="curtain__stat-num">
                {nextBday.member.nickname}
              </Link>{" "}
              {nextBday.inDays === 0 ? "today" : `in ${nextBday.inDays} days`}
            </li>
          )}
        </ul>

        <div className="container curtain__base">
          <span>© {new Date().getFullYear()} Avonera48 · an unofficial fan site, not affiliated with JKT48 or its management</span>
          <SourceNote live="Data: jkt48connect.com · times in WIB" />
        </div>
      </div>
    </footer>
  );
}
