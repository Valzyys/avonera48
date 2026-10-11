/**
 * Accounts and the members' theater room.
 *
 *   POST /api/auth/register  { name, email, password }
 *   POST /api/auth/login     { email, password }
 *   POST /api/auth/logout
 *   GET  /api/auth/me
 *   GET  /api/room           (signed in) shows the room can open now
 *   POST /api/room/session   (signed in) { show_slug } → one-time playback URL
 *
 * Storage is one KV namespace bound as AUTH:
 *   user:<email>        account record (PBKDF2-SHA256 password hash)
 *   sess:<sha256(token)> session, expires with the cookie (30 days)
 *   rl:<kind>:<key>     attempt counter for rate limiting (10 minutes)
 *
 * Video comes from the partner API (worker/partner.ts); its credentials
 * stay on the server.
 *
 * The session token lives only in an HttpOnly, Secure, SameSite=Lax cookie.
 * State-changing requests must be same-origin JSON.
 */

import { openProxied, roomMedia } from "./roomMedia";
import { partnerCall, partnerReady, type PartnerEnv, type PartnerSession, type PartnerShow } from "./partner";

export interface AuthEnv extends PartnerEnv {
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
}

interface Session {
  email: string;
  createdAt: string;
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

const COOKIE = "avn_session";
const SESSION_TTL = 60 * 60 * 24 * 30;
const ITERATIONS = 100_000; // the Workers runtime's PBKDF2 maximum
const RATE_WINDOW = 600;
const RATE_MAX: Record<string, number> = { login: 10, register: 5, session: 12 };

const HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" };
const reply = (body: unknown, status = 200, extra: HeadersInit = {}) => new Response(JSON.stringify(body), { status, headers: { ...HEADERS, ...extra } });
const fail = (status: number, error: string, message: string, field?: string) => reply({ ok: false, error, message, ...(field ? { field } : {}) }, status);

const enc = new TextEncoder();
const hex = (buf: ArrayBuffer | Uint8Array) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const randomHex = (bytes: number) => hex(crypto.getRandomValues(new Uint8Array(bytes)));
const sha256 = async (s: string) => hex(await crypto.subtle.digest("SHA-256", enc.encode(s)));

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

const publicUser = (u: UserRecord): PublicUser => ({ id: u.id, name: u.name, email: u.email, createdAt: u.createdAt });

function readCookie(request: Request, name: string) {
  const raw = request.headers.get("cookie") ?? "";
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}

const sessionCookie = (token: string, maxAge: number) => `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;

/** Same-origin JSON only, so another site cannot post a form at these endpoints. */
function sameOrigin(request: Request, url: URL) {
  const origin = request.headers.get("origin");
  if (origin && origin !== url.origin) return false;
  return (request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json");
}

async function body(request: Request): Promise<Record<string, unknown>> {
  try {
    const data = await request.json();
    return data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
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

async function register(request: Request, kv: KVNamespace) {
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
  return reply({ ok: true, user: publicUser(user) }, 201, { "set-cookie": sessionCookie(token, SESSION_TTL) });
}

async function login(request: Request, kv: KVNamespace) {
  if (await limited(kv, "login", request)) return fail(429, "rate_limited", "Too many attempts. Try again in a few minutes.");
  const data = await body(request);
  const email = normEmail(str(data.email, 254));
  const password = str(data.password, 200);
  const user = EMAIL.test(email) ? await kv.get<UserRecord>(`user:${email}`, "json") : null;
  // Derive even when the account is missing, so timing doesn't reveal which emails exist.
  const hash = await derive(password, user?.salt ?? "00".repeat(16), user?.iterations ?? ITERATIONS);
  if (!user || !same(hash, user.hash)) return fail(401, "invalid_credentials", "That email and password don’t match an account.");
  const token = await startSession(kv, email);
  return reply({ ok: true, user: publicUser(user) }, 200, { "set-cookie": sessionCookie(token, SESSION_TTL) });
}

async function logout(request: Request, kv: KVNamespace) {
  const token = readCookie(request, COOKIE);
  if (token && /^[a-f0-9]{64}$/.test(token)) await kv.delete(`sess:${await sha256(token)}`);
  return reply({ ok: true }, 200, { "set-cookie": sessionCookie("", 0) });
}

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

async function room(request: Request, env: AuthEnv, kv: KVNamespace) {
  const user = await currentUser(request, kv);
  if (!user) return fail(401, "unauthenticated", "Sign in to enter the theater room.");
  if (!partnerReady(env)) return reply({ ok: true, configured: false, shows: [] });
  const shows = await roomShows(env);
  if (!shows) return reply({ ok: true, configured: true, available: false, shows: [] });
  return reply({ ok: true, configured: true, available: true, shows: shows.map((s) => ({ slug: s.show_slug, title: s.title, open: s.entitled })) });
}

async function roomSession(request: Request, env: AuthEnv, kv: KVNamespace) {
  const user = await currentUser(request, kv);
  if (!user) return fail(401, "unauthenticated", "Sign in to enter the theater room.");
  if (!partnerReady(env)) return fail(503, "not_configured", "The theater room isn’t set up yet.");
  const data = await body(request);
  const slug = str(data.show_slug, 80);
  const proxy = data.proxy === true;
  if (!/^[a-z0-9][a-z0-9_-]{0,79}$/.test(slug)) return fail(400, "invalid", "Choose a show.");
  if (await limited(kv, "session", request, user.id)) return fail(429, "rate_limited", "Too many tries. Wait a few minutes and enter again.");
  const r = await partnerCall<PartnerSession>(env, "POST", "/api/public/partner/v1/session", { show_slug: slug, viewer_id: user.id, ttl: 120 });
  if (!r.ok || !r.data.playback_url) {
    const [status, message] = PARTNER_ERRORS[r.data.code ?? ""] ?? [502, "The room couldn’t open. Try again in a moment."];
    return fail(status, (r.data.code ?? "upstream_error").toLowerCase(), message);
  }
  const resume = typeof r.data.resume_url === "string" && /^https?:\/\//.test(r.data.resume_url) ? r.data.resume_url : null;
  if (proxy) {
    // Proxy mode: open the playback URL here and hand the player same-origin URLs.
    const opened = await openProxied(env, kv, user.id, r.data.playback_url, resume, request.headers.get("user-agent") ?? "Mozilla/5.0");
    if (!opened) return fail(502, "playback_refused", "The room couldn’t open. Try again in a moment.");
    return reply({ ok: true, proxied: true, ...opened, max_resolution: r.data.max_resolution ?? null });
  }
  return reply({ ok: true, playback_url: r.data.playback_url, resume_url: resume, expires_in: r.data.expires_in, max_resolution: r.data.max_resolution ?? null });
}

/** Handles /api/auth/* and /api/room; returns null for other paths. */
export async function handleAuth(request: Request, env: AuthEnv, url: URL): Promise<Response | null> {
  const path = url.pathname;
  if (!path.startsWith("/api/auth/") && !path.startsWith("/api/room")) return null;
  const kv = env.AUTH;
  if (!kv) return fail(503, "not_configured", "Accounts are not set up on this server yet.");

  if (request.method === "GET" && path === "/api/auth/me") {
    const user = await currentUser(request, kv);
    return reply({ ok: true, user: user ? publicUser(user) : null });
  }
  if (request.method === "GET" && path === "/api/room") return room(request, env, kv);
  if ((request.method === "GET" || request.method === "HEAD") && path === "/api/room/media") {
    if (!partnerReady(env)) return fail(503, "not_configured", "The theater room isn’t set up yet.");
    return roomMedia(request, env, kv, url);
  }

  const actions: Record<string, (r: Request, kv: KVNamespace) => Promise<Response>> = {
    "/api/auth/register": register,
    "/api/auth/login": login,
    "/api/auth/logout": logout,
    "/api/room/session": (r, k) => roomSession(r, env, k),
  };
  const action = actions[path];
  if (!action) return fail(404, "not_found", "Not found.");
  if (request.method !== "POST") return reply({ ok: false, error: "method_not_allowed" }, 405, { allow: "POST" });
  if (!sameOrigin(request, url)) return fail(403, "forbidden", "Cross-site requests are not allowed.");
  return action(request, kv);
}
