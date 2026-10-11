import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Button, Dialog, Icon } from "@/components/ui";
import { ApiError, rupiah, shop } from "@/features/members/api";

export interface CheckoutItem {
  kind: "ticket" | "membership";
  id: string;
  title: string;
  subtitle: string;
  price: number;
}

/**
 * Order summary with a voucher field. "Continue" creates the payment on the
 * server and moves to /dashboard/pay/<id>.
 */
export function CheckoutDialog({ item, onClose, paymentsReady }: { item: CheckoutItem | null; onClose: () => void; paymentsReady: boolean }) {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [applied, setApplied] = useState<{ code: string; discount: number; amount: number } | null>(null);
  const [voucherError, setVoucherError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCode("");
    setApplied(null);
    setVoucherError(null);
    setError(null);
  }, [item]);

  const apply = async () => {
    if (!item || !code.trim()) return;
    setChecking(true);
    setVoucherError(null);
    try {
      setApplied(await shop.voucher(code.trim(), item.kind, item.id));
    } catch (e) {
      setApplied(null);
      setVoucherError(e instanceof ApiError ? e.message : "That voucher couldn’t be checked.");
    } finally {
      setChecking(false);
    }
  };

  const pay = async () => {
    if (!item) return;
    setBusy(true);
    setError(null);
    try {
      const r = await shop.checkout(item.kind, item.id, applied?.code);
      navigate(`/dashboard/pay/${r.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "The payment couldn’t be started.");
      setBusy(false);
    }
  };

  const total = applied ? applied.amount : (item?.price ?? 0);

  return (
    <Dialog
      open={!!item}
      onClose={onClose}
      dismissible={!busy}
      title={item?.kind === "membership" ? "Membership checkout" : "Ticket checkout"}
      description="Pay by QRIS with any bank or e-wallet app."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" onClick={pay} loading={busy} disabled={!paymentsReady}>
            {total === 0 ? "Claim for free" : `Pay ${rupiah(total)}`}
          </Button>
        </>
      }
    >
      {item && (
        <div className="checkout">
          <div className="checkout__item">
            <span className="checkout__icon" aria-hidden>
              <Icon name={item.kind === "membership" ? "bolt" : "ticket"} size={20} />
            </span>
            <span className="checkout__what">
              <span className="checkout__title">{item.title}</span>
              <span className="meta">{item.subtitle}</span>
            </span>
            <span className="checkout__price">{rupiah(item.price)}</span>
          </div>

          <div className="checkout__voucher">
            <label htmlFor="voucher" className="checkout__label">
              Voucher code
            </label>
            <div className="checkout__voucher-row">
              <input
                id="voucher"
                className="dash-input"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  setApplied(null);
                  setVoucherError(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && apply()}
                placeholder="Optional"
                autoComplete="off"
                maxLength={40}
              />
              <Button variant="secondary" onClick={apply} loading={checking} disabled={!code.trim()}>
                Apply
              </Button>
            </div>
            {voucherError && <p className="checkout__error">{voucherError}</p>}
            {applied && (
              <p className="checkout__ok">
                <Icon name="check" size={14} /> {applied.code} applied
              </p>
            )}
          </div>

          <dl className="checkout__sum">
            <div>
              <dt>Price</dt>
              <dd>{rupiah(item.price)}</dd>
            </div>
            {applied && applied.discount > 0 && (
              <div className="is-discount">
                <dt>Voucher</dt>
                <dd>−{rupiah(applied.discount)}</dd>
              </div>
            )}
            <div className="is-total">
              <dt>Total</dt>
              <dd>{rupiah(total)}</dd>
            </div>
          </dl>
          {total > 0 && <p className="meta">The payment page may add a small unique code to the amount so your transfer can be matched automatically.</p>}
          {!paymentsReady && <p className="checkout__error">Payments aren’t set up on the server yet.</p>}
          {error && (
            <p className="checkout__error" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </Dialog>
  );
}
