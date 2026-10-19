/**
 * Accounts, the members' area and its API router.
 *
 *   POST /api/auth/register   { name, email, password }
 *   POST /api/auth/login      { email, password }
 *   POST /api/auth/logout
 *   GET  /api/auth/me
 *   POST /api/auth/profile    { name }
 *   POST /api/auth/password   { current, next }
 *   PUT  /api/auth/avatar     image body (webp/jpeg/png, ≤ 300 KB)   DELETE /api/auth/avatar
 *   GET  /api/avatar/:uid     a member's photo
 *
 *   GET  /api/room            (signed in) shows the room can open now
 *   POST /api/room/session    (signed in) { show } → same-origin playback for a show the viewer may watch
 *   GET  /api/room/media      proxied playlists and segments (worker/roomMedia.ts)
 *   /api/room/:show/comments… live chat (worker/comments.ts)
 *   /api/shop/…               tickets, memberships, payments (worker/shop.ts)
 *   /api/admin/…              admin control (worker/admin.ts)
 *   GET  /api/admin/accounts                 admins and verified accounts
 *   POST /api/admin/accounts                 { name, email, password, admin, verified } create an account
 *   PATCH /api/admin/accounts/:email         { admin?, verified? }
 *   /api/link/…               linking a JKT48Connect account (worker/link.ts)
 *   /api/integrations/…       signed calls from JKT48Connect (worker/link.ts)
 *
 * KV namespace AUTH:
 *   user:<email>          account record (PBKDF2-SHA256 password hash)
 *   sess:<sha256(token)>  session, expires with the cookie (30 days)
 *   avatar:<uid>          profile photo bytes
 *   rl:<kind>:<key>       attempt counter for rate limiting (10 minutes)
 * D1 database DB: shop, memberships and comments (worker/db.ts).
 *
 * The session token lives only in an HttpOnly, Secure, SameSite=Lax cookie.
 * State-changing requests must be same-origin.
 */

import { handleAdmin } from "./admin";
import { handleAm, type AmEnv } from "./am";
import { handleComments } from "./comments";
import { handleIntegration, handleLink, type LinkEnv } from "./link";
import { ensureSchema } from "./db";
import { body, enc, fail, hex, randomHex, reply, sameOrigin, sha256, str } from "./http";
import { partnerCall, partnerReady, type PartnerEnv, type PartnerSession, type PartnerShow } from "./partner";
import { PlaybackError, openProxied, roomMedia } from "./roomMedia";
import { accessTo, handleShop, isAdmin, type ShopEnv } from "./shop";

export interface AuthEnv extends PartnerEnv, ShopEnv, LinkEnv, AmEnv {
  AUTH?: KVNamespace;
}

interface UserRecord {
  id: string;
  name: string;
  email: string;
  salt: string;
  hash: string;
  iterations: number;
  createdAt: string;
  /** Version of the uploaded profile photo, if any. */
  avatar?: number;
  /** Made an admin by another admin (ADMIN_EMAILS are owners and always admins). */
  role?: "admin";
  /** Blue check next to the name. */
  verified?: boolean;
}

interface Session {
  email: string;
  createdAt: string;
}

const COOKIE = "avn_session";
const SESSION_TTL = 60 * 60 * 24 * 30;
const ITERATIONS = 100_000; // the Workers runtime's PBKDF2 maximum
const RATE_WINDOW = 600;
const RATE_MAX: Record<string, number> = { login: 10, register: 5, session: 12, password: 6 };
const AVATAR_MAX = 300 * 1024;

async function derive(password: string, saltHex: string, iterations: number) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const salt = new Uint8Array(saltHex.match(/../g)!.map((h) => parseInt(h, 16)));
  return hex(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256));
}

/** Compare two equal-length hex strings without an early exit. */
function same(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let k = 0; k < a.length; k++) diff |= a.charCodeAt(k) ^ b.charCodeAt(k);
  return diff === 0;
}

const avatarUrl = (u: UserRecord) => (u.avatar ? `/api/avatar/${u.id}?v=${u.avatar}` : null);

/** Owners (ADMIN_EMAILS) and accounts another admin promoted. */
const adminOf = (env: AuthEnv, u: UserRecord) => isAdmin(env, u.email) || u.role === "admin";

const publicUser = (u: UserRecord, env: AuthEnv) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  createdAt: u.createdAt,
  avatar: avatarUrl(u),
  isAdmin: adminOf(env, u),
  verified: !!u.verified,
});

function readCookie(request: Request, name: string) {
  const raw = request.headers.get("cookie") ?? "";
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}

const sessionCookie = (token: string, maxAge: number) => `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;

const normEmail = (v: string) => v.trim().toLowerCase();
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

async function limited(kv: KVNamespace, kind: string, request: Request, who?: string) {
  const ip = who ?? request.headers.get("cf-connecting-ip") ?? "local";
  const key = `rl:${kind}:${ip}`;
  const n = Number((await kv.get(key)) ?? 0) + 1;
  await kv.put(key, String(n), { expirationTtl: RATE_WINDOW });
  return n > RATE_MAX[kind];
}

async function startSession(kv: KVNamespace, email: string) {
  const token = randomHex(32);
  const session: Session = { email, createdAt: new Date().toISOString() };
  await kv.put(`sess:${await sha256(token)}`, JSON.stringify(session), { expirationTtl: SESSION_TTL });
  return token;
}

export async function currentUser(request: Request, kv: KVNamespace): Promise<UserRecord | null> {
  const token = readCookie(request, COOKIE);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const session = await kv.get<Session>(`sess:${await sha256(token)}`, "json");
  if (!session) return null;
  return kv.get<UserRecord>(`user:${session.email}`, "json");
}

/* ---------- sign up / in / out ---------- */

async function register(request: Request, env: AuthEnv, kv: KVNamespace) {
  if (await limited(kv, "register", request)) return fail(429, "rate_limited", "Too many attempts. Try again in a few minutes.");
  const data = await body(request);
  const name = str(data.name, 80).trim().replace(/\s+/g, " ");
  const email = normEmail(str(data.email, 254));
  const password = str(data.password, 200);
  if (name.length < 2 || name.length > 40) return fail(400, "invalid", "Use 2 to 40 characters for your name.", "name");
  if (!EMAIL.test(email)) return fail(400, "invalid", "Enter a valid email address.", "email");
  if (password.length < 8) return fail(400, "invalid", "Use at least 8 characters for your password.", "password");
  if (password.length > 128) return fail(400, "invalid", "Use at most 128 characters for your password.", "password");
  if (await kv.get(`user:${email}`)) return fail(409, "exists", "An account with this email already exists.", "email");

  const salt = randomHex(16);
  const user: UserRecord = { id: crypto.randomUUID(), name, email, salt, hash: await derive(password, salt, ITERATIONS), iterations: ITERATIONS, createdAt: new Date().toISOString() };
  await kv.put(`user:${email}`, JSON.stringify(user));
  const token = await startSession(kv, email);
  return reply({ ok: true, user: publicUser(user, env) }, 201, { "set-cookie": sessionCookie(token, SESSION_TTL) });
}

async function login(request: Request, env: AuthEnv, kv: KVNamespace) {
  if (await limited(kv, "login", request)) return fail(429, "rate_limited", "Too many attempts. Try again in a few minutes.");
  const data = await body(request);
  const email = normEmail(str(data.email, 254));
  const password = str(data.password, 200);
  const user = EMAIL.test(email) ? await kv.get<UserRecord>(`user:${email}`, "json") : null;
  // Derive even when the account is missing, so timing doesn't reveal which emails exist.
  const hash = await derive(password, user?.salt ?? "00".repeat(16), user?.iterations ?? ITERATIONS);
  if (!user || !same(hash, user.hash)) return fail(401, "invalid_credentials", "That email and password don’t match an account.");
  const token = await startSession(kv, email);
  return reply({ ok: true, user: publicUser(user, env) }, 200, { "set-cookie": sessionCookie(token, SESSION_TTL) });
}

async function logout(request: Request, kv: KVNamespace) {
  const token = readCookie(request, COOKIE);
  if (token && /^[a-f0-9]{64}$/.test(token)) await kv.delete(`sess:${await sha256(token)}`);
  return reply({ ok: true }, 200, { "set-cookie": sessionCookie("", 0) });
}

/* ---------- profile ---------- */

async function saveUser(kv: KVNamespace, u: UserRecord) {
  await kv.put(`user:${u.email}`, JSON.stringify(u));
}

async function profile(request: Request, env: AuthEnv, kv: KVNamespace, u: UserRecord) {
  const name = str((await body(request)).name, 80).trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 40) return fail(400, "invalid", "Use 2 to 40 characters for your name.", "name");
  u.name = name;
  await saveUser(kv, u);
  if (u.role || u.verified) await indexFlags(env, u);
  return reply({ ok: true, user: publicUser(u, env) });
}

async function password(request: Request, env: AuthEnv, kv: KVNamespace, u: UserRecord) {
  if (await limited(kv, "password", request, u.id)) return fail(429, "rate_limited", "Too many attempts. Try again in a few minutes.");
  const data = await body(request);
  const current = str(data.current, 200);
  const next = str(data.next, 200);
  if (!same(await derive(current, u.salt, u.iterations), u.hash)) return fail(400, "invalid", "Your current password isn’t right.", "current");
  if (next.length < 8 || next.length > 128) return fail(400, "invalid", "Use 8 to 128 characters for your new password.", "next");
  u.salt = randomHex(16);
  u.iterations = ITERATIONS;
  u.hash = await derive(next, u.salt, ITERATIONS);
  await saveUser(kv, u);
  return reply({ ok: true, user: publicUser(u, env) });
}

const IMAGE_TYPES = ["image/webp", "image/jpeg", "image/png"];

async function putAvatar(request: Request, env: AuthEnv, kv: KVNamespace, u: UserRecord) {
  const type = (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!IMAGE_TYPES.includes(type)) return fail(415, "invalid", "Use a WebP, JPEG or PNG image.");
  const bytes = await request.arrayBuffer();
  if (!bytes.byteLength || bytes.byteLength > AVATAR_MAX) return fail(413, "too_large", "That image is too large (300 KB at most).");
  await kv.put(`avatar:${u.id}`, bytes, { metadata: { type } });
  u.avatar = Date.now();
  await saveUser(kv, u);
  return reply({ ok: true, user: publicUser(u, env) });
}

async function deleteAvatar(env: AuthEnv, kv: KVNamespace, u: UserRecord) {
  await kv.delete(`avatar:${u.id}`);
  delete u.avatar;
  await saveUser(kv, u);
  return reply({ ok: true, user: publicUser(u, env) });
}

async function getAvatar(kv: KVNamespace, uid: string) {
  const { value, metadata } = await kv.getWithMetadata<{ type: string }>(`avatar:${uid}`, "arrayBuffer");
  if (!value) return new Response("Not found", { status: 404 });
  return new Response(value, { headers: { "content-type": metadata?.type ?? "image/webp", "cache-control": "public, max-age=31536000, immutable", "x-content-type-options": "nosniff" } });
}

/* ---------- the room ---------- */

const PARTNER_ERRORS: Record<string, [number, string]> = {
  SHOW_NOT_PURCHASED: [403, "This show isn’t available in the room."],
  VIEW_QUOTA_EXCEEDED: [403, "The room is full right now. Try again later."],
  SIGNATURE_REJECTED: [502, "The room can’t reach the video service right now."],
  REPLAY_DETECTED: [502, "The room can’t reach the video service right now."],
};

async function roomShows(env: AuthEnv) {
  // Cached briefly at the edge; the list is the same for every viewer.
  const cache = caches.default;
  const key = new Request("https://room.internal/shows?v=1");
  const hit = await cache.match(key);
  if (hit) return (await hit.json()) as PartnerShow[];
  const r = await partnerCall<{ shows?: PartnerShow[] }>(env, "GET", "/api/public/partner/v1/shows");
  if (!r.ok) return null;
  const shows = (r.data.shows ?? []).map((s) => ({ show_slug: s.show_slug, title: s.title, entitled: !!s.entitled, reason: s.reason ?? null }));
  await cache.put(key, new Response(JSON.stringify(shows), { headers: { "cache-control": "public, max-age=30" } }));
  return shows;
}

async function room(env: AuthEnv) {
  if (!partnerReady(env)) return reply({ ok: true, configured: false, shows: [] });
  const shows = await roomShows(env);
  if (!shows) return reply({ ok: true, configured: true, available: false, shows: [] });
  return reply({ ok: true, configured: true, available: true, shows: shows.map((s) => ({ slug: s.show_slug, title: s.title, open: s.entitled })) });
}

async function roomSession(request: Request, env: AuthEnv, kv: KVNamespace, user: UserRecord) {
  if (!partnerReady(env)) return fail(503, "not_configured", "The theater room isn’t set up yet.");
  const data = await body(request);
  const show = str(data.show ?? data.show_slug, 80).toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{0,79}$/.test(show)) return fail(400, "invalid", "Choose a show.");

  // With the shop on, a show needs a ticket or a membership (admins may always watch),
  // and the stream is the product's mapped stream or whatever the partner has open.
  let stream = show;
  if (env.DB) {
    await ensureSchema(env.DB);
    if (!adminOf(env, user) && !(await accessTo(env.DB, user.id, show))) return fail(402, "no_access", "Get a ticket or a membership to watch this show.");
    const mapped = await env.DB.prepare("SELECT stream_slug FROM products WHERE show_slug = ?").bind(show).first<{ stream_slug: string | null }>();
    const open = (await roomShows(env))?.find((s) => s.entitled)?.show_slug;
    stream = mapped?.stream_slug || open || show;
  }

  if (await limited(kv, "session", request, user.id)) return fail(429, "rate_limited", "Too many tries. Wait a few minutes and enter again.");
  const r = await partnerCall<PartnerSession>(env, "POST", "/api/public/partner/v1/session", { show_slug: stream, viewer_id: user.id, ttl: 120 });
  if (!r.ok || !r.data.playback_url) {
    const [status, message] = PARTNER_ERRORS[r.data.code ?? ""] ?? [502, "The room couldn’t open. Try again in a moment."];
    return fail(status, (r.data.code ?? "upstream_error").toLowerCase(), message);
  }
  const resume = typeof r.data.resume_url === "string" && /^https?:\/\//.test(r.data.resume_url) ? r.data.resume_url : null;
  // Always through this site: the server opens the playback URL and hands the
  // player same-origin URLs, so the partner's address never reaches the browser.
  try {
    const opened = await openProxied(env, kv, user.id, r.data.playback_url, resume, request.headers.get("user-agent") ?? "Mozilla/5.0", new URL(request.url).origin);
    return reply({ ok: true, proxied: true, ...opened, max_resolution: r.data.max_resolution ?? null });
  } catch (error) {
    if (error instanceof PlaybackError) {
      console.warn("[room] playback failed", error.code, error.diagnostic ?? null);
      return reply({
        ok: false, error: error.code, message: error.message,
        ...(adminOf(env, user) && error.diagnostic ? { diagnostic: error.diagnostic } : {}),
      }, 502);
    }
    throw error;
  }
}

/* ---------- admins and verified accounts ---------- */

interface FlagRow {
  user_id: string;
  email: string;
  name: string;
  admin: number;
  verified: number;
}

const accountOut = (env: AuthEnv, u: UserRecord) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  createdAt: u.createdAt,
  avatar: avatarUrl(u),
  admin: adminOf(env, u),
  owner: isAdmin(env, u.email),
  verified: !!u.verified,
});

/** Keeps the D1 index (for listing) in step with the account record. */
async function indexFlags(env: AuthEnv, u: UserRecord) {
  if (!env.DB) return;
  await ensureSchema(env.DB);
  if (u.role !== "admin" && !u.verified) {
    await env.DB.prepare("DELETE FROM account_flags WHERE user_id = ?").bind(u.id).run();
  } else {
    await env.DB.prepare(
      `INSERT INTO account_flags (user_id, email, name, admin, verified, updated_at) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET email = excluded.email, name = excluded.name, admin = excluded.admin, verified = excluded.verified, updated_at = excluded.updated_at`,
    )
      .bind(u.id, u.email, u.name, u.role === "admin" ? 1 : 0, u.verified ? 1 : 0, new Date().toISOString())
      .run();
  }
  // Their chat messages carry the check too.
  await env.DB.prepare("UPDATE comments SET verified = ? WHERE user_id = ?").bind(u.verified ? 1 : 0, u.id).run();
}

async function adminAccounts(request: Request, env: AuthEnv, kv: KVNamespace, me: UserRecord, url: URL) {
  const method = request.method;
  const path = url.pathname.replace(/^\/api\/admin\/accounts\/?/, "");

  if (method === "GET" && !path) {
    const owners = (env.ADMIN_EMAILS ?? "")
      .split(/[,\s]+/)
      .map((e) => normEmail(e))
      .filter(Boolean);
    const rows = env.DB ? (await ensureSchema(env.DB), (await env.DB.prepare("SELECT * FROM account_flags ORDER BY admin DESC, name").all<FlagRow>()).results) : [];
    const emails = [...new Set([...owners, ...rows.map((r) => r.email)])];
    const users = (await Promise.all(emails.map((e) => kv.get<UserRecord>(`user:${e}`, "json")))).filter((u): u is UserRecord => !!u);
    return reply({ ok: true, accounts: users.map((u) => accountOut(env, u)) });
  }

  if (method === "POST" && !path) {
    const data = await body(request);
    const name = str(data.name, 80).trim().replace(/\s+/g, " ");
    const email = normEmail(str(data.email, 254));
    const password = str(data.password, 200);
    if (name.length < 2 || name.length > 40) return fail(400, "invalid", "Use 2 to 40 characters for the name.", "name");
    if (!EMAIL.test(email)) return fail(400, "invalid", "Enter a valid email address.", "email");
    if (password.length < 8 || password.length > 128) return fail(400, "invalid", "Use 8 to 128 characters for the password.", "password");
    if (await kv.get(`user:${email}`)) return fail(409, "exists", "An account with this email already exists. Find it below to change it.", "email");
    const salt = randomHex(16);
    const user: UserRecord = { id: crypto.randomUUID(), name, email, salt, hash: await derive(password, salt, ITERATIONS), iterations: ITERATIONS, createdAt: new Date().toISOString() };
    if (data.admin === true) user.role = "admin";
    if (data.verified === true) user.verified = true;
    await saveUser(kv, user);
    await indexFlags(env, user);
    return reply({ ok: true, account: accountOut(env, user) }, 201);
  }

  const email = normEmail(decodeURIComponent(path));
  if (method === "GET" && path) {
    const u = EMAIL.test(email) ? await kv.get<UserRecord>(`user:${email}`, "json") : null;
    return u ? reply({ ok: true, account: accountOut(env, u) }) : fail(404, "not_found", "No account uses that email.");
  }
  if (method === "PATCH" && path) {
    const u = EMAIL.test(email) ? await kv.get<UserRecord>(`user:${email}`, "json") : null;
    if (!u) return fail(404, "not_found", "No account uses that email.");
    const data = await body(request);
    if (typeof data.admin === "boolean") {
      if (!data.admin && isAdmin(env, u.email)) return fail(409, "owner", "This account is an owner (ADMIN_EMAILS); remove it there instead.");
      if (!data.admin && u.id === me.id) return fail(409, "self", "You can’t remove your own admin access.");
      if (data.admin) u.role = "admin";
      else delete u.role;
    }
    if (typeof data.verified === "boolean") {
      if (data.verified) u.verified = true;
      else delete u.verified;
    }
    await saveUser(kv, u);
    await indexFlags(env, u);
    return reply({ ok: true, account: accountOut(env, u) });
  }
  return fail(404, "not_found", "Not found.");
}

/* ---------- router ---------- */

const forbidden = () => fail(403, "forbidden", "Cross-site requests are not allowed.");

/** Handles the members' API; returns null for other paths. */
export async function handleAuth(request: Request, env: AuthEnv, url: URL): Promise<Response | null> {
  const path = url.pathname;
  const ours = ["/api/auth/", "/api/am/", "/api/room", "/api/shop/", "/api/admin/", "/api/avatar/", "/api/link/", "/api/integrations/jkt48connect/"].some((p) => path.startsWith(p));
  if (!ours) return null;
  const kv = env.AUTH;
  if (!kv) return fail(503, "not_configured", "Accounts are not set up on this server yet.");
  const method = request.method;

  // Public reads.
  const av = /^\/api\/avatar\/([a-f0-9-]{36})$/.exec(path);
  if (av && method === "GET") return getAvatar(kv, av[1]);
  // Server-to-server from JKT48Connect: signed, no cookie, no origin check.
  if (path.startsWith("/api/integrations/jkt48connect/")) return handleIntegration(request, env, url);
  if (method === "GET" && path === "/api/room/media") {
    if (!partnerReady(env)) return fail(503, "not_configured", "The theater room isn’t set up yet.");
    return roomMedia(request, env, kv, url);
  }

  // Signing in and out.
  if (method === "POST" && ["/api/auth/register", "/api/auth/login", "/api/auth/logout"].includes(path)) {
    if (!sameOrigin(request, url)) return forbidden();
    if (path === "/api/auth/register") return register(request, env, kv);
    if (path === "/api/auth/login") return login(request, env, kv);
    return logout(request, kv);
  }

  const user = await currentUser(request, kv);
  if (method === "GET" && path === "/api/auth/me") return reply({ ok: true, user: user ? publicUser(user, env) : null });
  if (!user) return fail(401, "unauthenticated", "Sign in first.");
  if (path.startsWith("/api/am/")) return handleAm(request, env, user, url);

  // JSON posts must be same-origin JSON; uploads and deletes check the origin.
  const origin = request.headers.get("origin");
  const sameSite = !origin || origin === url.origin;
  const jsonOk = method === "GET" || sameOrigin(request, url);
  const viewer = { id: user.id, name: user.name, email: user.email, avatar: avatarUrl(user), admin: adminOf(env, user), verified: !!user.verified };

  if (path === "/api/auth/avatar") {
    if (!sameSite) return forbidden();
    if (method === "PUT") return putAvatar(request, env, kv, user);
    if (method === "DELETE") return deleteAvatar(env, kv, user);
  }
  if (method === "POST" && path === "/api/auth/profile") return jsonOk ? profile(request, env, kv, user) : forbidden();
  if (method === "POST" && path === "/api/auth/password") return jsonOk ? password(request, env, kv, user) : forbidden();

  if (method === "GET" && path === "/api/room") return room(env);
  if (method === "POST" && path === "/api/room/session") return jsonOk ? roomSession(request, env, kv, user) : forbidden();
  const comments = await handleComments(request, env, viewer, url, method === "DELETE" ? sameSite : jsonOk);
  if (comments) return comments;

  if (path.startsWith("/api/link/")) return handleLink(request, env, viewer, url, jsonOk, sameSite);
  if (path.startsWith("/api/shop/")) return handleShop(request, env, viewer, url, jsonOk);
  if (path.startsWith("/api/admin/")) {
    if (!viewer.admin) return fail(403, "forbidden", "Admins only.");
    if (path === "/api/admin/accounts" || path.startsWith("/api/admin/accounts/")) {
      return jsonOk ? adminAccounts(request, env, kv, user, url) : forbidden();
    }
    return handleAdmin(request, env, kv, url, method === "DELETE" ? sameSite : jsonOk);
  }
  return fail(404, "not_found", "Not found.");
}
