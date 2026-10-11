/**
 * MYPG (yobasepay.net) payment gateway. Server-to-server only: the API key
 * lives in the MYPG_API_KEY secret.
 *
 *   createpayment  { api_key, amount, ref_id }   → trx_id, payment_token, amount (incl. unique code), qr_image, payment_url, expired_at
 *   checkstatus    { api_key, trxid }            → status PENDING | SUCCESS | EXPIRED | CANCELLED
 *   cancelpayment  { api_key, trxid }
 */

export interface PaymentEnv {
  MYPG_API_KEY?: string;
  /** Optional override of the gateway URL (tests). */
  MYPG_API_URL?: string;
}

export type PayStatus = "PENDING" | "SUCCESS" | "EXPIRED" | "CANCELLED";

export interface CreatedPayment {
  trx_id: string;
  payment_token: string;
  amount: number;
  qr_image: string;
  payment_url: string;
  expired_at: string;
}

const BASE = "https://yobasepay.net/api_my";

export const paymentReady = (env: PaymentEnv) => !!env.MYPG_API_KEY;

async function call<T>(env: PaymentEnv, action: string, params: Record<string, string>): Promise<{ ok: boolean; data?: T; message?: string }> {
  const form = new URLSearchParams({ api_key: env.MYPG_API_KEY!, ...params });
  try {
    const res = await fetch(`${env.MYPG_API_URL || BASE}?action=${action}`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body: form.toString(),
    });
    const j = (await res.json().catch(() => null)) as { status?: boolean; data?: T; message?: string } | null;
    if (!j) return { ok: false, message: `Gateway answered ${res.status}` };
    return { ok: j.status === true, data: j.data, message: j.message };
  } catch {
    return { ok: false, message: "Gateway unreachable" };
  }
}

export const createPayment = (env: PaymentEnv, amount: number, refId: string) => call<CreatedPayment>(env, "createpayment", { amount: String(amount), ref_id: refId });

export const checkPayment = (env: PaymentEnv, trxid: string) => call<{ status: PayStatus; amount?: number; expired_at?: string }>(env, "checkstatus", { trxid });

export const cancelPayment = (env: PaymentEnv, trxid: string) => call<{ status: PayStatus }>(env, "cancelpayment", { trxid });

/** "2026-10-11 21:32:02" (gateway local time, WIB) → ISO. */
export function gatewayTime(v: string | undefined | null) {
  if (!v) return null;
  if (/[zZ]|[+-]\d\d:?\d\d$/.test(v)) return new Date(v).toISOString();
  const d = new Date(`${v.replace(" ", "T")}+07:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
