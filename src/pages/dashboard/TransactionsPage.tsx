import { useMemo, useState } from "react";
import { Link } from "react-router";
import { ErrorState, Icon, SkeletonRows } from "@/components/ui";
import { rupiah, shop, type OrderStatus } from "@/features/members/api";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useResource } from "@/hooks/useResource";
import { DashHead } from "@/layouts/DashboardLayout";
import { cx, formatDateTime } from "@/utils/format";
import { StatusChip } from "./parts";

const FILTERS: [OrderStatus | "ALL", string][] = [
  ["ALL", "All"],
  ["PENDING", "Waiting"],
  ["SUCCESS", "Paid"],
  ["EXPIRED", "Expired"],
  ["CANCELLED", "Cancelled"],
];

export default function TransactionsPage() {
  useDocumentTitle("Transactions");
  const orders = useResource(() => shop.orders(), []);
  const [filter, setFilter] = useState<OrderStatus | "ALL">("ALL");
  const list = useMemo(() => (orders.data ?? []).filter((o) => filter === "ALL" || o.status === filter), [orders.data, filter]);

  return (
    <div className="dash-page">
      <DashHead kicker="History" title="Transactions">
        <div className="seg" role="tablist" aria-label="Filter transactions">
          {FILTERS.map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={filter === k} className={cx(filter === k && "is-active")} onClick={() => setFilter(k)}>
              {label}
            </button>
          ))}
        </div>
      </DashHead>

      {orders.status === "error" ? (
        <ErrorState error={orders.error} onRetry={orders.reload} />
      ) : !orders.data ? (
        <SkeletonRows rows={5} />
      ) : list.length ? (
        <div className="tx-table" role="table" aria-label="Transactions">
          <div className="tx-row tx-row--head" role="row">
            <span role="columnheader">Item</span>
            <span role="columnheader">Date</span>
            <span role="columnheader">Order</span>
            <span role="columnheader">Amount</span>
            <span role="columnheader">Status</span>
          </div>
          {list.map((o) => (
            <Link key={o.id} to={`/dashboard/pay/${o.id}`} className="tx-row" role="row">
              <span className="tx-item" role="cell">
                <span className="tx-item__icon" aria-hidden>
                  <Icon name={o.kind === "membership" ? "bolt" : "ticket"} size={16} />
                </span>
                <span>
                  <span className="tx-item__title">{o.item_title}</span>
                  <span className="meta">{o.kind === "membership" ? "Membership" : "Show ticket"}</span>
                </span>
              </span>
              <span className="tx-cell meta" role="cell">
                {formatDateTime(o.created_at)}
              </span>
              <span className="tx-cell mono tx-id" role="cell">
                {o.trx_id ?? o.id}
              </span>
              <span className="tx-cell tx-amount" role="cell">
                {rupiah(o.pay_amount ?? o.amount)}
                {o.discount > 0 && <span className="meta">−{rupiah(o.discount)} voucher</span>}
              </span>
              <span className="tx-cell" role="cell">
                <StatusChip status={o.status} />
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="dash-empty">{filter === "ALL" ? "No transactions yet." : "Nothing with this status."}</p>
      )}
    </div>
  );
}
