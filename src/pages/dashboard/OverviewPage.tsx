import { useRef, useState } from "react";
import { Link } from "react-router";
import { CheckoutDialog, type CheckoutItem } from "@/components/domain/CheckoutDialog";
import { LineupAvatars } from "@/components/domain/Cards";
import { ShowArt } from "@/components/media/Media";
import { Icon, Skeleton } from "@/components/ui";
import { rupiah, shop } from "@/features/members/api";
import { useClock } from "@/hooks/useClock";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useResource } from "@/hooks/useResource";
import { DashHead, useDash } from "@/layouts/DashboardLayout";
import { enter, useGSAP } from "@/motion/gsap";
import { teamLabel } from "@/utils/team";
import { formatDate } from "@/utils/format";
import { Countdown, ShowAction, showWhen, StatusChip } from "./parts";

const greeting = (now: number) => {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Jakarta" }).format(now));
  return h < 11 ? "Good morning" : h < 15 ? "Good afternoon" : h < 19 ? "Good evening" : "Good night";
};

export default function OverviewPage() {
  useDocumentTitle("Dashboard");
  const { user, catalog, shows, showsError, onAir, reloadCatalog } = useDash();
  const now = useClock();
  const ref = useRef<HTMLDivElement>(null);
  const orders = useResource(() => shop.orders(), []);
  const [buy, setBuy] = useState<CheckoutItem | null>(null);

  const list = shows ?? [];
  const live = onAir;
  const next = live ?? list[0];
  const membership = catalog?.membership;
  const daysLeft = membership ? Math.max(0, Math.ceil((Date.parse(membership.expires_at) - Date.now()) / 86400000)) : 0;
  const paid = (orders.data ?? []).filter((o) => o.status === "SUCCESS");
  const spent = paid.reduce((n, o) => n + o.amount, 0);

  useGSAP(
    () => {
      enter(".dash-head > *, .ov-hero, .ov-stat, .ov-comm, .ov-panel", { autoAlpha: 0, y: 16, duration: 0.7, stagger: 0.06, clearProps: "transform,opacity,visibility" });
    },
    { scope: ref },
  );

  return (
    <div className="dash-page" ref={ref}>
      <DashHead kicker="Dashboard" title={<>{greeting(now)}, <span className="grad-text">{user.name.split(" ")[0]}</span></>} />

      {next ? (
        <section className={`ov-hero ${live ? "is-live" : ""}`} aria-label={live ? "On stage now" : "Next show"}>
          <span className="ov-hero__art">
            <ShowArt show={next} use="banner" />
          </span>
          <div className="ov-hero__body">
            <span className="ov-hero__kicker">
              {live ? (
                <>
                  <i className="live-dot" aria-hidden /> On stage now
                </>
              ) : (
                "Next on stage"
              )}
            </span>
            <h2 className="ov-hero__title">
              <Link to={`/dashboard/schedule/${next.slug}`}>{next.title}</Link>
            </h2>
            <p className="ov-hero__meta">
              {showWhen(next)} · {teamLabel(next.team)}
              {live && live.viewers > 0 && ` · ${live.viewers.toLocaleString("id-ID")} watching`}
            </p>
            <LineupAvatars members={next.lineupMembers} max={8} size={28} />
            {!live && <Countdown to={next.startsAt} now={now} />}
            <div className="ov-hero__cta">
              <ShowAction show={next} catalog={catalog} now={now} onBuy={setBuy} size="lg" />
              <Link to="/dashboard/schedule" className="dash-link">
                All shows <Icon name="arrowRight" size={14} />
              </Link>
            </div>
          </div>
        </section>
      ) : shows || showsError ? (
        <section className="ov-hero ov-hero--empty" aria-label="Next show">
          <div className="ov-hero__body">
            <span className="ov-hero__kicker">Theater</span>
            <h2 className="ov-hero__title">{showsError ? "The show list is taking a break" : "No shows announced yet"}</h2>
            <p className="ov-hero__meta">{showsError ? "It refreshes on its own every minute." : "New shows appear here as soon as they go on sale."}</p>
          </div>
        </section>
      ) : (
        <Skeleton height={260} className="ov-hero" />
      )}

      <div className="ov-stats">
        <Link to="/dashboard/membership" className={`ov-stat ${membership ? "is-on" : ""}`}>
          <span className="ov-stat__label">Membership</span>
          <span className="ov-stat__value">{membership ? `${daysLeft} days` : "—"}</span>
          <span className="ov-stat__note">{membership ? `${membership.plan_name} · until ${formatDate(membership.expires_at, { year: undefined })}` : "Watch every show with one pass"}</span>
        </Link>
        <Link to="/dashboard/schedule" className="ov-stat">
          <span className="ov-stat__label">Tickets</span>
          <span className="ov-stat__value">{catalog ? catalog.tickets.length : "…"}</span>
          <span className="ov-stat__note">Show tickets you own</span>
        </Link>
        <Link to="/dashboard/transactions" className="ov-stat">
          <span className="ov-stat__label">Spent</span>
          <span className="ov-stat__value">{orders.data ? rupiah(spent) : "…"}</span>
          <span className="ov-stat__note">{paid.length} paid order{paid.length === 1 ? "" : "s"}</span>
        </Link>
      </div>

      {catalog?.community && (catalog.community.channel || catalog.community.group || catalog.community.group_locked) && (
        <section className="ov-community" aria-label="Community">
          {catalog.community.channel && (
            <a className="ov-comm" href={catalog.community.channel} target="_blank" rel="noopener noreferrer">
              <span className="ov-comm__icon" aria-hidden>
                <Icon name="whatsapp" size={22} />
              </span>
              <span className="ov-comm__body">
                <span className="ov-comm__kicker">WhatsApp channel</span>
                <span className="ov-comm__title">Follow Avonera48</span>
                <span className="meta">Show announcements, ticket drops and site news, straight to WhatsApp.</span>
              </span>
              <span className="ov-comm__cta">
                Follow <Icon name="arrowUpRight" size={14} />
              </span>
            </a>
          )}
          {catalog.community.group ? (
            <a className="ov-comm is-members" href={catalog.community.group} target="_blank" rel="noopener noreferrer">
              <span className="ov-comm__icon" aria-hidden>
                <Icon name="users" size={22} />
              </span>
              <span className="ov-comm__body">
                <span className="ov-comm__kicker">Members’ group · WhatsApp</span>
                <span className="ov-comm__title">Join the members’ group</span>
                <span className="meta">Watch-along chat, reminders before each show and help from the team. For members only, please don’t share the link.</span>
              </span>
              <span className="ov-comm__cta">
                Join <Icon name="arrowUpRight" size={14} />
              </span>
            </a>
          ) : (
            catalog.community.group_locked && (
              <Link className="ov-comm is-locked" to="/dashboard/membership">
                <span className="ov-comm__icon" aria-hidden>
                  <Icon name="lock" size={20} />
                </span>
                <span className="ov-comm__body">
                  <span className="ov-comm__kicker">Members’ group · WhatsApp</span>
                  <span className="ov-comm__title">Unlocks with a membership</span>
                  <span className="meta">Members get the invite to our WhatsApp group: watch-along chat and show reminders.</span>
                </span>
                <span className="ov-comm__cta">
                  See plans <Icon name="arrowRight" size={14} />
                </span>
              </Link>
            )
          )}
        </section>
      )}

      <div className="ov-grid">
        <section className="ov-panel">
          <div className="ov-panel__head">
            <h2>Coming up</h2>
            <Link to="/dashboard/schedule" className="dash-link">
              Shows <Icon name="arrowRight" size={14} />
            </Link>
          </div>
          <ul className="ov-shows">
            {list
              .filter((s) => s !== next)
              .slice(0, 5)
              .map((s) => (
              <li key={s.slug} className="ov-show">
                <span className="ov-show__date">
                  <span className="num">{formatDate(s.startsAt, { day: "numeric", month: undefined, year: undefined })}</span>
                  <span>{formatDate(s.startsAt, { day: undefined, month: "short", year: undefined })}</span>
                </span>
                <span className="ov-show__main">
                  <Link to={`/dashboard/schedule/${s.slug}`} className="ov-show__title">
                    {s.title}
                  </Link>
                  <span className="meta">{showWhen(s)}</span>
                </span>
                <ShowAction show={s} catalog={catalog} now={now} onBuy={setBuy} />
              </li>
            ))}
            {shows && list.length <= 1 && <li className="meta">Nothing else announced yet.</li>}
          </ul>
        </section>

        <section className="ov-panel">
          <div className="ov-panel__head">
            <h2>Recent transactions</h2>
            <Link to="/dashboard/transactions" className="dash-link">
              All <Icon name="arrowRight" size={14} />
            </Link>
          </div>
          {orders.data?.length ? (
            <ul className="ov-orders">
              {orders.data.slice(0, 5).map((o) => (
                <li key={o.id}>
                  <Link to={`/dashboard/pay/${o.id}`} className="ov-order">
                    <span className="ov-order__icon" aria-hidden>
                      <Icon name={o.kind === "membership" ? "bolt" : "ticket"} size={16} />
                    </span>
                    <span className="ov-order__main">
                      <span className="ov-order__title">{o.item_title}</span>
                      <span className="meta">{formatDate(o.created_at)}</span>
                    </span>
                    <span className="ov-order__end">
                      <span className="ov-order__amount">{rupiah(o.pay_amount ?? o.amount)}</span>
                      <StatusChip status={o.status} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="meta ov-empty">{orders.data ? "No transactions yet. Your tickets and memberships will show up here." : "Loading…"}</p>
          )}
        </section>
      </div>

      <CheckoutDialog item={buy} onClose={() => (setBuy(null), reloadCatalog())} paymentsReady={!!catalog?.payments} />
    </div>
  );
}
