/**
 * Admin control (accounts listed in ADMIN_EMAILS).
 *
 *   GET  /api/admin/summary
 *   GET  /api/admin/orders?status=&q=&before=
 *   POST /api/admin/orders/:id/recheck
 *   GET  /api/admin/plans            POST /api/admin/plans            (create / update)
 *   POST /api/admin/plans/:id/stock  { add }                           DELETE /api/admin/plans/:id (unsold only)
 *   GET  /api/admin/pricing          POST /api/admin/pricing          { ticket_price }
 *   POST /api/admin/products         { show_slug, price, on_sale, stream_slug }   DELETE /api/admin/products/:slug
 *   GET  /api/admin/vouchers         POST /api/admin/vouchers         DELETE /api/admin/vouchers/:code
 *   GET  /api/admin/members          POST /api/admin/members          { email, plan_id, days }
 *   PATCH /api/admin/members/:uid    { add_days } or { until: "YYYY-MM-DD" }   DELETE /api/admin/members/:uid (revoke)
 *   GET  /api/admin/users?email=     one account: membership and tickets
 *   DELETE /api/admin/tickets/:uid/:show   revoke a ticket
 *   GET  /api/admin/community        POST /api/admin/community        { channel, group } WhatsApp links
 */

import { ensureSchema, getSetting, setSetting } from "./db";
import { body, fail, int, randomId, reply, str } from "./http";
import { checkPayment } from "./payment";
import { extendMembership, grant, publicOrder, refresh, sweep, theaterShows, type Order, type Plan, type ShopEnv } from "./shop";

/** An https link on WhatsApp's own hosts (channel, group invite or wa.me). */
function waLink(u: string) {
  try {
    const url = new URL(u);
    return url.protocol === "https:" && /^(?:(?:www|chat)\.)?whatsapp\.com$|^wa\.me$/.test(url.hostname);
  } catch {
    return false;
  }
}

const adminOrder = (o: Order) => ({ ...publicOrder(o), user_email: o.user_email, user_name: o.user_name, user_id: o.user_id });

async function summary(env: ShopEnv, db: D1Database) {
  await sweep(env, db);
  const dayStart = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const [totals, today, byStatus, members, recent] = await Promise.all([
    db.prepare("SELECT COALESCE(SUM(COALESCE(pay_amount, amount)), 0) AS revenue, COUNT(*) AS paid FROM orders WHERE status = 'SUCCESS'").first<{ revenue: number; paid: number }>(),
    db.prepare("SELECT COALESCE(SUM(COALESCE(pay_amount, amount)), 0) AS revenue, COUNT(*) AS paid FROM orders WHERE status = 'SUCCESS' AND paid_at >= ?").bind(dayStart).first<{ revenue: number; paid: number }>(),
    db.prepare("SELECT status, COUNT(*) AS n FROM orders GROUP BY status").all<{ status: string; n: number }>(),
    db.prepare("SELECT COUNT(*) AS n FROM memberships WHERE expires_at > ?").bind(new Date().toISOString()).first<{ n: number }>(),
    db.prepare("SELECT * FROM orders ORDER BY created_at DESC LIMIT 8").all<Order>(),
  ]);
  return reply({
    ok: true,
    revenue: totals?.revenue ?? 0,
    paid: totals?.paid ?? 0,
    revenue_24h: today?.revenue ?? 0,
    paid_24h: today?.paid ?? 0,
    by_status: Object.fromEntries(byStatus.results.map((r) => [r.status, r.n])),
    active_members: members?.n ?? 0,
    recent: recent.results.map(adminOrder),
  });
}

async function orders(db: D1Database, url: URL) {
  const status = str(url.searchParams.get("status"), 20).toUpperCase();
  const q = str(url.searchParams.get("q"), 80).trim().toLowerCase();
  const before = str(url.searchParams.get("before"), 40);
  const where: string[] = [];
  const args: unknown[] = [];
  if (/^(PENDING|SUCCESS|EXPIRED|CANCELLED|FAILED)$/.test(status)) {
    where.push("status = ?");
    args.push(status);
  }
  if (q) {
    where.push("(lower(user_email) LIKE ? OR lower(user_name) LIKE ? OR id LIKE ? OR lower(trx_id) LIKE ? OR lower(item_title) LIKE ?)");
    const like = `%${q.replace(/[%_]/g, "")}%`;
    args.push(like, like, like, like, like);
  }
  if (before) {
    where.push("created_at < ?");
    args.push(before);
  }
  const sql = `SELECT * FROM orders ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY created_at DESC LIMIT 50`;
  const rows = await db.prepare(sql).bind(...args).all<Order>();
  return reply({ ok: true, orders: rows.results.map(adminOrder), next: rows.results.length === 50 ? rows.results[49].created_at : null });
}

/** Re-asks the gateway; a payment that landed after we gave up still counts. */
async function recheck(env: ShopEnv, db: D1Database, id: string) {
  let o = await db.prepare("SELECT * FROM orders WHERE id = ?").bind(id).first<Order>();
  if (!o) return fail(404, "not_found", "No such order.");
  if (o.status === "PENDING") o = await refresh(env, db, o, true);
  else if (o.status !== "SUCCESS" && o.trx_id) {
    const r = await checkPayment(env, o.trx_id);
    if (r.ok && r.data?.status === "SUCCESS") {
      const flip = await db.prepare("UPDATE orders SET status = 'SUCCESS', paid_at = ?, released = 0 WHERE id = ? AND status != 'SUCCESS'").bind(new Date().toISOString(), o.id).run();
      if (flip.meta.changes) {
        if (o.released) {
          const ops = [];
          if (o.voucher) ops.push(db.prepare("UPDATE vouchers SET used = used + 1 WHERE code = ?").bind(o.voucher));
          if (o.kind === "membership") ops.push(db.prepare("UPDATE plans SET sold = sold + 1 WHERE id = ?").bind(o.item_id));
          if (ops.length) await db.batch(ops);
        }
        await grant(db, o);
      }
      o = (await db.prepare("SELECT * FROM orders WHERE id = ?").bind(id).first<Order>())!;
    }
  }
  return reply({ ok: true, order: adminOrder(o) });
}

/* ---------- plans ---------- */

async function savePlan(db: D1Database, request: Request) {
  const d = await body(request);
  const name = str(d.name, 60).trim();
  const description = str(d.description, 280).trim();
  const price = int(d.price, 0, 100_000_000);
  const days = int(d.duration_days, 1, 3650);
  const stock = d.stock === null || d.stock === "" || d.stock === undefined ? null : int(d.stock, 0, 1_000_000);
  const active = d.active === false ? 0 : 1;
  const sort = int(d.sort, -1000, 1000) ?? 0;
  if (name.length < 2) return fail(400, "invalid", "Give the plan a name.", "name");
  if (price == null) return fail(400, "invalid", "Enter a price in rupiah.", "price");
  if (days == null) return fail(400, "invalid", "Enter how many days it lasts (1–3650).", "duration_days");
  if (d.stock !== null && d.stock !== "" && d.stock !== undefined && stock == null) return fail(400, "invalid", "Stock must be a whole number, or empty for unlimited.", "stock");
  const id = /^[a-z0-9]{6,32}$/.test(str(d.id, 32)) ? str(d.id, 32) : null;
  if (id) {
    const r = await db
      .prepare("UPDATE plans SET name = ?, description = ?, price = ?, duration_days = ?, stock = ?, active = ?, sort = ? WHERE id = ?")
      .bind(name, description, price, days, stock, active, sort, id)
      .run();
    if (!r.meta.changes) return fail(404, "not_found", "No such plan.");
    return reply({ ok: true, id });
  }
  const newId = randomId(10);
  await db
    .prepare("INSERT INTO plans (id, name, description, price, duration_days, stock, active, sort, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(newId, name, description, price, days, stock, active, sort, new Date().toISOString())
    .run();
  return reply({ ok: true, id: newId });
}

/* ---------- vouchers ---------- */

async function saveVoucher(db: D1Database, request: Request) {
  const d = await body(request);
  const code = str(d.code, 40)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "");
  const kind = d.kind === "fixed" ? "fixed" : "percent";
  const value = int(d.value, 1, kind === "percent" ? 100 : 100_000_000);
  const applies = ["all", "ticket", "membership"].includes(String(d.applies_to)) ? String(d.applies_to) : "all";
  const maxUses = d.max_uses === null || d.max_uses === "" || d.max_uses === undefined ? null : int(d.max_uses, 1, 1_000_000);
  const expires = str(d.expires_at, 40).trim();
  const expiresIso = expires ? new Date(expires).toISOString() : null;
  const active = d.active === false ? 0 : 1;
  if (code.length < 3) return fail(400, "invalid", "Use a code of at least 3 letters or digits.", "code");
  if (value == null) return fail(400, "invalid", kind === "percent" ? "Use a percentage from 1 to 100." : "Enter an amount in rupiah.", "value");
  await db
    .prepare(
      `INSERT INTO vouchers (code, kind, value, applies_to, max_uses, expires_at, active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(code) DO UPDATE SET kind = excluded.kind, value = excluded.value, applies_to = excluded.applies_to, max_uses = excluded.max_uses, expires_at = excluded.expires_at, active = excluded.active`,
    )
    .bind(code, kind, value, applies, maxUses, expiresIso, active, new Date().toISOString())
    .run();
  return reply({ ok: true, code });
}

/* ---------- handler ---------- */

export async function handleAdmin(request: Request, env: ShopEnv, kv: KVNamespace, url: URL, sameOriginOk: boolean): Promise<Response> {
  if (!env.DB) return fail(503, "not_configured", "The shop database isn’t set up yet.");
  const db = env.DB;
  await ensureSchema(db);
  const path = url.pathname.replace(/^\/api\/admin/, "");
  const method = request.method;
  if (method !== "GET" && !sameOriginOk) return fail(403, "forbidden", "Cross-site requests are not allowed.");

  if (method === "GET" && path === "/summary") return summary(env, db);
  if (method === "GET" && path === "/orders") return orders(db, url);
  let m = /^\/orders\/([a-z0-9]{8,32})\/recheck$/.exec(path);
  if (method === "POST" && m) return recheck(env, db, m[1]);

  if (method === "GET" && path === "/plans") {
    const rows = await db.prepare("SELECT * FROM plans ORDER BY sort, price").all<Plan>();
    return reply({ ok: true, plans: rows.results });
  }
  if (method === "POST" && path === "/plans") return savePlan(db, request);
  m = /^\/plans\/([a-z0-9]{6,32})(\/stock)?$/.exec(path);
  if (m && method === "POST" && m[2]) {
    const add = int((await body(request)).add, -1_000_000, 1_000_000);
    if (add == null) return fail(400, "invalid", "Enter how many to add.", "add");
    await db.prepare("UPDATE plans SET stock = MAX(sold, COALESCE(stock, sold) + ?) WHERE id = ?").bind(add, m[1]).run();
    return reply({ ok: true });
  }
  if (m && method === "DELETE" && !m[2]) {
    const r = await db.prepare("DELETE FROM plans WHERE id = ? AND sold = 0").bind(m[1]).run();
    return r.meta.changes ? reply({ ok: true }) : fail(409, "in_use", "This plan has been sold; switch it off instead.");
  }

  if (method === "GET" && path === "/community") {
    const [channel, group] = await Promise.all([getSetting(db, "wa_channel_url"), getSetting(db, "wa_group_url")]);
    return reply({ ok: true, channel, group });
  }
  if (method === "POST" && path === "/community") {
    const d = await body(request);
    const links: [string, string, unknown][] = [
      ["wa_channel_url", "channel", d.channel],
      ["wa_group_url", "group", d.group],
    ];
    for (const [, field, v] of links) {
      const u = str(v, 300).trim();
      if (u && !waLink(u)) return fail(400, "invalid", "Use a WhatsApp link (https://whatsapp.com/channel/… or https://chat.whatsapp.com/…).", field);
    }
    for (const [key, , v] of links) {
      const u = str(v, 300).trim();
      if (u) await setSetting(db, key, u);
      else await db.prepare("DELETE FROM settings WHERE key = ?").bind(key).run();
    }
    return reply({ ok: true });
  }

  if (method === "GET" && path === "/pricing") {
    const [global, products, shows] = await Promise.all([getSetting(db, "ticket_price"), db.prepare("SELECT * FROM products").all(), theaterShows(env)]);
    return reply({ ok: true, ticket_price: global != null ? Number(global) : null, products: products.results, shows: shows ?? [] });
  }
  if (method === "POST" && path === "/pricing") {
    const d = await body(request);
    if (d.ticket_price === null || d.ticket_price === "") {
      await db.prepare("DELETE FROM settings WHERE key = 'ticket_price'").run();
      return reply({ ok: true });
    }
    const price = int(d.ticket_price, 0, 100_000_000);
    if (price == null) return fail(400, "invalid", "Enter a price in rupiah.", "ticket_price");
    await setSetting(db, "ticket_price", String(price));
    return reply({ ok: true });
  }
  if (method === "POST" && path === "/products") {
    const d = await body(request);
    const slug = str(d.show_slug, 40).toLowerCase();
    if (!/^[a-z0-9_-]{1,40}$/.test(slug)) return fail(400, "invalid", "Choose a show.");
    const price = d.price === null || d.price === "" || d.price === undefined ? null : int(d.price, 0, 100_000_000);
    if (d.price !== null && d.price !== "" && d.price !== undefined && price == null) return fail(400, "invalid", "Enter a price in rupiah, or leave it empty for the global price.", "price");
    const stream = str(d.stream_slug, 80).trim().toLowerCase() || null;
    if (stream && !/^[a-z0-9][a-z0-9_-]{0,79}$/.test(stream)) return fail(400, "invalid", "That stream slug doesn’t look right.", "stream_slug");
    await db
      .prepare(
        `INSERT INTO products (show_slug, price, on_sale, stream_slug, updated_at) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(show_slug) DO UPDATE SET price = excluded.price, on_sale = excluded.on_sale, stream_slug = excluded.stream_slug, updated_at = excluded.updated_at`,
      )
      .bind(slug, price, d.on_sale === false ? 0 : 1, stream, new Date().toISOString())
      .run();
    return reply({ ok: true });
  }
  m = /^\/products\/([a-z0-9_-]{1,40})$/.exec(path);
  if (m && method === "DELETE") {
    await db.prepare("DELETE FROM products WHERE show_slug = ?").bind(m[1]).run();
    return reply({ ok: true });
  }

  if (method === "GET" && path === "/vouchers") {
    const rows = await db.prepare("SELECT * FROM vouchers ORDER BY created_at DESC").all();
    return reply({ ok: true, vouchers: rows.results });
  }
  if (method === "POST" && path === "/vouchers") return saveVoucher(db, request);
  m = /^\/vouchers\/([A-Z0-9_-]{1,40})$/.exec(path);
  if (m && method === "DELETE") {
    await db.prepare("DELETE FROM vouchers WHERE code = ?").bind(m[1]).run();
    return reply({ ok: true });
  }

  if (method === "GET" && path === "/members") {
    const rows = await db
      .prepare(
        `SELECT m.*, (SELECT user_email FROM orders o WHERE o.user_id = m.user_id ORDER BY created_at DESC LIMIT 1) AS email,
                (SELECT user_name FROM orders o WHERE o.user_id = m.user_id ORDER BY created_at DESC LIMIT 1) AS name
         FROM memberships m ORDER BY expires_at DESC LIMIT 200`,
      )
      .all();
    return reply({ ok: true, members: rows.results });
  }
  if (method === "POST" && path === "/members") {
    const d = await body(request);
    const email = str(d.email, 254).trim().toLowerCase();
    const user = await kv.get<{ id: string; name: string }>(`user:${email}`, "json");
    if (!user) return fail(404, "not_found", "No account uses that email.", "email");
    const plan = await db.prepare("SELECT * FROM plans WHERE id = ?").bind(str(d.plan_id, 32)).first<Plan>();
    const days = int(d.days, 1, 3650) ?? plan?.duration_days ?? null;
    if (days == null) return fail(400, "invalid", "Choose a plan or enter the number of days.", "days");
    const expires = await extendMembership(db, user.id, plan?.id ?? "manual", plan?.name ?? "Membership", days);
    return reply({ ok: true, expires_at: expires });
  }

  // One member: change how long the pass runs, or take it away.
  m = /^\/members\/([A-Za-z0-9_-]{6,64})$/.exec(path);
  if (m && method === "PATCH") {
    const current = await db.prepare("SELECT * FROM memberships WHERE user_id = ?").bind(m[1]).first<{ expires_at: string; started_at: string }>();
    if (!current) return fail(404, "not_found", "That account has no membership. Give one instead.");
    const d = await body(request);
    let expires: number;
    if (typeof d.until === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d.until)) {
      expires = Date.parse(`${d.until}T23:59:59+07:00`);
    } else {
      const add = int(d.add_days, -3650, 3650);
      if (add == null || add === 0) return fail(400, "invalid", "Enter the number of days to add or remove, or an end date.", "add_days");
      expires = Math.max(Date.now(), Date.parse(current.expires_at)) + add * 86400000;
    }
    if (Number.isNaN(expires)) return fail(400, "invalid", "That date isn’t valid.", "until");
    const iso = new Date(expires).toISOString();
    await db.prepare("UPDATE memberships SET expires_at = ? WHERE user_id = ?").bind(iso, m[1]).run();
    return reply({ ok: true, expires_at: iso });
  }
  if (m && method === "DELETE") {
    await db.prepare("DELETE FROM memberships WHERE user_id = ?").bind(m[1]).run();
    return reply({ ok: true });
  }

  if (method === "GET" && path === "/users") {
    const email = (url.searchParams.get("email") ?? "").trim().toLowerCase().slice(0, 254);
    const user = email ? await kv.get<{ id: string; name: string; email: string; createdAt?: string }>(`user:${email}`, "json") : null;
    if (!user) return fail(404, "not_found", "No account uses that email.", "email");
    const [membership, tickets] = await Promise.all([
      db.prepare("SELECT plan_id, plan_name, started_at, expires_at FROM memberships WHERE user_id = ?").bind(user.id).first(),
      db
        .prepare("SELECT t.show_slug, t.order_id, t.created_at, o.item_title AS title FROM tickets t LEFT JOIN orders o ON o.id = t.order_id WHERE t.user_id = ? ORDER BY t.created_at DESC")
        .bind(user.id)
        .all(),
    ]);
    return reply({ ok: true, user: { id: user.id, name: user.name, email: user.email ?? email, createdAt: user.createdAt ?? null }, membership: membership ?? null, tickets: tickets.results });
  }

  m = /^\/tickets\/([A-Za-z0-9_-]{6,64})\/([A-Za-z0-9_-]{1,160})$/.exec(path);
  if (m && method === "DELETE") {
    await db.prepare("DELETE FROM tickets WHERE user_id = ? AND show_slug = ?").bind(m[1], m[2]).run();
    return reply({ ok: true });
  }

  return fail(404, "not_found", "Not found.");
}
