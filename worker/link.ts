/**
 * Linking an Avonera48 account to a JKT48Connect account. While linked, the
 * JKT48Connect membership counts as an Avonera48 membership (see
 * `membershipOf` in worker/shop.ts); a membership bought here is never touched.
 *
 * The flow (JKT48Connect is the app that owns the membership):
 *   1. Avonera48 (signed in)  POST /api/link/jkt48connect/start → { url }
 *      The browser goes to JKT48CONNECT_APP_URL/connect/avonera?state=…&redirect_uri=…
 *   2. JKT48Connect asks its user to allow it, then its server calls
 *      POST /api/integrations/jkt48connect/grant (signed) { state, account, membership }
 *      → { code, redirect_url } and sends the browser to redirect_url.
 *   3. /dashboard/connect/jkt48connect?code=… shows both accounts and the
 *      membership; the user confirms (POST /api/link/jkt48connect/confirm) or cancels.
 *   4. Afterwards JKT48Connect pushes changes:
 *      POST /api/integrations/jkt48connect/membership (signed) { account_id, membership }
 *
 * Signed requests (both directions) carry
 *   x-avonera-timestamp: <unix seconds>
 *   x-avonera-signature: sha256=<hex HMAC-SHA256(JKT48CONNECT_LINK_SECRET, `${timestamp}.${raw body}`)>
 * and are refused when the clock is more than 5 minutes off.
 *
 * Signed in (cookie):
 *   GET    /api/link/jkt48connect             the link, if any
 *   POST   /api/link/jkt48connect/start       → { url }
 *   GET    /api/link/jkt48connect/pending?code=   what a confirm would link
 *   POST   /api/link/jkt48connect/confirm     { code }
 *   POST   /api/link/jkt48connect/cancel      { code }
 *   POST   /api/link/jkt48connect/sync        pull the membership now (needs JKT48CONNECT_SYNC_URL)
 *   DELETE /api/link/jkt48connect             unlink
 * Signed by JKT48Connect:
 *   POST /api/integrations/jkt48connect/grant       { state, account, membership }
 *   POST /api/integrations/jkt48connect/membership  { account_id, membership }
 *   POST /api/integrations/jkt48connect/status      { account_id }
 *   POST /api/integrations/jkt48connect/unlink      { account_id }
 *
 * KV: link:state:<state> and link:code:<code>, both single use, 10 minutes.
 */

import { ensureSchema } from "./db";
import { body, fail, randomHex, reply, str } from "./http";
import { readMembership, sign, verified, type LinkedMembership } from "./linkSign";

export interface LinkEnv {
  AUTH?: KVNamespace;
  DB?: D1Database;
  /** Shared with JKT48Connect: `wrangler pages secret put JKT48CONNECT_LINK_SECRET`. */
  JKT48CONNECT_LINK_SECRET?: string;
  /** Where JKT48Connect runs, e.g. https://jkt48connect.com (its /connect/avonera page). */
  JKT48CONNECT_APP_URL?: string;
  /** Optional: JKT48Connect's signed endpoint for pulling a membership and hearing about unlinks. */
  JKT48CONNECT_SYNC_URL?: string;
}

interface Viewer {
  id: string;
  name: string;
  email: string;
}

export interface LinkedAccount {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
}

interface StateRecord {
  uid: string;
  redirect: string;
}

interface CodeRecord {
  uid: string;
  account: LinkedAccount;
  membership: LinkedMembership | null;
}

interface LinkRow {
  user_id: string;
  external_id: string;
  ext_email: string;
  ext_name: string;
  ext_avatar: string | null;
  plan_id: string | null;
  plan_name: string | null;
  plan_expires_at: string | null;
  linked_at: string;
  synced_at: string;
}

const PROVIDER = "jkt48connect";
const TTL = 600;

const ready = (env: LinkEnv) => !!(env.JKT48CONNECT_LINK_SECRET && env.JKT48CONNECT_APP_URL && env.DB);

/* ---------- payload checks ---------- */

function readAccount(v: unknown): LinkedAccount | null {
  const a = (v ?? {}) as Record<string, unknown>;
  const id = str(a.id, 128).trim();
  if (!id) return null;
  const avatar = str(a.avatar_url ?? a.avatar, 500);
  return {
    id,
    email: str(a.email, 254).trim().toLowerCase(),
    name: str(a.name, 80).trim() || "JKT48Connect member",
    avatar: /^https:\/\//.test(avatar) ? avatar : null,
  };
}

/* ---------- storage ---------- */

const getLink = (db: D1Database, uid: string) => db.prepare("SELECT * FROM account_links WHERE user_id = ? AND provider = ?").bind(uid, PROVIDER).first<LinkRow>();
const linkOf = (db: D1Database, externalId: string) => db.prepare("SELECT * FROM account_links WHERE provider = ? AND external_id = ?").bind(PROVIDER, externalId).first<LinkRow>();

async function setMembership(db: D1Database, externalId: string, m: LinkedMembership | null) {
  await db
    .prepare("UPDATE account_links SET plan_id = ?, plan_name = ?, plan_expires_at = ?, synced_at = ? WHERE provider = ? AND external_id = ?")
    .bind(m?.plan_id ?? null, m?.plan_name ?? null, m?.expires_at ?? null, new Date().toISOString(), PROVIDER, externalId)
    .run();
}

const publicLink = (l: LinkRow) => ({
  provider: PROVIDER,
  account: { id: l.external_id, email: l.ext_email, name: l.ext_name, avatar: l.ext_avatar },
  membership: l.plan_expires_at && Date.parse(l.plan_expires_at) > Date.now() ? { plan_id: l.plan_id, plan_name: l.plan_name, expires_at: l.plan_expires_at } : null,
  linked_at: l.linked_at,
  synced_at: l.synced_at,
});

/** Tells JKT48Connect something, signed. Null when it isn't set up or doesn't answer. */
async function callJkt(env: LinkEnv, payload: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  if (!env.JKT48CONNECT_SYNC_URL || !env.JKT48CONNECT_LINK_SECRET) return null;
  const raw = JSON.stringify(payload);
  const ts = String(Math.floor(Date.now() / 1000));
  try {
    const res = await fetch(env.JKT48CONNECT_SYNC_URL, {
      method: "POST",
      headers: { "content-type": "application/json", "x-avonera-timestamp": ts, "x-avonera-signature": await sign(env.JKT48CONNECT_LINK_SECRET, ts, raw) },
      body: raw,
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/* ---------- signed in ---------- */

/** /api/link/… for the signed-in viewer. */
export async function handleLink(request: Request, env: LinkEnv, viewer: Viewer, url: URL, jsonOk: boolean, sameSite: boolean): Promise<Response> {
  const kv = env.AUTH!;
  const db = env.DB;
  const method = request.method;
  const path = url.pathname.replace(/\/+$/, "");
  if (!db) return fail(503, "not_configured", "Accounts can’t be linked on this server yet.");
  await ensureSchema(db);

  if (path === "/api/link/jkt48connect" && method === "GET") {
    const link = await getLink(db, viewer.id);
    return reply({ ok: true, available: ready(env), syncable: !!env.JKT48CONNECT_SYNC_URL, link: link ? publicLink(link) : null });
  }

  if (path === "/api/link/jkt48connect" && method === "DELETE") {
    if (!sameSite) return fail(403, "forbidden", "Cross-site requests are not allowed.");
    const link = await getLink(db, viewer.id);
    if (!link) return reply({ ok: true, link: null });
    await db.prepare("DELETE FROM account_links WHERE user_id = ? AND provider = ?").bind(viewer.id, PROVIDER).run();
    await callJkt(env, { action: "unlinked", account_id: link.external_id });
    return reply({ ok: true, link: null });
  }

  if (method !== "GET" && !jsonOk) return fail(403, "forbidden", "Cross-site requests are not allowed.");
  if (!ready(env)) return fail(503, "not_configured", "Linking JKT48Connect accounts isn’t set up yet.");

  if (path === "/api/link/jkt48connect/start" && method === "POST") {
    if (await getLink(db, viewer.id)) return fail(409, "already_linked", "This account is already linked. Unlink it first.");
    const state = randomHex(24);
    const redirect = `${url.origin}/dashboard/connect/jkt48connect`;
    await kv.put(`link:state:${state}`, JSON.stringify({ uid: viewer.id, redirect } satisfies StateRecord), { expirationTtl: TTL });
    const to = new URL("/connect/avonera", env.JKT48CONNECT_APP_URL);
    to.searchParams.set("state", state);
    to.searchParams.set("redirect_uri", redirect);
    to.searchParams.set("app", "avonera48");
    return reply({ ok: true, url: to.toString() });
  }

  const code = method === "GET" ? (url.searchParams.get("code") ?? "") : str((await body(request)).code, 80);
  const grant = /^[a-f0-9]{48}$/.test(code) ? await kv.get<CodeRecord>(`link:code:${code}`, "json") : null;
  const owned = grant && grant.uid === viewer.id ? grant : null;

  if (path === "/api/link/jkt48connect/pending" && method === "GET") {
    if (!owned) return fail(404, "expired", "This link request has expired or isn’t yours. Start again.");
    const taken = await linkOf(db, owned.account.id);
    return reply({ ok: true, account: owned.account, membership: owned.membership, taken: !!taken && taken.user_id !== viewer.id });
  }

  if (path === "/api/link/jkt48connect/cancel" && method === "POST") {
    if (owned) await kv.delete(`link:code:${code}`);
    return reply({ ok: true });
  }

  if (path === "/api/link/jkt48connect/confirm" && method === "POST") {
    if (!owned) return fail(404, "expired", "This link request has expired or isn’t yours. Start again.");
    await kv.delete(`link:code:${code}`);
    const taken = await linkOf(db, owned.account.id);
    if (taken && taken.user_id !== viewer.id) return fail(409, "taken", "That JKT48Connect account is linked to another Avonera48 account.");
    if (await getLink(db, viewer.id)) return fail(409, "already_linked", "This account is already linked. Unlink it first.");
    const now = new Date().toISOString();
    const a = owned.account;
    const m = owned.membership;
    await db
      .prepare(
        `INSERT INTO account_links (user_id, provider, external_id, ext_email, ext_name, ext_avatar, plan_id, plan_name, plan_expires_at, linked_at, synced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(viewer.id, PROVIDER, a.id, a.email, a.name, a.avatar, m?.plan_id ?? null, m?.plan_name ?? null, m?.expires_at ?? null, now, now)
      .run();
    return reply({ ok: true, link: publicLink((await getLink(db, viewer.id))!) });
  }

  if (path === "/api/link/jkt48connect/sync" && method === "POST") {
    const link = await getLink(db, viewer.id);
    if (!link) return fail(404, "not_linked", "No JKT48Connect account is linked.");
    if (!env.JKT48CONNECT_SYNC_URL) return fail(503, "not_configured", "Syncing on demand isn’t set up. Changes still arrive from JKT48Connect.");
    const res = await callJkt(env, { action: "membership", account_id: link.external_id });
    if (!res || res.ok === false) return fail(502, "upstream", "JKT48Connect didn’t answer. Try again in a moment.");
    if (res.linked === false) {
      await db.prepare("DELETE FROM account_links WHERE user_id = ? AND provider = ?").bind(viewer.id, PROVIDER).run();
      return reply({ ok: true, link: null });
    }
    await setMembership(db, link.external_id, readMembership(res.membership));
    return reply({ ok: true, link: publicLink((await getLink(db, viewer.id))!) });
  }

  return fail(404, "not_found", "Not found.");
}

/* ---------- signed by JKT48Connect ---------- */

/** /api/integrations/jkt48connect/…: server-to-server, signed, no cookie. */
export async function handleIntegration(request: Request, env: LinkEnv, url: URL): Promise<Response> {
  const kv = env.AUTH!;
  const db = env.DB;
  if (request.method === "OPTIONS") return new Response(null, { status: 204 });
  if (request.method !== "POST") return fail(405, "method", "POST only.");
  if (!ready(env) || !db) return fail(503, "not_configured", "Account linking isn’t set up on this server.");
  const data = await verified(request, env.JKT48CONNECT_LINK_SECRET!);
  if (!data) return fail(401, "bad_signature", "Missing, stale or wrong signature.");
  await ensureSchema(db);
  const action = url.pathname.replace(/\/+$/, "").split("/").pop();

  if (action === "grant") {
    const state = str(data.state, 80);
    const account = readAccount(data.account);
    if (!account) return fail(400, "invalid", "account.id is required.", "account");
    const rec = /^[a-f0-9]{48}$/.test(state) ? await kv.get<StateRecord>(`link:state:${state}`, "json") : null;
    if (!rec) return fail(404, "expired", "Unknown or expired state. The user has to start again from Avonera48.");
    await kv.delete(`link:state:${state}`);
    const code = randomHex(24);
    await kv.put(`link:code:${code}`, JSON.stringify({ uid: rec.uid, account, membership: readMembership(data.membership) } satisfies CodeRecord), { expirationTtl: TTL });
    const to = new URL(rec.redirect);
    to.searchParams.set("code", code);
    return reply({ ok: true, code, redirect_url: to.toString() });
  }

  const accountId = str(data.account_id, 128).trim();
  if (!accountId) return fail(400, "invalid", "account_id is required.", "account_id");
  const link = await linkOf(db, accountId);

  if (action === "status") {
    return reply({ ok: true, linked: !!link, linked_at: link?.linked_at ?? null, synced_at: link?.synced_at ?? null, membership: link ? publicLink(link).membership : null });
  }
  if (action === "membership") {
    if (!link) return reply({ ok: true, linked: false });
    const m = readMembership(data.membership);
    await setMembership(db, accountId, m);
    if (data.account) {
      const a = readAccount({ ...(data.account as object), id: accountId });
      if (a) await db.prepare("UPDATE account_links SET ext_email = ?, ext_name = ?, ext_avatar = ? WHERE provider = ? AND external_id = ?").bind(a.email, a.name, a.avatar, PROVIDER, accountId).run();
    }
    return reply({ ok: true, linked: true, membership: m });
  }
  if (action === "unlink") {
    if (link) await db.prepare("DELETE FROM account_links WHERE provider = ? AND external_id = ?").bind(PROVIDER, accountId).run();
    return reply({ ok: true, linked: false });
  }
  return fail(404, "not_found", "Not found.");
}
