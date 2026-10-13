/**
 * Shop: theater show tickets and memberships, paid through MYPG.
 *
 *   GET  /api/shop/catalog             prices, plans, what the viewer owns
 *   GET  /api/shop/shows               the shows on sale (IDN Plus listing)
 *   POST /api/shop/voucher             { code, kind, item } → discount preview
 *   POST /api/shop/checkout            { kind: "ticket"|"membership", item, voucher? } → { id }
 *   GET  /api/shop/orders              the viewer's orders
 *   GET  /api/shop/orders/:id          one order (re-checks a pending payment)
 *   POST /api/shop/orders/:id/cancel   cancel a pending payment
 *
 * Access to a show = a ticket for it, or an active membership.
 */

import { ensureSchema, getSetting } from "./db";
import { body, fail, randomId, reply, str } from "./http";
import { cancelPayment, checkPayment, createPayment, gatewayTime, paymentReady, type PaymentEnv, type PayStatus } from "./payment";
import { parseStageList, withArt, type StageShow, type TheaterRow } from "./stage";

export interface ShopEnv extends PaymentEnv {
  DB?: D1Database;
  ADMIN_EMAILS?: string;
  DATA_API_KEY?: string;
  JKT48CONNECT_API_KEY?: string;
  DATA_API_BASE?: string;
  /** Overrides the IDN Plus show listing (e.g. a mirror or a test server). */
  SHOWS_API_URL?: string;
}

export interface Viewer {
  id: string;
  name: string;
  email: string;
}

export const isAdmin = (env: ShopEnv, email: string) =>
  (env.ADMIN_EMAILS ?? "")
    .split(/[,\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase());

export interface Order {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  kind: "ticket" | "membership";
  item_id: string;
  item_title: string;
  base_amount: number;
  discount: number;
  voucher: string | null;
  amount: number;
  pay_amount: number | null;
  status: PayStatus | "FAILED";
  trx_id: string | null;
  pay_token: string | null;
  qr_image: string | null;
  payment_url: string | null;
  expires_at: string | null;
  created_at: string;
  paid_at: string | null;
  checked_at: number;
  released: number;
}

export interface Plan {
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

/* ---------- the theater schedule (server-trusted titles and dates) ---------- */

const SHOWS_URL = "https://v5.jkt48connect.com/api/jkt48/idnplus";
const DATA_API = "https://jkt48connect.com";

/** The theater schedule's rows (for banners and posters); empty when unavailable. */
async function theaterRows(env: ShopEnv): Promise<TheaterRow[]> {
  const key = env.DATA_API_KEY || env.JKT48CONNECT_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch(`${env.DATA_API_BASE || DATA_API}/api/v1/theater?page=1`, { headers: { "x-api-key": key, accept: "application/json" } });
    if (!res.ok) return [];
    const j = (await res.json()) as { data?: TheaterRow[] };
    return Array.isArray(j.data) ? j.data : [];
  } catch {
    return [];
  }
}

/**
 * The shows on sale, from the IDN Plus listing. Cached at the edge for a
 * minute so a show turning live shows up quickly. Null when the listing
 * can't be read.
 */
export async function theaterShows(env: ShopEnv): Promise<StageShow[] | null> {
  const cache = caches.default;
  const cacheKey = new Request("https://shop.internal/stage?v=2");
  const hit = await cache.match(cacheKey);
  if (hit) return (await hit.json()) as StageShow[];
  try {
    const [res, rows] = await Promise.all([fetch(env.SHOWS_API_URL || SHOWS_URL, { headers: { accept: "application/json" } }), theaterRows(env)]);
    if (!res.ok) return null;
    const shows = withArt(parseStageList(await res.json()), rows);
    await cache.put(cacheKey, new Response(JSON.stringify(shows), { headers: { "cache-control": "public, max-age=60" } }));
    return shows;
  } catch {
    return null;
  }
}

/* ---------- prices and access ---------- */

export async function ticketPrice(db: D1Database, slug: string) {
  const p = await db.prepare("SELECT price, on_sale FROM products WHERE show_slug = ?").bind(slug).first<{ price: number | null; on_sale: number }>();
  if (p && !p.on_sale) return null;
  if (p?.price != null) return p.price;
  const global = await getSetting(db, "ticket_price");
  return global != null ? Number(global) : null;
}

export interface MembershipRow {
  plan_id: string;
  plan_name: string;
  started_at: string;
  expires_at: string;
  /** Bought here, or mirrored from a linked JKT48Connect account (worker/link.ts). */
  source: "avonera" | "jkt48connect";
}

/** The membership bought on this site (what admins and renewals change). */
export async function ownMembership(db: D1Database, uid: string) {
  return db.prepare("SELECT plan_id, plan_name, started_at, expires_at FROM memberships WHERE user_id = ?").bind(uid).first<Omit<MembershipRow, "source">>();
}

/** The viewer's membership: their own or their linked account's, whichever runs longer. */
export async function membershipOf(db: D1Database, uid: string): Promise<MembershipRow | null> {
  const [own, linked] = await Promise.all([
    ownMembership(db, uid),
    db
      .prepare("SELECT plan_id, plan_name, linked_at AS started_at, plan_expires_at AS expires_at FROM account_links WHERE user_id = ? AND plan_expires_at IS NOT NULL")
      .bind(uid)
      .first<Omit<MembershipRow, "source">>(),
  ]);
  const a: MembershipRow | null = own ? { ...own, source: "avonera" } : null;
  const b: MembershipRow | null = linked ? { ...linked, source: "jkt48connect" } : null;
  if (!a || !b) return a ?? b;
  return Date.parse(b.expires_at) > Date.parse(a.expires_at) ? b : a;
}

/** How the viewer may watch a show: their ticket, their membership, or not at all. */
export async function accessTo(db: D1Database, uid: string, show: string): Promise<"ticket" | "membership" | null> {
  const t = await db.prepare("SELECT 1 FROM tickets WHERE user_id = ? AND show_slug = ?").bind(uid, show).first();
  if (t) return "ticket";
  const m = await membershipOf(db, uid);
  return m && Date.parse(m.expires_at) > Date.now() ? "membership" : null;
}

/* ---------- vouchers ---------- */

interface Voucher {
  code: string;
  kind: "percent" | "fixed";
  value: number;
  applies_to: "all" | "ticket" | "membership";
  max_uses: number | null;
  used: number;
  expires_at: string | null;
  active: number;
}

const normCode = (v: unknown) =>
  str(v, 40)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "");

async function findVoucher(db: D1Database, code: string, kind: string): Promise<{ v: Voucher } | { error: string }> {
  const v = await db.prepare("SELECT * FROM vouchers WHERE code = ?").bind(code).first<Voucher>();
  if (!v || !v.active) return { error: "That voucher code isn’t valid." };
  if (v.expires_at && Date.parse(v.expires_at) < Date.now()) return { error: "That voucher has expired." };
  if (v.max_uses != null && v.used >= v.max_uses) return { error: "That voucher has been fully used." };
  if (v.applies_to !== "all" && v.applies_to !== kind) return { error: `That voucher only works for ${v.applies_to === "ticket" ? "show tickets" : "memberships"}.` };
  return { v };
}

const discountFor = (v: Voucher, base: number) => Math.min(base, v.kind === "percent" ? Math.floor((base * Math.min(100, v.value)) / 100) : v.value);

/* ---------- orders ---------- */

const MIN_GATEWAY = 100;

async function itemFor(env: ShopEnv, db: D1Database, viewer: Viewer, kind: string, item: string) {
  if (kind === "ticket") {
    const shows = await theaterShows(env);
    const show = shows?.find((s) => s.slug === item);
    if (!show) return { error: "That show isn’t on the schedule." };
    if (show.status === "ended") return { error: "That show has already ended." };
    if (await db.prepare("SELECT 1 FROM tickets WHERE user_id = ? AND show_slug = ?").bind(viewer.id, item).first()) return { error: "You already have a ticket for this show.", owned: true };
    const price = await ticketPrice(db, item);
    if (price == null) return { error: "Tickets for this show aren’t on sale." };
    return { title: show.title, price };
  }
  if (kind === "membership") {
    const plan = await db.prepare("SELECT * FROM plans WHERE id = ? AND active = 1").bind(item).first<Plan>();
    if (!plan) return { error: "That membership isn’t available." };
    if (plan.stock != null && plan.sold >= plan.stock) return { error: "That membership is sold out." };
    return { title: plan.name, price: plan.price, plan };
  }
  return { error: "Choose something to buy." };
}

/** Gives the buyer what they paid for. Runs once per order (guarded by the status flip). */
export async function grant(db: D1Database, o: Order) {
  const now = new Date().toISOString();
  if (o.kind === "ticket") {
    await db.prepare("INSERT OR IGNORE INTO tickets (user_id, show_slug, order_id, created_at) VALUES (?, ?, ?, ?)").bind(o.user_id, o.item_id, o.id, now).run();
    return;
  }
  const plan = await db.prepare("SELECT name, duration_days FROM plans WHERE id = ?").bind(o.item_id).first<{ name: string; duration_days: number }>();
  await extendMembership(db, o.user_id, o.item_id, plan?.name ?? o.item_title, plan?.duration_days ?? 30);
}

/** Adds days to a membership, counting from its end if it is still active. */
export async function extendMembership(db: D1Database, uid: string, planId: string, planName: string, days: number) {
  const now = new Date().toISOString();
  const current = await ownMembership(db, uid);
  const active = current && Date.parse(current.expires_at) > Date.now();
  const from = active ? Date.parse(current.expires_at) : Date.now();
  const expires = new Date(from + days * 86400000).toISOString();
  await db
    .prepare(
      `INSERT INTO memberships (user_id, plan_id, plan_name, started_at, expires_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET plan_id = excluded.plan_id, plan_name = excluded.plan_name, started_at = excluded.started_at, expires_at = excluded.expires_at`,
    )
    .bind(uid, planId, planName, active ? current.started_at : now, expires)
    .run();
  return expires;
}

/** Returns reserved stock and voucher uses for an order that won't be paid. */
async function release(db: D1Database, o: Order) {
  const r = await db.prepare("UPDATE orders SET released = 1 WHERE id = ? AND released = 0").bind(o.id).run();
  if (!r.meta.changes) return;
  const ops = [];
  if (o.voucher) ops.push(db.prepare("UPDATE vouchers SET used = MAX(0, used - 1) WHERE code = ?").bind(o.voucher));
  if (o.kind === "membership") ops.push(db.prepare("UPDATE plans SET sold = MAX(0, sold - 1) WHERE id = ?").bind(o.item_id));
  if (ops.length) await db.batch(ops);
}

/** Moves a pending order to its final state, once. */
export async function settle(db: D1Database, o: Order, status: PayStatus | "FAILED") {
  if (status === "PENDING") return o;
  const paidAt = status === "SUCCESS" ? new Date().toISOString() : null;
  const r = await db.prepare("UPDATE orders SET status = ?, paid_at = COALESCE(?, paid_at) WHERE id = ? AND status = 'PENDING'").bind(status, paidAt, o.id).run();
  if (r.meta.changes) {
    if (status === "SUCCESS") await grant(db, o);
    else await release(db, o);
  }
  return (await db.prepare("SELECT * FROM orders WHERE id = ?").bind(o.id).first<Order>())!;
}

/** Asks the gateway about a pending order (at most every 4 s) and settles it. */
export async function refresh(env: ShopEnv, db: D1Database, o: Order, force = false) {
  if (o.status !== "PENDING" || !o.trx_id) return o;
  if (!force && Date.now() - o.checked_at < 4000) return o;
  await db.prepare("UPDATE orders SET checked_at = ? WHERE id = ?").bind(Date.now(), o.id).run();
  const r = await checkPayment(env, o.trx_id);
  if (r.ok && r.data?.status && r.data.status !== "PENDING") return settle(db, o, r.data.status);
  if (r.ok && o.expires_at && Date.parse(o.expires_at) + 10 * 60000 < Date.now()) return settle(db, o, "EXPIRED");
  return { ...o, checked_at: Date.now() };
}

/** Settles a few abandoned pending orders so their reserved stock comes back. */
export async function sweep(env: ShopEnv, db: D1Database) {
  const stale = await db
    .prepare("SELECT * FROM orders WHERE status = 'PENDING' AND expires_at IS NOT NULL AND expires_at < ? ORDER BY created_at LIMIT 3")
    .bind(new Date(Date.now() - 2 * 60000).toISOString())
    .all<Order>();
  for (const o of stale.results) await refresh(env, db, o, true);
}

/** What the client may see of an order. */
export const publicOrder = (o: Order) => ({
  id: o.id,
  kind: o.kind,
  item_id: o.item_id,
  item_title: o.item_title,
  base_amount: o.base_amount,
  discount: o.discount,
  voucher: o.voucher,
  amount: o.amount,
  pay_amount: o.pay_amount,
  status: o.status,
  trx_id: o.trx_id,
  qr_image: o.qr_image,
  payment_url: o.payment_url,
  expires_at: o.expires_at,
  created_at: o.created_at,
  paid_at: o.paid_at,
});

/* ---------- handlers ---------- */

async function catalog(env: ShopEnv, db: D1Database, viewer: Viewer) {
  const [global, products, plans, membership, tickets, pending] = await Promise.all([
    getSetting(db, "ticket_price"),
    db.prepare("SELECT show_slug, price, on_sale FROM products").all<{ show_slug: string; price: number | null; on_sale: number }>(),
    db.prepare("SELECT * FROM plans WHERE active = 1 ORDER BY sort, price").all<Plan>(),
    membershipOf(db, viewer.id),
    db.prepare("SELECT show_slug, created_at FROM tickets WHERE user_id = ?").bind(viewer.id).all<{ show_slug: string; created_at: string }>(),
    db.prepare("SELECT id, kind, item_id FROM orders WHERE user_id = ? AND status = 'PENDING' ORDER BY created_at DESC LIMIT 20").bind(viewer.id).all<{ id: string; kind: string; item_id: string }>(),
  ]);
  return reply({
    ok: true,
    payments: paymentReady(env),
    ticket_price: global != null ? Number(global) : null,
    products: Object.fromEntries(products.results.map((p) => [p.show_slug, { price: p.price, on_sale: !!p.on_sale }])),
    plans: plans.results.map((p) => ({ id: p.id, name: p.name, description: p.description, price: p.price, duration_days: p.duration_days, remaining: p.stock == null ? null : Math.max(0, p.stock - p.sold) })),
    membership: membership && Date.parse(membership.expires_at) > Date.now() ? membership : null,
    tickets: tickets.results,
    pending: pending.results,
  });
}

async function voucherPreview(env: ShopEnv, db: D1Database, viewer: Viewer, request: Request) {
  const data = await body(request);
  const code = normCode(data.code);
  const kind = str(data.kind, 20);
  const item = await itemFor(env, db, viewer, kind, str(data.item, 80));
  if ("error" in item) return fail(400, "invalid", item.error!);
  const found = await findVoucher(db, code, kind);
  if ("error" in found) return fail(400, "invalid_voucher", found.error, "voucher");
  const discount = discountFor(found.v, item.price);
  return reply({ ok: true, code, discount, amount: Math.max(0, item.price - discount) });
}

async function checkout(env: ShopEnv, db: D1Database, viewer: Viewer, request: Request) {
  if (!paymentReady(env)) return fail(503, "not_configured", "Payments aren’t set up yet.");
  const data = await body(request);
  const kind = str(data.kind, 20);
  const itemId = str(data.item, 80);
  await sweep(env, db);

  // One open payment per item: send the buyer back to it instead of making another.
  const open = await db
    .prepare("SELECT id FROM orders WHERE user_id = ? AND kind = ? AND item_id = ? AND status = 'PENDING' AND (expires_at IS NULL OR expires_at > ?) ORDER BY created_at DESC LIMIT 1")
    .bind(viewer.id, kind, itemId, new Date().toISOString())
    .first<{ id: string }>();
  if (open) return reply({ ok: true, id: open.id, existing: true });

  const item = await itemFor(env, db, viewer, kind, itemId);
  if ("error" in item) return fail(item.owned ? 409 : 400, item.owned ? "owned" : "invalid", item.error!);

  // Reserve a voucher use and (for memberships) one unit of stock.
  let voucher: string | null = null;
  let discount = 0;
  const code = normCode(data.voucher);
  if (code) {
    const found = await findVoucher(db, code, kind);
    if ("error" in found) return fail(400, "invalid_voucher", found.error, "voucher");
    const r = await db.prepare("UPDATE vouchers SET used = used + 1 WHERE code = ? AND (max_uses IS NULL OR used < max_uses)").bind(code).run();
    if (!r.meta.changes) return fail(400, "invalid_voucher", "That voucher has been fully used.", "voucher");
    voucher = code;
    discount = discountFor(found.v, item.price);
  }
  if (kind === "membership") {
    const r = await db.prepare("UPDATE plans SET sold = sold + 1 WHERE id = ? AND (stock IS NULL OR sold < stock)").bind(itemId).run();
    if (!r.meta.changes) {
      if (voucher) await db.prepare("UPDATE vouchers SET used = MAX(0, used - 1) WHERE code = ?").bind(voucher).run();
      return fail(409, "sold_out", "That membership is sold out.");
    }
  }

  const id = randomId(16);
  let amount = Math.max(0, item.price - discount);
  if (amount > 0 && amount < MIN_GATEWAY) amount = MIN_GATEWAY;
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO orders (id, user_id, user_email, user_name, kind, item_id, item_title, base_amount, discount, voucher, amount, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)`,
    )
    .bind(id, viewer.id, viewer.email, viewer.name, kind, itemId, item.title, item.price, discount, voucher, amount, now)
    .run();
  const order = (await db.prepare("SELECT * FROM orders WHERE id = ?").bind(id).first<Order>())!;

  if (amount === 0) {
    await settle(db, order, "SUCCESS");
    return reply({ ok: true, id, free: true });
  }

  const p = await createPayment(env, amount, id);
  if (!p.ok || !p.data) {
    await settle(db, order, "FAILED");
    return fail(502, "gateway_error", "The payment couldn’t be started. Try again in a moment.");
  }
  await db
    .prepare("UPDATE orders SET trx_id = ?, pay_token = ?, pay_amount = ?, qr_image = ?, payment_url = ?, expires_at = ?, checked_at = ? WHERE id = ?")
    .bind(p.data.trx_id, p.data.payment_token, p.data.amount ?? amount, p.data.qr_image, p.data.payment_url, gatewayTime(p.data.expired_at), Date.now(), id)
    .run();
  return reply({ ok: true, id });
}

async function orderOf(db: D1Database, viewer: Viewer, id: string) {
  return db.prepare("SELECT * FROM orders WHERE id = ? AND user_id = ?").bind(id, viewer.id).first<Order>();
}

export async function handleShop(request: Request, env: ShopEnv, viewer: Viewer, url: URL, sameOriginOk: boolean): Promise<Response> {
  if (!env.DB) return fail(503, "not_configured", "The shop isn’t set up yet.");
  const db = env.DB;
  await ensureSchema(db);
  const path = url.pathname.replace(/^\/api\/shop/, "");
  const post = request.method === "POST";
  if (post && !sameOriginOk) return fail(403, "forbidden", "Cross-site requests are not allowed.");

  if (!post && path === "/catalog") return catalog(env, db, viewer);
  if (!post && path === "/shows") {
    const shows = await theaterShows(env);
    return shows ? reply({ ok: true, shows }) : fail(502, "SHOWS_UNAVAILABLE", "The show list couldn’t be loaded. Try again in a moment.");
  }
  if (post && path === "/voucher") return voucherPreview(env, db, viewer, request);
  if (post && path === "/checkout") return checkout(env, db, viewer, request);
  if (!post && path === "/orders") {
    const rows = await db.prepare("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 100").bind(viewer.id).all<Order>();
    return reply({ ok: true, orders: rows.results.map(publicOrder) });
  }
  const m = /^\/orders\/([a-z0-9]{8,32})(\/cancel)?$/.exec(path);
  if (m) {
    let o = await orderOf(db, viewer, m[1]);
    if (!o) return fail(404, "not_found", "That order doesn’t exist.");
    if (!post && !m[2]) {
      o = await refresh(env, db, o);
      return reply({ ok: true, order: publicOrder(o) });
    }
    if (post && m[2]) {
      if (o.status !== "PENDING") return reply({ ok: true, order: publicOrder(o) });
      if (o.trx_id) {
        const r = await cancelPayment(env, o.trx_id);
        if (!r.ok) {
          // Paid or expired in the meantime? Report that; otherwise keep it open.
          o = await refresh(env, db, o, true);
          if (o.status !== "PENDING") return reply({ ok: true, order: publicOrder(o) });
          return fail(502, "gateway_error", "The payment couldn’t be cancelled right now. Try again in a moment.");
        }
      }
      o = await settle(db, o, "CANCELLED");
      return reply({ ok: true, order: publicOrder(o) });
    }
  }
  return fail(404, "not_found", "Not found.");
}

