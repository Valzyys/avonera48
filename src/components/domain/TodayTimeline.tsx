import { useRef, type CSSProperties } from "react";
import { Link } from "react-router";
import { Avatar, oshi } from "@/components/media/Media";
import { Icon } from "@/components/ui";
import type { LiveItem, ShowSummary } from "@/services";
import { gsap, reducedMotion, useGSAP } from "@/motion/gsap";
import { cx, formatTime } from "@/utils/format";

const HOUR = 3_600_000;
const END_H = 24;

interface Props {
  dayStartMs: number; // 00:00 WIB of the day
  now: number;
  streams: LiveItem[]; // today's streams, live or ended
  shows: ShowSummary[]; // today's theater shows
  onOpen: (s: LiveItem) => void;
  /** Allowed to animate (e.g. the intro has finished). */
  play: boolean;
}

/**
 * Today, as a broadcast schedule: one lane per member who streamed today,
 * a theater lane, and a red "now" line. When it scrolls into view a GSAP
 * timeline replays the day: the now-line runs in from the left edge and every bar draws
 * itself as the line passes its start time.
 */
export function TodayTimeline({ dayStartMs, now, streams, shows, onOpen, play }: Props) {
  // Window: from an hour before the first stream (06:00 at the latest, 16:00
  // at the earliest so a quiet day still reads as a day) to midnight.
  const first = Math.min(now, ...streams.map((s) => new Date(s.startedAt).getTime()), ...shows.map((s) => new Date(s.startsAt).getTime()));
  const START_H = Math.max(6, Math.min(16, Math.floor((first - dayStartMs) / HOUR) - 1));
  const step = END_H - START_H <= 10 ? 1 : 2;
  const from = dayStartMs + START_H * HOUR;
  const span = (END_H - START_H) * HOUR;
  const pos = (t: number) => Math.min(1, Math.max(0, (t - from) / span));
  const nowPos = pos(now);
  const hours = Array.from({ length: (END_H - START_H) / step + 1 }, (_, k) => START_H + k * step);

  // One lane per member, earliest stream first.
  const lanes = new Map<string, LiveItem[]>();
  for (const s of [...streams].sort((a, b) => a.startedAt.localeCompare(b.startedAt))) {
    lanes.set(s.member.slug, [...(lanes.get(s.member.slug) ?? []), s]);
  }

  const root = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const D = 1.3; // seconds for the line to travel to now

  useGSAP(
    () => {
      const el = root.current;
      const sc = scroller.current;
      if (!el || !sc || !play) return;
      // On narrow screens the track scrolls; bring "now" into view.
      const focusNow = (smooth: boolean) => {
        if (sc.scrollWidth <= sc.clientWidth) return;
        sc.scrollTo({ left: Math.max(0, sc.scrollWidth * nowPos - sc.clientWidth * 0.6), behavior: smooth ? "smooth" : "auto" });
      };
      if (reducedMotion()) {
        focusNow(false);
        gsap.from(el.querySelectorAll("[data-start]"), { autoAlpha: 0, duration: 0.5, stagger: 0.03 });
        return;
      }
      const at = (t: number) => (pos(t) / Math.max(nowPos, 0.01)) * D;
      const tl = gsap.timeline({ paused: true, onComplete: () => focusNow(true) });
      tl.fromTo(el, { "--p": 0 }, { "--p": nowPos, duration: D, ease: "power2.inOut" }, 0);
      el.querySelectorAll<HTMLElement>("[data-start]").forEach((bar) => {
        const t = at(Number(bar.dataset.start));
        if (bar.classList.contains("tl__bar-label")) tl.from(bar, { autoAlpha: 0, x: -6, duration: 0.4 }, t + 0.25);
        else tl.from(bar, { scaleX: 0, transformOrigin: "left center", duration: 0.5, ease: "power2.out" }, t);
      });
      tl.from(el.querySelectorAll(".tl__label"), { autoAlpha: 0, x: -10, duration: 0.5, stagger: 0.05 }, 0);
      // start when the board is actually on screen
      gsap.timeline({ scrollTrigger: { trigger: el, start: "top 85%", once: true, onEnter: () => void tl.play() } });
    },
    { scope: root, dependencies: [play] },
  );

  return (
    <div ref={root} className="tl" style={{ ["--now" as string]: nowPos, ["--p" as string]: nowPos } as CSSProperties}>
      <div className="tl__scroll" ref={scroller}>
        <div className="tl__inner">
          <div className="tl__axis" aria-hidden>
            <span className="tl__label-col" />
            <span className="tl__ticks">
              {hours.map((h) => (
                <span key={h} className="tl__tick mono" style={{ left: `${((h - START_H) / (END_H - START_H)) * 100}%` }}>
                  {String(h % 24).padStart(2, "0")}:00
                </span>
              ))}
            </span>
          </div>

          <ul className="tl__rows">
            {[...lanes.entries()].map(([slug, items]) => {
              const m = items[0].member;
              return (
                <li key={slug} className="tl__row">
                  <Link to={`/members/${slug}`} viewTransition className="tl__label">
                    <Avatar member={m} size={26} />
                    <span className="tl__name">{m.nickname}</span>
                  </Link>
                  <span className="tl__track">
                    {items.map((s) => {
                      const start = new Date(s.startedAt).getTime();
                      const end = s.status === "live" ? now : new Date(s.endedAt!).getTime();
                      const left = pos(start);
                      const width = Math.max(pos(end) - left, 0.006);
                      const after = s.status === "live" ? `${s.title} · live` : `${formatTime(s.startedAt)} ${s.title}`;
                      return [
                        <button
                          key={s.id}
                          type="button"
                          className={cx("tl__bar", s.status === "live" ? "is-live" : "is-ended", s.platform === "SHOWROOM" ? "is-sr" : "is-idn")}
                          data-start={start}
                          style={{ left: `${left * 100}%`, width: `${width * 100}%`, ...oshi(m) }}
                          onClick={() => onOpen(s)}
                          title={`${m.nickname} · ${s.title} · ${formatTime(s.startedAt)}${s.endedAt ? `–${formatTime(s.endedAt)}` : " → now"}`}
                        >
                          <span className="sr-only">
                            {m.nickname}, {s.platform}, {s.status === "live" ? "live now" : `${formatTime(s.startedAt)} to ${formatTime(s.endedAt!)}`}
                          </span>
                        </button>,
                        <span
                          key={`${s.id}-l`}
                          className={cx("tl__bar-label", s.status === "live" && "is-live")}
                          data-start={start}
                          style={
                            left + width > 0.68
                              ? { right: `calc(${(1 - left) * 100}% + 8px)`, textAlign: "right" }
                              : { left: `calc(${(left + width) * 100}% + 8px)` }
                          }
                          aria-hidden
                        >
                          {after}
                        </span>,
                      ];
                    })}
                  </span>
                </li>
              );
            })}

            <li className="tl__row tl__row--theater">
              <Link to="/theater" viewTransition className="tl__label">
                <span className="tl__stage" aria-hidden>
                  <Icon name="ticket" size={15} />
                </span>
                <span className="tl__name">Theater</span>
              </Link>
              <span className="tl__track">
                {shows.length === 0 && <span className="tl__empty meta">No show today</span>}
                {shows.map((sh) => {
                  const start = new Date(sh.startsAt).getTime();
                  const left = pos(start);
                  const width = pos(start + 2 * HOUR) - left;
                  return (
                    <Link
                      key={sh.slug}
                      to={`/theater/${sh.slug}`}
                      viewTransition
                      className={cx("tl__show", start > now && "is-future")}
                      data-start={Math.min(start, now)}
                      style={{ left: `${left * 100}%`, width: `${width * 100}%` }}
                    >
                      <span className="tl__bar-text">
                        {formatTime(sh.startsAt)} · {sh.title}
                      </span>
                    </Link>
                  );
                })}
              </span>
            </li>
          </ul>

          <span className="tl__now" aria-hidden>
            <span className="tl__now-label mono">{formatTime(new Date(now).toISOString())}</span>
          </span>
        </div>
      </div>
      <p className="tl__legend meta">
        <span className="tl__key tl__key--oshi" /> Stream, coloured by team
        <span className="tl__key tl__key--live" /> Live now
        <span className="tl__key tl__key--show" /> Theater show
        <span className="tl__legend-note">Sample snapshot · times in WIB</span>
      </p>
    </div>
  );
}
