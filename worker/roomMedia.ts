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
 * The partner binds a viewer session to the network that opened it, so when
 * PARTNER_MEDIA_BASE (or PARTNER_API_BASE) points at a fixed-IP relay, every
 * upstream request — playback, resume, playlists, segments — goes through it.
 * The browser never sees the partner's address either way.
 *
 * Each media URL carries a short HMAC token (viewer id + expiry), so the
 * hot path (one request per segment) needs no session lookup; the viewer's
 * playback context is read from the edge cache, falling back to KV.
 */

import { rewritePlaylist } from "./hls";
import type { PartnerEnv } from "./partner";

export interface MediaCtx {
  /** The partner origin the playlists name (what /api/room/media accepts). */
  origin: string;
  /** Where requests actually go: a relay base, or null to call the origin directly. */
  via?: string | null;
  headerName: string;
  headerValue: string;
  cookie: string;
  ua: string;
  resume: string | null;
  exp: number;
}

const TTL = 6 * 60 * 60;
const enc = new TextEncoder();
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

async function sign(env: PartnerEnv, msg: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode(`${env.PARTNER_SECRET}|room-media`), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, enc.encode(msg))).slice(0, 32);
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

async function saveCtx(kv: KVNamespace, uid: string, ctx: MediaCtx) {
  const body = JSON.stringify(ctx);
  await kv.put(`media:${uid}`, body, { expirationTtl: TTL });
  await caches.default.put(cacheKey(uid), new Response(body, { headers: { "cache-control": "public, max-age=300" } }));
}

async function loadCtx(kv: KVNamespace, uid: string): Promise<MediaCtx | null> {
  const hit = await caches.default.match(cacheKey(uid));
  if (hit) return (await hit.json()) as MediaCtx;
  const ctx = await kv.get<MediaCtx>(`media:${uid}`, "json");
  if (ctx) await caches.default.put(cacheKey(uid), new Response(JSON.stringify(ctx), { headers: { "cache-control": "public, max-age=300" } }));
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

const relayOf = (env: PartnerEnv) => (env.PARTNER_MEDIA_BASE || env.PARTNER_API_BASE || "").replace(/\/+$/, "") || null;

/** An upstream URL as fetched: through the relay when there is one. */
function routed(via: string | null | undefined, u: string) {
  if (!via) return u;
  const url = new URL(u);
  return `${via}${url.pathname}${url.search}`;
}

/** Follow partner redirects through the same relay, retaining session cookies. */
async function relayFetch(via: string | null | undefined, target: string, headers: HeadersInit, cookie = "") {
  let current = new URL(target);
  const origin = current.origin;
  let jar = cookie;
  for (let redirects = 0; redirects <= 5; redirects++) {
    const nextHeaders = new Headers(headers);
    if (jar) nextHeaders.set("cookie", jar);
    const response = await fetch(routed(via, current.href), { headers: nextHeaders, redirect: "manual" });
    jar = mergeCookies(jar, response);
    if (![301, 302, 303, 307, 308].includes(response.status)) return { response, cookie: jar, url: current.href };
    const location = response.headers.get("location");
    await response.body?.cancel();
    if (!location) throw new Error("Playback redirect has no location");
    const next = new URL(location, current);
    // Relays may rewrite Location to their own address. Keep a canonical
    // partner URL so routing and relative playlist URLs remain consistent.
    if (via && next.origin === new URL(via).origin) {
      const basePath = new URL(via).pathname.replace(/\/+$/, "");
      if (basePath && !(next.pathname === basePath || next.pathname.startsWith(`${basePath}/`))) throw new Error("Invalid relay redirect");
      next.pathname = next.pathname.slice(basePath.length) || "/";
      next.protocol = current.protocol;
      next.host = current.host;
    }
    if (next.origin !== origin) throw new Error("Cross-origin playback redirect refused");
    current = next;
  }
  throw new Error("Too many playback redirects");
}

export class PlaybackError extends Error {
  constructor(public code: string, message: string) {
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

/**
 * Opens a playback URL server side and returns same-origin URLs for the
 * player, or a safe error when the partner refuses.
 */
export async function openProxied(env: PartnerEnv, kv: KVNamespace, uid: string, playbackUrl: string, resumeUrl: string | null, ua: string) {
  const via = relayOf(env);
  let opened: Awaited<ReturnType<typeof relayFetch>>;
  try {
    opened = await relayFetch(via, playbackUrl, { accept: "application/json", "user-agent": ua });
  } catch {
    throw new PlaybackError("playback_unreachable", "The video service could not be reached. Try again in a moment.");
  }
  const { response: res, cookie } = opened;
  if (!res.ok) {
    // Never log the body or full URL: either can contain playback credentials.
    console.warn("[room] playback refused", res.status);
    if (res.status === 404) throw new PlaybackError("playback_route_missing", "The video service is temporarily unavailable. Please try again later.");
    throw new PlaybackError("playback_refused", "The video service refused playback. Please try again later.");
  }
  const j = (await res.json().catch(() => null)) as PlaybackJson | null;
  if (!j) throw new PlaybackError("playback_invalid_response", "The video service returned an invalid response. Please try again later.");
  const main = j.auto_playlist_url || j.playlist_url;
  if (!j.ok || !main || !j.play_header_name || !j.play_header_value) {
    throw new PlaybackError("playback_invalid_response", "The video service could not open playback. Please try again later.");
  }
  const playlist = new URL(main, opened.url);
  const origin = playlist.origin;
  const exp = Math.floor(Date.now() / 1000) + TTL;
  await saveCtx(kv, uid, { origin, via, headerName: j.play_header_name, headerValue: j.play_header_value, cookie, ua, resume: resumeUrl, exp });
  const token = await makeToken(env, uid, exp);
  const wrap = (u: string) => `/api/room/media?t=${token}&u=${encodeURIComponent(u)}`;
  return { playlist_url: wrap(playlist.href), qualities: (j.qualities ?? []).map((q) => ({ label: q.label, playlist_url: wrap(new URL(q.playlist_url, opened.url).href) })) };
}

async function upstream(ctx: MediaCtx, url: string, request: Request) {
  const headers: Record<string, string> = { [ctx.headerName]: ctx.headerValue, "user-agent": ctx.ua };
  if (ctx.cookie) headers.cookie = ctx.cookie;
  const range = request.headers.get("range");
  if (range) headers.range = range;
  return relayFetch(ctx.via, url, headers, ctx.cookie);
}

/** GET /api/room/media?t=<token>&u=<upstream url> */
export async function roomMedia(request: Request, env: PartnerEnv, kv: KVNamespace, url: URL): Promise<Response> {
  const uid = await readToken(env, url.searchParams.get("t") ?? "");
  if (!uid) return new Response("Forbidden", { status: 403 });
  const ctx = await loadCtx(kv, uid);
  const target = url.searchParams.get("u") ?? "";
  if (!ctx || !target.startsWith(`${ctx.origin}/`)) return new Response("Forbidden", { status: 403 });

  let res: Response;
  let mediaUrl = target;
  try {
    let fetched = await upstream(ctx, target, request);
    res = fetched.response;
    mediaUrl = fetched.url;
    if (fetched.cookie !== ctx.cookie) {
      ctx.cookie = fetched.cookie;
      await saveCtx(kv, uid, ctx);
    }
    if ((res.status === 401 || res.status === 403) && ctx.resume) {
      // Session refused: resume once (new play header), then retry.
      await res.body?.cancel();
      const resumed = await relayFetch(ctx.via, ctx.resume, { accept: "application/json", "user-agent": ctx.ua }, ctx.cookie);
      const r = resumed.response;
      const j = (await r.json().catch(() => ({}))) as PlaybackJson;
      if (r.ok && j.ok && j.play_header_value) {
        ctx.headerValue = j.play_header_value;
        ctx.headerName = j.play_header_name ?? ctx.headerName;
        ctx.cookie = resumed.cookie;
        await saveCtx(kv, uid, ctx);
        fetched = await upstream(ctx, target, request);
        res = fetched.response;
        mediaUrl = fetched.url;
        if (fetched.cookie !== ctx.cookie) {
          ctx.cookie = fetched.cookie;
          await saveCtx(kv, uid, ctx);
        }
      }
    }
  } catch {
    return new Response("Upstream unreachable", { status: 502 });
  }
  if (!res.ok && res.status !== 206) {
    if (res.status === 401 || res.status === 403) console.warn("[room] media refused", res.status);
    return new Response(null, { status: res.status === 404 ? 404 : res.status >= 500 ? 502 : res.status });
  }

  const type = res.headers.get("content-type") ?? "";
  // Media URLs are opaque (/api/partner/s/<id>), so sniff anything that isn't
  // plainly audio/video for a playlist rather than trusting the extension.
  if (!/^(video|audio)\//i.test(type)) {
    const bytes = await res.arrayBuffer();
    const head = new TextDecoder().decode(bytes.slice(0, 16)).replace(/^\uFEFF/, "").trimStart();
    if (head.startsWith("#EXTM3U")) {
      const token = url.searchParams.get("t")!;
      const body = rewritePlaylist(new TextDecoder().decode(bytes), mediaUrl, (abs) => `/api/room/media?t=${token}&u=${encodeURIComponent(abs)}`);
      return new Response(body, { headers: { "content-type": "application/vnd.apple.mpegurl", "cache-control": "no-store" } });
    }
    return new Response(bytes, { status: res.status, headers: { "content-type": type || "application/octet-stream", "cache-control": "private, max-age=30" } });
  }
  const headers = new Headers({ "content-type": type || "application/octet-stream", "cache-control": "private, max-age=30" });
  for (const h of ["content-length", "content-range", "accept-ranges"]) {
    const v = res.headers.get(h);
    if (v) headers.set(h, v);
  }
  return new Response(res.body, { status: res.status, headers });
}
