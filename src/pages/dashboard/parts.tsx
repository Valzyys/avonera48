import { Link } from "react-router";
import type { CheckoutItem } from "@/components/domain/CheckoutDialog";
import { Icon } from "@/components/ui";
import { accessOf, priceOf, rupiah, type Catalog, type OrderStatus } from "@/features/members/api";
import type { ShowSummary } from "@/services/types";
import { cx, formatDate, formatTime, formatWeekday } from "@/utils/format";

export const isOnStage = (s: ShowSummary, now: number) => Date.parse(s.startsAt) <= now && now < Date.parse(s.endsAt);

export const showWhen = (s: ShowSummary) => `${formatWeekday(s.startsAt)} ${formatDate(s.startsAt, { year: undefined })} · ${formatTime(s.startsAt)} WIB`;

const STATUS: Record<OrderStatus, { label: string; tone: string }> = {
  PENDING: { label: "Waiting for payment", tone: "warn" },
  SUCCESS: { label: "Paid", tone: "ok" },
  EXPIRED: { label: "Expired", tone: "mute" },
  CANCELLED: { label: "Cancelled", tone: "mute" },
  FAILED: { label: "Failed", tone: "bad" },
};

export function StatusChip({ status }: { status: OrderStatus }) {
  const s = STATUS[status];
  return <span className={`chip chip--${s.tone}`}>{s.label}</span>;
}

/**
 * The one action a show card offers a viewer: watch (on stage, has access),
 * owned / included (not yet on stage), continue a pending payment, or buy.
 */
export function ShowAction({ show, catalog, now, onBuy, size = "md" }: { show: ShowSummary; catalog: Catalog | undefined; now: number; onBuy: (item: CheckoutItem) => void; size?: "md" | "lg" }) {
  const access = accessOf(catalog, show.slug);
  const live = isOnStage(show, now);
  const pending = catalog?.pending.find((p) => p.kind === "ticket" && p.item_id === show.slug);
  const price = priceOf(catalog, show.slug);
  const cls = cx("dash-btn", size === "lg" && "dash-btn--lg");

  if (access && live) {
    return (
      <Link to={`/dashboard/watch/${show.slug}`} className={cx(cls, "dash-btn--live")}>
        <span className="dash-btn__dot" aria-hidden />
        Watch now
      </Link>
    );
  }
  if (access) {
    return (
      <span className={cx("dash-owned", size === "lg" && "dash-owned--lg")}>
        <Icon name="check" size={15} />
        {access === "ticket" ? "Ticket ready" : "Included in membership"}
      </span>
    );
  }
  if (pending) {
    return (
      <Link to={`/dashboard/pay/${pending.id}`} className={cx(cls, "dash-btn--warn")}>
        Finish payment
      </Link>
    );
  }
  if (price == null) return <span className="meta">Not on sale</span>;
  return (
    <button type="button" className={cx(cls, "dash-btn--primary")} onClick={() => onBuy({ kind: "ticket", id: show.slug, title: show.title, subtitle: showWhen(show), price })}>
      <Icon name="ticket" size={16} />
      {price === 0 ? "Get free ticket" : `Buy · ${rupiah(price)}`}
    </button>
  );
}
