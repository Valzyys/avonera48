import { useRef } from "react";
import { Link } from "react-router";
import { useResource } from "@/hooks/useResource";
import { gsap, reducedMotion, useGSAP } from "@/motion/gsap";
import { api } from "@/services";
import { formatDate, formatTime, formatWeekday } from "@/utils/format";

/**
 * Notice board under the header. Every item is a (sample) fact and a link.
 * GSAP runs the loop; hovering or focusing it eases the speed down to a
 * stop, and with reduced motion it is a plain sideways scroller.
 */
export function Ticker() {
  const live = useResource(() => api.listLiveNow(), []);
  const shows = useResource(() => api.listShows("upcoming"), []);
  const bdays = useResource(() => api.listBirthdays(7), []);
  const news = useResource(() => api.listNews(), []);
  const now = new Date(api.now).getTime();
  const root = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);

  const items: { key: string; to: string; tag: string; text: string; live?: boolean }[] = [];
  for (const l of live.data ?? []) items.push({ key: l.id, to: "/live", tag: "Live", text: `${l.member.nickname} on ${l.platform}`, live: true });
  const next = shows.data?.find((s) => new Date(s.startsAt).getTime() > now);
  if (next) items.push({ key: next.slug, to: `/theater/${next.slug}`, tag: "Theater", text: `${next.title}, ${formatWeekday(next.startsAt)} ${formatTime(next.startsAt)} WIB` });
  for (const b of bdays.data ?? [])
    items.push({
      key: `b-${b.member.slug}`,
      to: `/members/${b.member.slug}`,
      tag: "Birthday",
      text: `${b.member.nickname} ${b.inDays === 0 ? "today" : b.inDays === 1 ? "tomorrow" : formatDate(`${b.date}T12:00:00+07:00`, { year: undefined })}`,
    });
  const latest = news.data?.[0];
  if (latest) items.push({ key: latest.slug, to: `/news/${latest.slug}`, tag: "News", text: latest.title });

  useGSAP(
    () => {
      const el = track.current;
      const box = root.current;
      if (!el || !box || items.length === 0 || reducedMotion()) return;
      const half = el.scrollWidth / 2;
      const loop = gsap.to(el, { x: -half, duration: half / 40, ease: "none", repeat: -1 });
      const slow = () => gsap.to(loop, { timeScale: 0, duration: 0.6, ease: "power2.out", overwrite: true });
      const resume = () => gsap.to(loop, { timeScale: 1, duration: 0.8, ease: "power2.in", overwrite: true });
      box.addEventListener("pointerenter", slow);
      box.addEventListener("pointerleave", resume);
      box.addEventListener("focusin", slow);
      box.addEventListener("focusout", resume);
      return () => {
        box.removeEventListener("pointerenter", slow);
        box.removeEventListener("pointerleave", resume);
        box.removeEventListener("focusin", slow);
        box.removeEventListener("focusout", resume);
      };
    },
    { scope: root, dependencies: [items.length] },
  );

  if (items.length === 0) return <div className="ticker" aria-hidden />;
  return (
    <div ref={root} className="ticker" role="region" aria-label="Notices (sample data)">
      <span className="ticker__head">Notice</span>
      <div className="ticker__view">
        <div className="ticker__track" ref={track}>
          {[0, 1].map((copy) => (
            <ul key={copy} className="ticker__list" aria-hidden={copy === 1 || undefined}>
              {items.map((it) => (
                <li key={`${copy}-${it.key}`} className="ticker__item">
                  <Link to={it.to} viewTransition tabIndex={copy === 1 ? -1 : undefined}>
                    <span className={`ticker__tag ${it.live ? "is-live" : ""}`}>{it.tag}</span>
                    {it.text}
                  </Link>
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </div>
  );
}
