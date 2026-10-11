import { useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { CheckoutDialog, type CheckoutItem } from "@/components/domain/CheckoutDialog";
import { MemberPhoto, oshi, ShowArt } from "@/components/media/Media";
import { Icon, Skeleton } from "@/components/ui";
import { accessOf, priceOf, rupiah } from "@/features/members/api";
import { useClock } from "@/hooks/useClock";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useDash } from "@/layouts/DashboardLayout";
import { enter, useGSAP } from "@/motion/gsap";
import { cx, formatDate, formatTime, formatWeekday } from "@/utils/format";
import { teamLabel } from "@/utils/team";
import { Countdown, isOnStage, ShowAction } from "./parts";

/** One show on sale: banner, facts, the buy / watch action, description and lineup. */
export default function ShowPage() {
  const { slug = "" } = useParams();
  const { catalog, shows, showsError, reloadCatalog } = useDash();
  const now = useClock();
  const ref = useRef<HTMLDivElement>(null);
  const [buy, setBuy] = useState<CheckoutItem | null>(null);
  const show = shows?.find((s) => s.slug === slug);
  useDocumentTitle(show ? show.title : "Show");

  useGSAP(
    () => {
      if (!show) return;
      enter(".sp-hero__art", { autoAlpha: 0, scale: 1.04, duration: 1 });
      enter(".sp-hero__body > *, .sp-side > *", { autoAlpha: 0, y: 16, stagger: 0.06, duration: 0.7, clearProps: "transform,opacity,visibility" });
      enter(".sp-lineup li", { autoAlpha: 0, y: 18, stagger: 0.03, duration: 0.6, delay: 0.25, clearProps: "transform,opacity,visibility" });
    },
    { scope: ref, dependencies: [!!show] },
  );

  if (!shows) {
    return <div className="dash-page">{showsError ? <p className="dash-empty">The show list couldn’t be loaded. Reload the page in a moment.</p> : <Skeleton height={420} />}</div>;
  }
  if (!show) {
    return (
      <div className="dash-page">
        <p className="dash-empty">
          That show isn’t on sale (it may have ended). <Link to="/dashboard/schedule">See all shows</Link>
        </p>
      </div>
    );
  }

  const live = isOnStage(show, now);
  const access = accessOf(catalog, show.slug);
  const price = priceOf(catalog, show.slug);

  return (
    <div className="dash-page sp" ref={ref}>
      <Link to="/dashboard/schedule" className="dash-link sp-back">
        <Icon name="arrowLeft" size={14} /> All shows
      </Link>

      <section className={cx("sp-hero", live && "is-live")}>
        <div className="sp-hero__art">
          <ShowArt show={show} use="banner" />
          {live && (
            <span className="sp-hero__live">
              <i aria-hidden /> On stage{show.viewers > 0 ? ` · ${show.viewers.toLocaleString("id-ID")} watching` : ""}
            </span>
          )}
        </div>
        <div className="sp-hero__body">
          <span className="sp-hero__team">{teamLabel(show.team)}</span>
          <h1 className="sp-hero__title">{show.title}</h1>
          <p className="sp-hero__when">
            {formatWeekday(show.startsAt)}, {formatDate(show.startsAt)} · {formatTime(show.startsAt)} WIB
          </p>
          <div className="sp-hero__chips">
            {show.birthday && (
              <span className="chip chip--warn">
                <Icon name="gift" size={13} /> Birthday · {show.birthday}
              </span>
            )}
            {!show.birthday && show.birthdayShow && <span className="chip chip--warn">Birthday show</span>}
            {show.code && <span className="chip chip--mute mono">{show.code}</span>}
            {access && <span className="chip chip--ok">{access === "ticket" ? "Ticket" : "Membership"}</span>}
          </div>
          {!live && Date.parse(show.startsAt) > now && <Countdown to={show.startsAt} now={now} />}
        </div>
      </section>

      <div className="sp-grid">
        <div className="sp-main">
          <section className="sp-section">
            <h2 className="dash-sub">About this show</h2>
            {show.blurb ? (
              show.blurb.split(/\n{2,}/).map((p, k) => <p key={k}>{p}</p>)
            ) : (
              <p className="meta">
                {show.title} on the JKT48 Theater stage{show.team && show.team !== "JKT48" ? ` with ${teamLabel(show.team)}` : ""}.
              </p>
            )}
          </section>

          <section className="sp-section">
            <h2 className="dash-sub">
              Lineup <span className="sp-count">{show.lineupMembers.length}</span>
            </h2>
            {show.lineupMembers.length ? (
              <ul className="lineup-grid sp-lineup">
                {show.lineupMembers.map((m) => (
                  <li key={m.slug}>
                    <Link to={`/members/${m.slug}`} className="lineup-card" style={oshi(m)}>
                      <MemberPhoto member={m} className="lineup-card__photo" />
                      <span className="lineup-card__name">{m.nickname}</span>
                      <span className="lineup-card__team">{teamLabel(m.team)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="meta">The lineup hasn’t been announced yet.</p>
            )}
          </section>
        </div>

        <aside className="sp-side" aria-label="Ticket">
          <div className="sp-ticket">
            <span className="sp-ticket__label">{access ? "You’re in" : "Ticket"}</span>
            <span className="sp-ticket__price">{access ? (access === "ticket" ? "Ticket owned" : "Membership") : price != null ? rupiah(price) : "Not on sale"}</span>
            <ShowAction show={show} catalog={catalog} now={now} onBuy={setBuy} size="lg" />
            {access && !live && (
              <Link to={`/dashboard/watch/${show.slug}`} className="dash-btn dash-btn--outline dash-btn--lg">
                Open the room
              </Link>
            )}
            {!access && (
              <Link to="/dashboard/membership" className="sp-ticket__alt">
                Or watch every show with a membership <Icon name="arrowRight" size={14} />
              </Link>
            )}
          </div>
          <dl className="sp-facts">
            <div>
              <dt>Date</dt>
              <dd>
                {formatWeekday(show.startsAt)}, {formatDate(show.startsAt)}
              </dd>
            </div>
            <div>
              <dt>Starts</dt>
              <dd>{formatTime(show.startsAt)} WIB</dd>
            </div>
            <div>
              <dt>Team</dt>
              <dd>{teamLabel(show.team)}</dd>
            </div>
            <div>
              <dt>Members</dt>
              <dd>{show.lineupMembers.length || "—"}</dd>
            </div>
          </dl>
        </aside>
      </div>

      <CheckoutDialog item={buy} onClose={() => (setBuy(null), reloadCatalog())} paymentsReady={!!catalog?.payments} />
    </div>
  );
}
