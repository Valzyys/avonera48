/** Client for the members' area: shop, orders, profile, chat and admin. */

import type { Account } from "@/features/auth/AuthContext";
import type { StageShow } from "../../../worker/stage";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly field?: string,
  ) {
    super(message);
  }
}

async function call<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  let res: Response;
  try {
    res = await fetch(path, {
      credentials: "same-origin",
      ...rest,
      headers: { accept: "application/json", ...(json !== undefined ? { "content-type": "application/json" } : {}), ...(rest.headers ?? {}) },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch {
    throw new ApiError("Can’t reach the server. Check your connection and try again.", 0, "network");
  }
  const data = (await res.json().catch(() => null)) as (T & { ok?: boolean; message?: string; error?: string; field?: string }) | null;
  if (!res.ok || !data || data.ok === false) throw new ApiError(data?.message ?? "Something went wrong. Try again.", res.status, data?.error, data?.field);
  return data;
}

export const rupiah = (n: number) => `Rp ${new Intl.NumberFormat("id-ID").format(Math.round(n))}`;

/* ---------- shop ---------- */

export interface PlanOffer {
  id: string;
  name: string;
  description: string;
  price: number;
  duration_days: number;
  remaining: number | null;
}

export interface Membership {
  plan_id: string;
  plan_name: string;
  started_at: string;
  expires_at: string;
}

export interface Catalog {
  payments: boolean;
  ticket_price: number | null;
  products: Record<string, { price: number | null; on_sale: boolean }>;
  plans: PlanOffer[];
  membership: Membership | null;
  tickets: { show_slug: string; created_at: string }[];
  pending: { id: string; kind: string; item_id: string }[];
}

export type OrderStatus = "PENDING" | "SUCCESS" | "EXPIRED" | "CANCELLED" | "FAILED";

export interface Order {
  id: string;
  kind: "ticket" | "membership";
  item_id: string;
  item_title: string;
  base_amount: number;
  discount: number;
  voucher: string | null;
  amount: number;
  pay_amount: number | null;
  status: OrderStatus;
  trx_id: string | null;
  qr_image: string | null;
  payment_url: string | null;
  expires_at: string | null;
  created_at: string;
  paid_at: string | null;
  user_email?: string;
  user_name?: string;
}

/** A show on sale, as the server reads it from the IDN Plus listing. */
export type { StageShow };

export const shop = {
  catalog: () => call<Catalog>("/api/shop/catalog"),
  shows: () => call<{ shows: StageShow[] }>("/api/shop/shows").then((d) => d.shows),
  voucher: (code: string, kind: string, item: string) => call<{ code: string; discount: number; amount: number }>("/api/shop/voucher", { method: "POST", json: { code, kind, item } }),
  checkout: (kind: "ticket" | "membership", item: string, voucher?: string) => call<{ id: string; free?: boolean }>("/api/shop/checkout", { method: "POST", json: { kind, item, voucher } }),
  orders: () => call<{ orders: Order[] }>("/api/shop/orders").then((d) => d.orders),
  order: (id: string) => call<{ order: Order }>(`/api/shop/orders/${id}`).then((d) => d.order),
  cancel: (id: string) => call<{ order: Order }>(`/api/shop/orders/${id}/cancel`, { method: "POST", json: {} }).then((d) => d.order),
};

/** Price of a show's ticket, or null when it isn't on sale. */
export function priceOf(c: Catalog | undefined, show: string) {
  if (!c) return null;
  const p = c.products[show];
  if (p && !p.on_sale) return null;
  return p?.price ?? c.ticket_price;
}

export function accessOf(c: Catalog | undefined, show: string): "ticket" | "membership" | null {
  if (!c) return null;
  if (c.tickets.some((t) => t.show_slug === show)) return "ticket";
  return c.membership && Date.parse(c.membership.expires_at) > Date.now() ? "membership" : null;
}

/* ---------- profile ---------- */

export const profile = {
  rename: (name: string) => call<{ user: Account }>("/api/auth/profile", { method: "POST", json: { name } }).then((d) => d.user),
  password: (current: string, next: string) => call<{ user: Account }>("/api/auth/password", { method: "POST", json: { current, next } }).then((d) => d.user),
  avatar: (blob: Blob) => call<{ user: Account }>("/api/auth/avatar", { method: "PUT", body: blob, headers: { "content-type": blob.type } }).then((d) => d.user),
  removeAvatar: () => call<{ user: Account }>("/api/auth/avatar", { method: "DELETE" }).then((d) => d.user),
};

/** Square-crops and shrinks an image file to a 320 px WebP before upload. */
export async function prepareAvatar(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const size = Math.min(320, side);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/webp", 0.85));
  if (blob && blob.type === "image/webp") return blob;
  return new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("Couldn’t read that image."))), "image/jpeg", 0.85));
}

/* ---------- chat ---------- */

export interface ChatMessage {
  id: number;
  name: string;
  avatar: string | null;
  body: string;
  at: number;
  mine: boolean;
}

export const chat = {
  list: (show: string, after = 0) => call<{ comments: ChatMessage[] }>(`/api/room/${show}/comments?after=${after}`).then((d) => d.comments),
  post: (show: string, body: string) => call<{ comment: ChatMessage }>(`/api/room/${show}/comments`, { method: "POST", json: { body } }).then((d) => d.comment),
  remove: (show: string, id: number) => call<{ ok: true }>(`/api/room/${show}/comments/${id}`, { method: "DELETE" }),
};

/* ---------- admin ---------- */

export interface AdminPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  duration_days: number;
  stock: number | null;
  sold: number;
  active: number;
  sort: number;
}

/** A plan being edited: stock may be "" (unlimited) while typing. */
export type PlanDraft = Omit<Partial<AdminPlan>, "stock"> & { stock?: number | null | "" };

export interface AdminVoucher {
  code: string;
  kind: "percent" | "fixed";
  value: number;
  applies_to: "all" | "ticket" | "membership";
  max_uses: number | null;
  used: number;
  expires_at: string | null;
  active: number;
}

export interface AdminSummary {
  revenue: number;
  paid: number;
  revenue_24h: number;
  paid_24h: number;
  by_status: Record<string, number>;
  active_members: number;
  recent: Order[];
}

export interface AdminPricing {
  ticket_price: number | null;
  products: { show_slug: string; price: number | null; on_sale: number; stream_slug: string | null }[];
  shows: { slug: string; title: string; startsAt: string }[];
}

export const admin = {
  summary: () => call<AdminSummary>("/api/admin/summary"),
  orders: (params: { status?: string; q?: string; before?: string }) => {
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]);
    return call<{ orders: Order[]; next: string | null }>(`/api/admin/orders?${q}`);
  },
  recheck: (id: string) => call<{ order: Order }>(`/api/admin/orders/${id}/recheck`, { method: "POST", json: {} }).then((d) => d.order),
  plans: () => call<{ plans: AdminPlan[] }>("/api/admin/plans").then((d) => d.plans),
  savePlan: (p: PlanDraft) => call<{ id: string }>("/api/admin/plans", { method: "POST", json: { ...p, active: p.active !== 0 } }),
  addStock: (id: string, add: number) => call<{ ok: true }>(`/api/admin/plans/${id}/stock`, { method: "POST", json: { add } }),
  deletePlan: (id: string) => call<{ ok: true }>(`/api/admin/plans/${id}`, { method: "DELETE" }),
  pricing: () => call<AdminPricing>("/api/admin/pricing"),
  setGlobalPrice: (price: number | null) => call<{ ok: true }>("/api/admin/pricing", { method: "POST", json: { ticket_price: price } }),
  saveProduct: (p: { show_slug: string; price: number | null; on_sale: boolean; stream_slug: string | null }) => call<{ ok: true }>("/api/admin/products", { method: "POST", json: p }),
  resetProduct: (slug: string) => call<{ ok: true }>(`/api/admin/products/${slug}`, { method: "DELETE" }),
  vouchers: () => call<{ vouchers: AdminVoucher[] }>("/api/admin/vouchers").then((d) => d.vouchers),
  saveVoucher: (v: Omit<Partial<AdminVoucher>, "active"> & { active?: boolean }) => call<{ code: string }>("/api/admin/vouchers", { method: "POST", json: { ...v, active: v.active !== false } }),
  deleteVoucher: (code: string) => call<{ ok: true }>(`/api/admin/vouchers/${code}`, { method: "DELETE" }),
  members: () => call<{ members: (Membership & { user_id: string; email: string | null; name: string | null })[] }>("/api/admin/members").then((d) => d.members),
  grant: (email: string, plan_id: string, days?: number) => call<{ expires_at: string }>("/api/admin/members", { method: "POST", json: { email, plan_id, days } }),
  /** Change a pass: add or remove days, or set the last day (YYYY-MM-DD, WIB). */
  adjust: (uid: string, change: { add_days: number } | { until: string }) =>
    call<{ expires_at: string }>(`/api/admin/members/${encodeURIComponent(uid)}`, { method: "PATCH", json: change }),
  revoke: (uid: string) => call<{ ok: true }>(`/api/admin/members/${encodeURIComponent(uid)}`, { method: "DELETE" }),
  user: (email: string) => call<AdminUser>(`/api/admin/users?email=${encodeURIComponent(email)}`),
  revokeTicket: (uid: string, show: string) => call<{ ok: true }>(`/api/admin/tickets/${encodeURIComponent(uid)}/${encodeURIComponent(show)}`, { method: "DELETE" }),
};

export interface AdminUser {
  user: { id: string; name: string; email: string; createdAt: string | null };
  membership: Membership | null;
  tickets: { show_slug: string; order_id: string; created_at: string; title: string | null }[];
}
