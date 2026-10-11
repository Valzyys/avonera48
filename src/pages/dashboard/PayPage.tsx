import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { Button, CopyButton, ErrorState, Icon, Skeleton } from "@/components/ui";
import { ApiError, rupiah, shop, type Order } from "@/features/members/api";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useDash } from "@/layouts/DashboardLayout";
import { gsap, useGSAP } from "@/motion/gsap";
import { cx, formatDateTime } from "@/utils/format";
import { StatusChip } from "./parts";

/** Payment for one order: QRIS while pending, a receipt once paid. */
export default function PayPage() {
  const { id = "" } = useParams();
  const { reloadCatalog } = useDash();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [now, setNow] = useState(Date.now());
  const ref = useRef<HTMLDivElement>(null);
  useDocumentTitle(order?.status === "SUCCESS" ? "Payment received" : "Payment");

  // Ask the server every 4 s while the payment is open; it checks the gateway.
  useEffect(() => {
    let live = true;
    let timer = 0;
    const tick = async () => {
      try {
        const o = await shop.order(id);
        if (!live) return;
        setOrder((prev) => {
          if (prev?.status === "PENDING" && o.status === "SUCCESS") reloadCatalog();
          return o;
        });
        setError(null);
        if (o.status === "PENDING") timer = window.setTimeout(tick, 4000);
      } catch (e) {
        if (!live) return;
        setError(e instanceof Error ? e : new Error(String(e)));
        if (!(e instanceof ApiError && e.status === 404)) timer = window.setTimeout(tick, 6000);
      }
    };
    tick();
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [id, reloadCatalog]);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  useGSAP(
    () => {
      if (order?.status !== "SUCCESS") return;
      gsap.fromTo(".pay-done__ring", { scale: 0.4, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.7, ease: "back.out(1.8)" });
      gsap.fromTo(".pay-done__check path", { strokeDashoffset: 40 }, { strokeDashoffset: 0, duration: 0.6, delay: 0.25, ease: "power2.out" });
      gsap.fromTo(".pay-confetti i", { y: 0, autoAlpha: 1 }, { y: () => 120 + Math.random() * 120, x: () => (Math.random() - 0.5) * 260, rotate: () => Math.random() * 360, autoAlpha: 0, duration: 1.6, ease: "power2.out", stagger: 0.01 });
    },
    { scope: ref, dependencies: [order?.status] },
  );

  if (error && !order) {
    return (
      <div className="dash-page">
        {error instanceof ApiError && error.status === 404 ? (
          <p className="dash-empty">
            That payment doesn’t exist. <Link to="/dashboard/transactions">See your transactions</Link>
          </p>
        ) : (
          <ErrorState error={error} />
        )}
      </div>
    );
  }
  if (!order) {
    return (
      <div className="dash-page pay">
        <Skeleton height={520} />
      </div>
    );
  }

  const left = order.expires_at ? Math.max(0, Date.parse(order.expires_at) - now) : 0;
  const mm = String(Math.floor(left / 60000)).padStart(2, "0");
  const ss = String(Math.floor((left % 60000) / 1000)).padStart(2, "0");
  const amount = order.pay_amount ?? order.amount;
  const unique = order.pay_amount != null ? order.pay_amount - order.amount : 0;

  const cancel = async () => {
    setCancelling(true);
    try {
      setOrder(await shop.cancel(order.id));
      reloadCatalog();
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="dash-page pay" ref={ref}>
      <div className="pay-crumbs">
        <Link to="/dashboard/transactions" className="dash-link">
          <Icon name="arrowLeft" size={14} /> Transactions
        </Link>
        <StatusChip status={order.status} />
      </div>

      <div className="pay-layout">
        <section className={cx("pay-main", `is-${order.status.toLowerCase()}`)}>
          {order.status === "PENDING" ? (
            <>
              <div className="pay-main__head">
                <span className="pay-main__kicker">Scan to pay with QRIS</span>
                <span className={cx("pay-timer", left < 120000 && "is-low")} role="timer">
                  <Icon name="history" size={15} /> {left > 0 ? `${mm}:${ss}` : "Expiring…"}
                </span>
              </div>
              <div className="pay-qr">
                {order.qr_image ? <img src={order.qr_image} alt={`QRIS code for ${rupiah(amount)}`} referrerPolicy="no-referrer" /> : <Skeleton height="100%" />}
                <span className="pay-qr__corner pay-qr__corner--a" aria-hidden />
                <span className="pay-qr__corner pay-qr__corner--b" aria-hidden />
                <span className="pay-qr__corner pay-qr__corner--c" aria-hidden />
                <span className="pay-qr__corner pay-qr__corner--d" aria-hidden />
              </div>
              <div className="pay-amount">
                <span className="meta">Pay exactly</span>
                <span className="pay-amount__value">
                  {rupiah(amount)}
                  <CopyButton value={String(amount)} what="Amount" />
                </span>
                {unique > 0 && <span className="meta">Includes a unique code of {rupiah(unique)} so your payment is matched automatically.</span>}
              </div>
              <ol className="pay-steps">
                <li>Open any banking or e-wallet app that supports QRIS.</li>
                <li>Scan the code above, or open the payment page on your phone.</li>
                <li>Pay the exact amount. This page updates by itself.</li>
              </ol>
              <div className="pay-actions">
                {order.payment_url && (
                  <a className="dash-btn dash-btn--primary dash-btn--lg" href={order.payment_url} target="_blank" rel="noreferrer noopener">
                    Open payment page <Icon name="arrowUpRight" size={16} />
                  </a>
                )}
                <Button variant="ghost" onClick={cancel} loading={cancelling}>
                  Cancel payment
                </Button>
              </div>
              <p className="pay-wait">
                <span className="pay-wait__dot" aria-hidden /> Waiting for your payment…
              </p>
            </>
          ) : order.status === "SUCCESS" ? (
            <div className="pay-done">
              <span className="pay-confetti" aria-hidden>
                {Array.from({ length: 36 }, (_, k) => (
                  <i key={k} style={{ background: ["#e5679c", "#4b8fe2", "#ef7a3c", "#3aa877"][k % 4] }} />
                ))}
              </span>
              <span className="pay-done__ring">
                <svg className="pay-done__check" viewBox="0 0 24 24" width="44" height="44" aria-hidden>
                  <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="40" />
                </svg>
              </span>
              <h1 className="pay-done__title">Payment received</h1>
              <p className="meta">
                {order.kind === "membership" ? "Your membership is active. Every show is open to you." : "Your ticket is ready. See you in the theater room."}
              </p>
              <div className="pay-actions">
                {order.kind === "ticket" ? (
                  <Link to={`/dashboard/watch/${order.item_id}`} className="dash-btn dash-btn--primary dash-btn--lg">
                    Go to the watch room
                  </Link>
                ) : (
                  <Link to="/dashboard/schedule" className="dash-btn dash-btn--primary dash-btn--lg">
                    See shows
                  </Link>
                )}
                <Link to="/dashboard" className="dash-btn dash-btn--outline dash-btn--lg">
                  Overview
                </Link>
              </div>
            </div>
          ) : (
            <div className="pay-done is-off">
              <span className="pay-done__ring is-off">
                <Icon name="close" size={36} />
              </span>
              <h1 className="pay-done__title">{order.status === "EXPIRED" ? "Payment expired" : order.status === "CANCELLED" ? "Payment cancelled" : "Payment failed"}</h1>
              <p className="meta">Nothing was charged for this order. You can start a new one any time.</p>
              <div className="pay-actions">
                <Link to={order.kind === "membership" ? "/dashboard/membership" : "/dashboard/schedule"} className="dash-btn dash-btn--primary dash-btn--lg">
                  Buy again
                </Link>
              </div>
            </div>
          )}
          {error && <p className="checkout__error">{error.message}</p>}
        </section>

        <aside className="pay-receipt" aria-label="Order details">
          <span className="pay-receipt__kicker">{order.kind === "membership" ? "Membership" : "Show ticket"}</span>
          <h2 className="pay-receipt__title">{order.item_title}</h2>
          <dl className="pay-receipt__list">
            <div>
              <dt>Price</dt>
              <dd>{rupiah(order.base_amount)}</dd>
            </div>
            {order.discount > 0 && (
              <div className="is-discount">
                <dt>Voucher {order.voucher}</dt>
                <dd>−{rupiah(order.discount)}</dd>
              </div>
            )}
            {unique > 0 && (
              <div>
                <dt>Unique code</dt>
                <dd>{rupiah(unique)}</dd>
              </div>
            )}
            <div className="is-total">
              <dt>Total</dt>
              <dd>{rupiah(amount)}</dd>
            </div>
          </dl>
          <span className="pay-receipt__tear" aria-hidden />
          <dl className="pay-receipt__meta">
            <div>
              <dt>Order</dt>
              <dd className="mono">{order.id}</dd>
            </div>
            {order.trx_id && (
              <div>
                <dt>Transaction</dt>
                <dd className="mono">{order.trx_id}</dd>
              </div>
            )}
            <div>
              <dt>Created</dt>
              <dd>{formatDateTime(order.created_at)} WIB</dd>
            </div>
            {order.paid_at && (
              <div>
                <dt>Paid</dt>
                <dd>{formatDateTime(order.paid_at)} WIB</dd>
              </div>
            )}
            {order.status === "PENDING" && order.expires_at && (
              <div>
                <dt>Pay before</dt>
                <dd>{formatDateTime(order.expires_at)} WIB</dd>
              </div>
            )}
          </dl>
        </aside>
      </div>
    </div>
  );
}
