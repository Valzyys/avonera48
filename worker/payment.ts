/**
 * QRIS payments, server-to-server only. API keys live in secrets.
 *
 * Gateway V2 (dynamic QRIS, the default when PAYMENT_V2_API_KEY is set):
 *   POST   /gateway/v2/payment/create          { amount, description, customer_*, custom_trx_id, timeout_minutes }
 *          → ref_id, trx_id, final_amount (incl. unique code), qr_image, expired_at
 *   GET    /gateway/v2/payment/check/:ref_id   → payment_status pending | paid | expired | cancelled
 *   DELETE /gateway/v2/payment/cancel/:ref_id
 *   Header x-api-key. Orders keep the ref_id ("GIV2-…") as trx_id.
 *
 * MYPG (yobasepay.net), the older gateway, used when only MYPG_API_KEY is set
 * and for orders it created:
 *   createpayment  { api_key, amount, ref_id }   → trx_id, payment_token, amount, qr_image, payment_url, expired_at
 *   checkstatus    { api_key, trxid }            → status PENDING | SUCCESS | EXPIRED | CANCELLED
 *   cancelpayment  { api_key, trxid }
 */

export interface PaymentEnv {
  /** Gateway V2 API key ("GIV2-…"). */
  PAYMENT_V2_API_KEY?: string;
  /** Optional override of the Gateway V2 origin (tests). */
  PAYMENT_V2_URL?: string;
  MYPG_API_KEY?: string;
  /** Optional override of the MYPG URL (tests). */
  MYPG_API_URL?: string;
}

export type PayStatus = "PENDING" | "SUCCESS" | "EXPIRED" | "CANCELLED";

export interface CreatedPayment {
  /** What check / cancel take: the V2 ref_id or the MYPG trx_id. */
  trx_id: string;
  /** The gateway's own reference shown to the payer (V2 trx_id, MYPG token). */
  payment_token: string;
  /** Amount to pay, including the unique code. */
  amount: number;
  qr_image: string;
  payment_url: string | null;
  /** ISO time. */
  expired_at: string | null;
}

export interface PaymentCustomer {
  name?: string;
  email?: string;
  description?: string;
}

type Result<T> = { ok: boolean; data?: T; message?: string };

const V2_BASE = "https://v5.jkt48connect.com";
const MYPG_BASE = "https://yobasepay.net/api_my";
const TIMEOUT_MINUTES = 30;

export const paymentReady = (env: PaymentEnv) => !!(env.PAYMENT_V2_API_KEY || env.MYPG_API_KEY);

/** V2 refs look like "GIV2-…"; anything else came from MYPG. */
export const isV2Ref = (trx: string) => /^GIV2-/i.test(trx);

/* ---------- Gateway V2 ---------- */

async function v2<T>(env: PaymentEnv, method: string, path: string, body?: unknown): Promise<{ ok: boolean; json: T | null; message?: string }> {
  if (!env.PAYMENT_V2_API_KEY) return { ok: false, json: null, message: "Gateway V2 isn’t set up" };
  try {
    const res = await fetch(`${env.PAYMENT_V2_URL || V2_BASE}/gateway/v2/payment${path}`, {
      method,
      headers: { "x-api-key": env.PAYMENT_V2_API_KEY, accept: "application/json", ...(body ? { "content-type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000),
    });
    const j = (await res.json().catch(() => null)) as (T & { status?: boolean; message?: string }) | null;
    if (!j) return { ok: false, json: null, message: `Gateway answered ${res.status}` };
    return { ok: res.ok && j.status === true, json: j, message: j.message };
  } catch {
    return { ok: false, json: null, message: "Gateway unreachable" };
  }
}

interface V2Created {
  data?: { ref_id?: string; trx_id?: string; amount?: number; final_amount?: number; qr_image?: string; expired_at?: string };
}

interface V2Check {
  payment_status?: string;
  data?: { amount?: number; final_amount?: number; paid_at?: string };
}

const V2_STATUS: Record<string, PayStatus> = { pending: "PENDING", paid: "SUCCESS", expired: "EXPIRED", cancelled: "CANCELLED", canceled: "CANCELLED" };

async function v2Create(env: PaymentEnv, amount: number, refId: string, who: PaymentCustomer): Promise<Result<CreatedPayment>> {
  const r = await v2<V2Created>(env, "POST", "/create", {
    amount,
    custom_trx_id: refId,
    timeout_minutes: TIMEOUT_MINUTES,
    ...(who.name ? { customer_name: who.name.slice(0, 80) } : {}),
    ...(who.email ? { customer_email: who.email } : {}),
    ...(who.description ? { description: who.description.slice(0, 120) } : {}),
  });
  const d = r.json?.data;
  if (!r.ok || !d?.ref_id || !d.qr_image) return { ok: false, message: r.message };
  return {
    ok: true,
    data: {
      trx_id: d.ref_id,
      payment_token: d.trx_id ?? d.ref_id,
      amount: d.final_amount ?? d.amount ?? amount,
      qr_image: d.qr_image,
      payment_url: null,
      expired_at: gatewayTime(d.expired_at),
    },
  };
}

async function v2Check(env: PaymentEnv, ref: string): Promise<Result<{ status: PayStatus; amount?: number }>> {
  const r = await v2<V2Check>(env, "GET", `/check/${encodeURIComponent(ref)}`);
  const status = V2_STATUS[(r.json?.payment_status ?? "").toLowerCase()];
  if (!r.ok || !status) return { ok: false, message: r.message };
  return { ok: true, data: { status, amount: r.json?.data?.amount ?? r.json?.data?.final_amount } };
}

async function v2Cancel(env: PaymentEnv, ref: string): Promise<Result<{ status: PayStatus }>> {
  const r = await v2(env, "DELETE", `/cancel/${encodeURIComponent(ref)}`);
  return r.ok ? { ok: true, data: { status: "CANCELLED" } } : { ok: false, message: r.message };
}

/* ---------- MYPG ---------- */

async function mypg<T>(env: PaymentEnv, action: string, params: Record<string, string>): Promise<Result<T>> {
  if (!env.MYPG_API_KEY) return { ok: false, message: "MYPG isn’t set up" };
  const form = new URLSearchParams({ api_key: env.MYPG_API_KEY, ...params });
  try {
    const res = await fetch(`${env.MYPG_API_URL || MYPG_BASE}?action=${action}`, {
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

async function mypgCreate(env: PaymentEnv, amount: number, refId: string): Promise<Result<CreatedPayment>> {
  const r = await mypg<CreatedPayment>(env, "createpayment", { amount: String(amount), ref_id: refId });
  if (!r.ok || !r.data) return r;
  return { ok: true, data: { ...r.data, amount: r.data.amount ?? amount, expired_at: gatewayTime(r.data.expired_at) } };
}

/* ---------- the shop's entry points ---------- */

/** Starts a QRIS payment on Gateway V2 when it is set up, else on MYPG. */
export const createPayment = (env: PaymentEnv, amount: number, refId: string, who: PaymentCustomer = {}) =>
  env.PAYMENT_V2_API_KEY ? v2Create(env, amount, refId, who) : mypgCreate(env, amount, refId);

/** Asks whichever gateway created the payment. */
export const checkPayment = (env: PaymentEnv, trx: string): Promise<Result<{ status: PayStatus; amount?: number }>> =>
  isV2Ref(trx) ? v2Check(env, trx) : mypg(env, "checkstatus", { trxid: trx });

export const cancelPayment = (env: PaymentEnv, trx: string): Promise<Result<{ status: PayStatus }>> =>
  isV2Ref(trx) ? v2Cancel(env, trx) : mypg(env, "cancelpayment", { trxid: trx });

/** "2026-10-11 21:32:02" (gateway local time, WIB) or ISO → ISO. */
export function gatewayTime(v: string | undefined | null) {
  if (!v) return null;
  if (/[zZ]|[+-]\d\d:?\d\d$/.test(v)) {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const d = new Date(`${v.replace(" ", "T")}+07:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
