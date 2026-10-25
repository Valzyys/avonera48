/**
 * Theater room media through this site (proxy mode).
 *
 * The server opens the one-time playback URL itself, keeps the viewer
 * session's play header and cookies, and serves every playlist, key and
 * segment through GET /api/room/media. Playlists are rewritten so each URI
 * points back here; the browser only ever talks to this origin, and the
 * play header never leaves the server. A refused request (401/403) is
 * resumed server side once, as the partner docs describe.
 *
 * The site Worker fetches the exact URLs returned by the partner directly.
 * Playback, resume, playlists and segments require no external relay.
 *
 * Each media URL carries a short HMAC token (viewer id + expiry), so the
 * hot path (one request per segment) needs no session lookup; the viewer's
 * playback context is read from the edge cache, falling back to KV.
 */

import { rewritePlaylistAsync } from "./hls";
import { mediaUrls } from "./mediaUrls";
import type { PartnerEnv } from "./partner";

export interface MediaCtx {
  /** The partner origin the playlists name (what /api/room/media accepts). */
  origin: string;
  headerName: string;
  headerValue: string;
  cookie: string;
  ua: string;
  siteOrigin?: string;
  resume: string | null;
  exp: number;
  /** When the play header was last rotated (ms); concurrent refusals reuse it instead of resuming again. */
  resumedAt?: number;
  /** When this context was last written to KV (ms). */
  savedAt?: number;
}

const TTL = 6 * 60 * 60;
const enc = new TextEncoder();
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

/** Waits for response headers; the body may stream for longer (a segment downloads after this). */
const HEADERS_TIMEOUT = { playback: 12_000, media: 15_000 } as const;
/** Cookie churn is kept in the edge cache; KV (rate-limited per key) is written at most this often. */
const PERSIST_EVERY = 60_000;
/** A play header rotated this recently is reused rather than resumed again. */
const RESUME_COOLDOWN = 10_000;

// Per-isolate caches: one key import per secret instead of one per segment.
const hmacKeys = new Map<string, Promise<CryptoKey>>();
const codecs = new Map<string, ReturnType<typeof mediaUrls>>();
const codecFor = (secret: string, uid: string) => {
  const k = `${secret}|${uid}`;
  let c = codecs.get(k);
  if (c) codecs.delete(k); // bounded LRU of viewer-scoped codecs
  if (!c) {
    c = mediaUrls(secret, uid);
  }
  codecs.set(k, c);
  if (codecs.size > 64) codecs.delete(codecs.keys().next().value!);
  return c;
};

async function sign(env: PartnerEnv, msg: string) {
  let key = hmacKeys.get(env.PARTNER_SECRET!);
  if (!key) {
    key = crypto.subtle.importKey("raw", enc.encode(`${env.PARTNER_SECRET}|room-media`), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    hmacKeys.set(env.PARTNER_SECRET!, key);
  }
  return hex(await crypto.subtle.sign("HMAC", await key, enc.encode(msg))).slice(0, 32);
}

async function makeToken(env: PartnerEnv, uid: string, exp: number) {
  return `${uid}.${exp}.${await sign(env, `${uid}.${exp}`)}`;
}

async function readToken(env: PartnerEnv, token: string): Promise<string | null> {
  const [uid, exp, mac] = token.split(".");
  if (!uid || !exp || !mac || Number(exp) < Date.now() / 1000) return null;
  const want = await sign(env, `${uid}.${exp}`);
  if (want.length !== mac.length) return null;
  let diff = 0;
  for (let k = 0; k < want.length; k++) diff |= want.charCodeAt(k) ^ mac.charCodeAt(k);
  return diff === 0 ? uid : null;
}

const cacheKey = (uid: string) => new Request(`https://room.internal/media-ctx/${encodeURIComponent(uid)}`);

const cacheCtx = (uid: string, ctx: MediaCtx) => caches.default.put(cacheKey(uid), new Response(JSON.stringify(ctx), { headers: { "cache-control": "public, max-age=300" } }));

/**
 * Stores the context. The edge cache always gets the latest; KV (shared by
 * every location, but limited to about one write per second per key and
 * billed per write) only when asked to or once a minute. Failures to store
 * never fail the media request that triggered them.
 */
async function saveCtx(kv: KVNamespace, uid: string, ctx: MediaCtx, persist = true) {
  try {
    if (persist || !ctx.savedAt || Date.now() - ctx.savedAt > PERSIST_EVERY) {
      ctx.savedAt = Date.now();
      await kv.put(`media:${uid}`, JSON.stringify(ctx), { expirationTtl: TTL });
    }
  } catch (e) {
    console.warn("[room] context not persisted", e instanceof Error ? e.message : e);
  }
  try {
    await cacheCtx(uid, ctx);
  } catch {
    /* cache unavailable: KV still has it */
  }
}

async function loadCtx(kv: KVNamespace, uid: string): Promise<MediaCtx | null> {
  const hit = await caches.default.match(cacheKey(uid));
  if (hit) return (await hit.json()) as MediaCtx;
  const ctx = await kv.get<MediaCtx>(`media:${uid}`, "json");
  if (ctx) await cacheCtx(uid, ctx).catch(() => undefined);
  return ctx;
}

/** "a=1; Path=/; HttpOnly" headers → "a=1; b=2", merged over an existing jar. */
function mergeCookies(jar: string, res: Response) {
  const all = new Map(
    jar
      .split(";")
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => [p.split("=")[0], p] as const),
  );
  const set = (res.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() ?? (res.headers.get("set-cookie") ? [res.headers.get("set-cookie")!] : []);
  for (const line of set) {
    const pair = line.split(";")[0].trim();
    if (pair.includes("=")) all.set(pair.split("=")[0], pair);
  }
  return [...all.values()].join("; ");
}

/** fetch() that gives up when no response headers arrive in time (the body may keep streaming). */
async function fetchWithin(url: string, init: RequestInit, ms: number) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Follow partner redirects inside the Worker, retaining session cookies. */
async function partnerFetch(target: string, headers: HeadersInit, cookie = "", timeout: number = HEADERS_TIMEOUT.media) {
  let current = new URL(target);
  const origin = current.origin;
  let jar = cookie;
  for (let redirects = 0; redirects <= 5; redirects++) {
    const nextHeaders = new Headers(headers);
    if (jar) nextHeaders.set("cookie", jar);
    const response = await fetchWithin(current.href, { headers: nextHeaders, redirect: "manual" }, timeout);
    jar = mergeCookies(jar, response);
    if (![301, 302, 303, 307, 308].includes(response.status)) return { response, cookie: jar, url: current.href };
    const location = response.headers.get("location");
    await response.body?.cancel();
    if (!location) throw new Error("Playback redirect has no location");
    const next = new URL(location, current);
    if (next.origin !== origin) throw new Error("Cross-origin playback redirect refused");
    current = next;
  }
  throw new Error("Too many playback redirects");
}

export interface PlaybackDiagnostic {
  stage: "playback";
  upstream_status: number;
  response_kind: "json" | "html" | "other";
  partner_code: string | null;
}

export class PlaybackError extends Error {
  constructor(public code: string, message: string, public diagnostic?: PlaybackDiagnostic) {
    super(message);
  }
}

interface PlaybackJson {
  ok?: boolean;
  playlist_url?: string;
  auto_playlist_url?: string;
  play_header_name?: string;
  play_header_value?: string;
  qualities?: { label: string; playlist_url: string }[];
  message?: string;
  code?: string;
}

/** Preserve the actual site's identity for the partner's domain checks. */
function viewerHeaders(ua: string, siteOrigin?: string) {
  return { "user-agent": ua, ...(siteOrigin ? { origin: siteOrigin, referer: `${siteOrigin}/` } : {}) };
}

// Only documented codes can leave the server; upstream messages may contain URLs.
const PARTNER_CODES = new Set([
  "BAD_REQUEST", "SHOW_NOT_PURCHASED", "STALE_REQUEST", "REPLAY_DETECTED",
  "KEY_NOT_FOUND", "VIEW_QUOTA_EXCEEDED", "SIGNATURE_REJECTED", "ORIGIN_NOT_ALLOWED",
  "SESSION_BINDING_MISMATCH", "PLAY_HEADER_REQUIRED", "PLAY_HEADER_INVALID",
  "VARIANT_NOT_ALLOWED", "KEY_LOCKED", "PARTNER_SUSPENDED",
]);

function playbackDiagnostic(res: Response, payload: unknown): PlaybackDiagnostic {
  const raw = payload && typeof payload === "object" && "code" in payload ? payload.code : null;
  const partnerCode = typeof raw === "string" && PARTNER_CODES.has(raw) ? raw : null;
  const type = res.headers.get("content-type") ?? "";
  return {
    stage: "playback", upstream_status: res.status,
    response_kind: /json/i.test(type) ? "json" : /html/i.test(type) ? "html" : "other",
    partner_code: partnerCode,
  };
}

/**
 * Opens a playback URL server side and returns same-origin URLs for the
 * player, or a safe error when the partner refuses.
 */
export async function openProxied(env: PartnerEnv, kv: KVNamespace, uid: string, playbackUrl: string, resumeUrl: string | null, ua: string, siteOrigin?: string) {
  let opened: Awaited<ReturnType<typeof partnerFetch>>;
  try {
    opened = await partnerFetch(playbackUrl, { accept: "application/json", ...viewerHeaders(ua, siteOrigin) }, "", HEADERS_TIMEOUT.playback);
  } catch {
    throw new PlaybackError("playback_unreachable", "The video service could not be reached. Try again in a moment.");
  }
  const { response: res, cookie } = opened;
  const payload: unknown = await res.json().catch(() => null);
  const diagnostic = playbackDiagnostic(res, payload);
  if (!res.ok) {
    console.warn("[room] playback refused", diagnostic);
    if (diagnostic.partner_code === "ORIGIN_NOT_ALLOWED") throw new PlaybackError("playback_origin_not_allowed", "The video service has not enabled playback for this site.", diagnostic);
    if (diagnostic.partner_code === "SESSION_BINDING_MISMATCH") throw new PlaybackError("playback_binding_mismatch", "The video service rejected this playback session.", diagnostic);
    if (res.status === 404) throw new PlaybackError("playback_not_found", "The video service is temporarily unavailable. Please try again later.", diagnostic);
    throw new PlaybackError("playback_refused", "The video service refused playback. Please try again later.", diagnostic);
  }
  const j = payload as PlaybackJson | null;
  if (!j) throw new PlaybackError("playback_invalid_response", "The video service returned an invalid response. Please try again later.", diagnostic);
  const main = j.auto_playlist_url || j.playlist_url;
  if (!j.ok || !main || !j.play_header_name || !j.play_header_value) {
    throw new PlaybackError("playback_invalid_response", "The video service could not open playback. Please try again later.", diagnostic);
  }
  const playlist = new URL(main, opened.url);
  const origin = playlist.origin;
  const exp = Math.floor(Date.now() / 1000) + TTL;
  await saveCtx(kv, uid, { origin, headerName: j.play_header_name, headerValue: j.play_header_value, cookie, ua, siteOrigin, resume: resumeUrl, exp });
  const token = await makeToken(env, uid, exp);
  const codec = await codecFor(env.PARTNER_SECRET!, uid);
  const wrap = async (u: string) => `/api/room/media?t=${token}&r=${await codec.seal(u)}`;
  return {
    playlist_url: await wrap(playlist.href),
    qualities: await Promise.all((j.qualities ?? []).map(async (q) => ({ label: q.label, playlist_url: await wrap(new URL(q.playlist_url, opened.url).href) }))),
  };
}

async function upstream(ctx: MediaCtx, url: string, request: Request) {
  const headers: Record<string, string> = { [ctx.headerName]: ctx.headerValue, ...viewerHeaders(ctx.ua, ctx.siteOrigin) };
  if (ctx.cookie) headers.cookie = ctx.cookie;
  const range = request.headers.get("range");
  if (range) headers.range = range;
  return partnerFetch(url, headers, ctx.cookie);
}

// One resume per viewer at a time in this isolate: a refused header usually
// hits the playlist and a segment together, and a second resume would
// invalidate the header the first one just got.
const resuming = new Map<string, Promise<MediaCtx | null>>();

/** Rotates the play header after a refusal, or picks up a rotation another request already did. */
function rotate(kv: KVNamespace, uid: string, stale: MediaCtx): Promise<MediaCtx | null> {
  const running = resuming.get(uid);
  if (running) return running;
  const job = (async () => {
    const fresh = (await loadCtx(kv, uid).catch(() => null)) ?? stale;
    if (fresh.headerValue !== stale.headerValue) return fresh; // already rotated elsewhere
    if (fresh.resumedAt && Date.now() - fresh.resumedAt < RESUME_COOLDOWN) return null; // just rotated, still refused
    if (!fresh.resume) return null;
    const resumed = await partnerFetch(fresh.resume, { accept: "application/json", ...viewerHeaders(fresh.ua, fresh.siteOrigin) }, fresh.cookie, HEADERS_TIMEOUT.playback);
    const j = (await resumed.response.json().catch(() => ({}))) as PlaybackJson;
    if (!resumed.response.ok || !j.ok || !j.play_header_value) {
      console.warn("[room] resume refused", resumed.response.status);
      return null;
    }
    const next: MediaCtx = { ...fresh, headerValue: j.play_header_value, headerName: j.play_header_name ?? fresh.headerName, cookie: resumed.cookie, resumedAt: Date.now() };
    await saveCtx(kv, uid, next);
    return next;
  })()
    .catch(() => null)
    .finally(() => resuming.delete(uid));
  resuming.set(uid, job);
  return job;
}

/** GET /api/room/media?t=<token>&r=<encrypted media reference> */
export async function roomMedia(request: Request, env: PartnerEnv, kv: KVNamespace, url: URL): Promise<Response> {
  const uid = await readToken(env, url.searchParams.get("t") ?? "");
  if (!uid) return new Response("Forbidden", { status: 403 });
  let ctx = await loadCtx(kv, uid);
  const codec = await codecFor(env.PARTNER_SECRET!, uid);
  let target: string;
  try {
    target = await codec.open(url.searchParams.get("r") ?? "");
  } catch {
    return new Response("Forbidden", { status: 403 });
  }
  if (!ctx || !target.startsWith(`${ctx.origin}/`)) return new Response("Forbidden", { status: 403 });

  let res: Response;
  let mediaUrl = target;
  try {
    let fetched = await upstream(ctx, target, request);
    if (fetched.response.status === 401 || fetched.response.status === 403) {
      await fetched.response.body?.cancel();
      const next = await rotate(kv, uid, ctx);
      if (next) {
        ctx = next;
        fetched = await upstream(ctx, target, request);
      } else {
        // Nothing to retry with: report the refusal so the player opens a new session.
        console.warn("[room] media refused", fetched.response.status);
        return new Response(null, { status: fetched.response.status });
      }
    }
    res = fetched.response;
    mediaUrl = fetched.url;
    if (fetched.cookie !== ctx.cookie) {
      // Cookies that change on every response (load-balancer stickiness) must not cost a KV write per segment.
      ctx.cookie = fetched.cookie;
      await saveCtx(kv, uid, ctx, false);
    }
  } catch (e) {
    const timedOut = e instanceof Error && e.name === "AbortError";
    return new Response(timedOut ? "Upstream timeout" : "Upstream unreachable", { status: timedOut ? 504 : 502 });
  }
  if (!res.ok && res.status !== 206) {
    if (res.status === 401 || res.status === 403) console.warn("[room] media refused", res.status);
    await res.body?.cancel();
    return new Response(null, { status: res.status === 404 ? 404 : res.status >= 500 ? 502 : res.status });
  }

  const type = res.headers.get("content-type") ?? "";
  const size = Number(res.headers.get("content-length") ?? 0);
  // Media URLs are opaque (/api/partner/s/<id>), so a response that may be a
  // playlist is sniffed. Big or plainly binary responses stream straight
  // through: buffering a whole segment delays its first byte.
  const mayBePlaylist = !/^(video|audio)\//i.test(type) && !(size > 2_000_000);
  if (mayBePlaylist && res.body) {
    const reader = res.body.getReader();
    const first = await reader.read();
    const head = first.value ? new TextDecoder().decode(first.value.slice(0, 16)).replace(/^\uFEFF/, "").trimStart() : "";
    if (head.startsWith("#EXTM3U")) {
      const parts: Uint8Array[] = first.value ? [first.value] : [];
      for (let r = await reader.read(); !r.done; r = await reader.read()) parts.push(r.value);
      const text = new TextDecoder().decode(concat(parts));
      const token = url.searchParams.get("t")!;
      const body = await rewritePlaylistAsync(text, mediaUrl, async (abs) => `/api/room/media?t=${token}&r=${await codec.seal(abs)}`);
      return new Response(body, { headers: { "content-type": "application/vnd.apple.mpegurl", "cache-control": "no-store" } });
    }
    // Not a playlist: send what was read, then the rest as it arrives.
    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
    void (async () => {
      const w = writable.getWriter();
      try {
        if (first.value) await w.write(first.value);
        for (let r = first.done ? { done: true as const, value: undefined } : await reader.read(); !r.done; r = await reader.read()) await w.write(r.value);
        await w.close();
      } catch (err) {
        await w.abort(err).catch(() => undefined);
      }
    })();
    return new Response(readable, { status: res.status, headers: mediaHeaders(res, type) });
  }
  return new Response(res.body, { status: res.status, headers: mediaHeaders(res, type) });
}

function mediaHeaders(res: Response, type: string) {
  const headers = new Headers({ "content-type": type || "application/octet-stream", "cache-control": "private, max-age=30" });
  for (const h of ["content-length", "content-range", "accept-ranges"]) {
    const v = res.headers.get(h);
    if (v) headers.set(h, v);
  }
  return headers;
}

function concat(parts: Uint8Array[]) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}
