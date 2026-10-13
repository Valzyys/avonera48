import { useRef, useState } from "react";
import { Link } from "react-router";
import { CheckoutDialog, type CheckoutItem } from "@/components/domain/CheckoutDialog";
import { Icon, Skeleton } from "@/components/ui";
import { rupiah } from "@/features/members/api";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { DashHead, useDash } from "@/layouts/DashboardLayout";
import { enter, useGSAP } from "@/motion/gsap";
import { cx, formatDate } from "@/utils/format";

const PERKS = ["Every theater show in the room", "No ticket needed per show", "Live chat with other members", "Extends from your current end date"];

export default function MembershipPage() {
  useDocumentTitle("Membership");
  const { catalog, reloadCatalog } = useDash();
  const ref = useRef<HTMLDivElement>(null);
  const [buy, setBuy] = useState<CheckoutItem | null>(null);
  const m = catalog?.membership;
  const total = m ? Math.max(1, Date.parse(m.expires_at) - Date.parse(m.started_at)) : 1;
  const left = m ? Math.max(0, Date.parse(m.expires_at) - Date.now()) : 0;
  const days = Math.ceil(left / 86400000);

  useGSAP(
    () => {
      enter(".mem-pass, .plan", { autoAlpha: 0, y: 18, duration: 0.6, stagger: 0.07, clearProps: "transform,opacity,visibility" });
    },
    { scope: ref, dependencies: [catalog?.plans.length] },
  );

  return (
    <div className="dash-page" ref={ref}>
      <DashHead kicker="Membership" title="One pass, every show" />

      <section className={cx("mem-pass", m && "is-active")} aria-label="Your membership">
        <div className="mem-pass__main">
          <span className="mem-pass__label">{m ? "Active membership" : "No membership yet"}</span>
          <span className="mem-pass__name">{m ? m.plan_name : "Pick a plan below"}</span>
          {m ? (
            <span className="mem-pass__meta">
              Valid until {formatDate(m.expires_at)} · {days} day{days === 1 ? "" : "s"} left
              {m.source === "jkt48connect" ? " · synced from JKT48Connect" : ""}
            </span>
          ) : (
            <span className="mem-pass__meta">A membership opens every theater show in the room for as long as it lasts.</span>
          )}
          {m && (
            <span className="mem-pass__bar" aria-hidden>
              <i style={{ width: `${Math.min(100, (left / total) * 100)}%` }} />
            </span>
          )}
        </div>
        <span className="mem-pass__stripes" aria-hidden>
          <i />
          <i />
          <i />
          <i />
        </span>
      </section>

      <h2 className="dash-sub">Plans</h2>
      {!catalog ? (
        <div className="plans">
          {[0, 1, 2].map((k) => (
            <Skeleton key={k} height={320} />
          ))}
        </div>
      ) : catalog.plans.length ? (
        <div className="plans">
          {catalog.plans.map((p, k) => {
            const soldOut = p.remaining === 0;
            const featured = catalog.plans.length > 1 && k === Math.min(1, catalog.plans.length - 1);
            const perDay = Math.round(p.price / p.duration_days);
            return (
              <article key={p.id} className={cx("plan", featured && "is-featured", soldOut && "is-sold")}>
                {featured && <span className="plan__flag">Popular</span>}
                <h3 className="plan__name">{p.name}</h3>
                <p className="plan__desc">{p.description || `${p.duration_days} days of every show.`}</p>
                <p className="plan__price">
                  <b>{rupiah(p.price)}</b>
                  <span>/ {p.duration_days} days</span>
                </p>
                <p className="meta">≈ {rupiah(perDay)} a day</p>
                <ul className="plan__perks">
                  {PERKS.map((x) => (
                    <li key={x}>
                      <Icon name="check" size={14} /> {x}
                    </li>
                  ))}
                </ul>
                <div className="plan__foot">
                  {p.remaining != null && <span className="meta">{soldOut ? "Sold out" : `${p.remaining} left`}</span>}
                  <button
                    type="button"
                    className={cx("dash-btn", featured ? "dash-btn--primary" : "dash-btn--outline")}
                    disabled={soldOut}
                    onClick={() => setBuy({ kind: "membership", id: p.id, title: p.name, subtitle: `${p.duration_days} days · every show`, price: p.price })}
                  >
                    {soldOut ? "Sold out" : m ? "Extend" : "Choose plan"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="dash-empty">
          No membership plans are on sale right now. You can still buy <Link to="/dashboard/schedule">single show tickets</Link>.
        </p>
      )}

      <CheckoutDialog item={buy} onClose={() => (setBuy(null), reloadCatalog())} paymentsReady={!!catalog?.payments} />
    </div>
  );
}
