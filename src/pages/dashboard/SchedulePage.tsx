import { useRef, useState } from "react";
import { Link } from "react-router";
import { CheckoutDialog, type CheckoutItem } from "@/components/domain/CheckoutDialog";
import { LineupAvatars } from "@/components/domain/Cards";
import { ShowArt } from "@/components/media/Media";
import { Skeleton } from "@/components/ui";
import { accessOf, priceOf, rupiah } from "@/features/members/api";
import { useClock } from "@/hooks/useClock";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { DashHead, useDash } from "@/layouts/DashboardLayout";
import { enter, useGSAP } from "@/motion/gsap";
import { cx, formatDate, formatTime, formatWeekday } from "@/utils/format";
import { teamLabel } from "@/utils/team";
import { isOnStage, ShowAction } from "./parts";

type Filter = "all" | "mine" | "sale";

export default function SchedulePage() {
  useDocumentTitle("Shows");
  const { catalog, shows, showsError, reloadCatalog } = useDash();
  const now = useClock();
  const ref = useRef<HTMLDivElement>(null);
  const [buy, setBuy] = useState<CheckoutItem | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  // The show on air comes first.
  const list = [...(shows ?? [])].sort((a, b) => Number(b.onAir) - Number(a.onAir)).filter((s) => (filter === "mine" ? !!accessOf(catalog, s.slug) : filter === "sale" ? !accessOf(catalog, s.slug) && priceOf(catalog, s.slug) != null : true));

  useGSAP(
    () => {
      enter(".sched-card", { autoAlpha: 0, y: 18, duration: 0.6, stagger: 0.05, clearProps: "transform,opacity,visibility" });
    },
    { scope: ref, dependencies: [list.length, filter] },
  );

  return (
    <div className="dash-page" ref={ref}>
      <DashHead kicker="Theater" title="Shows">
        <div className="seg" role="tablist" aria-label="Filter shows">
          {(
            [
              ["all", "All"],
              ["sale", "On sale"],
              ["mine", "My tickets"],
            ] as const
          ).map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={filter === k} className={cx(filter === k && "is-active")} onClick={() => setFilter(k)}>
              {label}
            </button>
          ))}
        </div>
      </DashHead>

      {catalog?.membership && (
        <p className="dash-note">
          Your <b>{catalog.membership.plan_name}</b> membership covers every show until {formatDate(catalog.membership.expires_at)}.
        </p>
      )}

      {!shows && showsError ? (
        <p className="dash-empty">The show list couldn’t be loaded. It refreshes on its own every minute.</p>
      ) : !shows ? (
        <div className="sched-grid">
          {[0, 1, 2, 3].map((k) => (
            <Skeleton key={k} height={360} />
          ))}
        </div>
      ) : list.length ? (
        <div className="sched-grid">
          {list.map((s) => {
            const live = isOnStage(s, now);
            const price = priceOf(catalog, s.slug);
            return (
              <article key={s.slug} className={cx("sched-card", live && "is-live")}>
                <Link to={`/dashboard/schedule/${s.slug}`} className="sched-card__art" aria-label={`${s.title}: details`}>
                  <ShowArt show={s} use="banner" />
                  <span className="sched-card__date">
                    <b className="num">{formatDate(s.startsAt, { day: "numeric", month: undefined, year: undefined })}</b>
                    <span>{formatDate(s.startsAt, { day: undefined, month: "short", year: undefined })}</span>
                  </span>
                  {live && (
                    <span className="sched-card__live">
                      <i className="live-dot" aria-hidden /> On stage
                      {s.viewers > 0 && <span className="sched-card__viewers">· {s.viewers.toLocaleString("id-ID")} watching</span>}
                    </span>
                  )}
                </Link>
                <div className="sched-card__body">
                  <span className="sched-card__team">{teamLabel(s.team)}</span>
                  <h2 className="sched-card__title">
                    <Link to={`/dashboard/schedule/${s.slug}`}>{s.title}</Link>
                  </h2>
                  <p className="meta">
                    {formatWeekday(s.startsAt)} · {formatTime(s.startsAt)} WIB
                    {s.birthday ? ` · Birthday: ${s.birthday}` : s.birthdayShow && " · Birthday show"}
                  </p>
                  <LineupAvatars members={s.lineupMembers} max={7} size={26} />
                  <div className="sched-card__foot">
                    <span className="sched-card__price">{accessOf(catalog, s.slug) ? "" : price != null ? rupiah(price) : ""}</span>
                    <ShowAction show={s} catalog={catalog} now={now} onBuy={setBuy} />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="dash-empty">{filter === "mine" ? "You don’t have tickets for upcoming shows yet." : "No shows here right now."}</p>
      )}

      <CheckoutDialog item={buy} onClose={() => (setBuy(null), reloadCatalog())} paymentsReady={!!catalog?.payments} />
    </div>
  );
}
