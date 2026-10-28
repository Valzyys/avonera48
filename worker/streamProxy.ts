/** Session-bound, same-origin HLS. Upstream addresses and credentials stay on the server. */
import { mediaUrls } from "./mediaUrls";
import { rewritePlaylistAsync } from "./hls";
import { sha256 } from "./http";
import { accessTo, isAdmin, type ShopEnv } from "./shop";

export interface StreamProxyEnv extends ShopEnv {
  STREAM_PROXY_BASE?: string;
  STREAM_MEDIA_SECRET?: string;
  STREAM_PROXY_KEY?: string;
  PARTNER_SECRET?: string;
}
type Context = Pick<ExecutionContext, "waitUntil">;
interface Reference { url: string; uid: string; show: string; exp: number; root?: boolean }
const ROOT_TTL = 6 * 3600;
const CHILD_TTL = 15 * 60;
const codecs = new Map<string, ReturnType<typeof mediaUrls>>();
const validated = new Map<string, number>();
const pending = new Map<string, Promise<Response>>();
const secretOf = (env: StreamProxyEnv) => env.STREAM_MEDIA_SECRET || env.PARTNER_SECRET || "";
export const streamProxyReady = (env: StreamProxyEnv) => !!(env.STREAM_PROXY_BASE && secretOf(env));
const clock = () => Math.floor(Date.now() / 1000);

function cookie(request: Request) {
  return /(?:^|;\s*)avn_session=([a-f0-9]{64})(?:;|$)/.exec(request.headers.get("cookie") || "")?.[1] || "";
}
async function identity(request: Request) {
  const token = cookie(request);
  if (!token) return null;
  return { sid: await sha256(token), binding: await sha256(`${token}|${request.headers.get("user-agent") || ""}|stream-v1`) };
}
function codecFor(env: StreamProxyEnv, binding: string) {
  const key = `${secretOf(env)}|${binding}`;
  let codec = codecs.get(key);
  if (codec) codecs.delete(key);
  else codec = mediaUrls(`${secretOf(env)}|stream-v1`, binding);
  codecs.set(key, codec);
  if (codecs.size > 128) codecs.delete(codecs.keys().next().value!);
  return codec;
}
function allowed(env: StreamProxyEnv, value: string) {
  const base = new URL(env.STREAM_PROXY_BASE!);
  const url = new URL(value, base);
  if (url.protocol !== "https:" || url.origin !== base.origin || url.username || url.password ||
      !(["/stream", "/stream.m3u8"].includes(url.pathname) || url.pathname.startsWith("/s/"))) throw new Error("Invalid media resource");
  return url.href;
}
function headers(type = "text/plain") {
  return { "content-type": type, "cache-control": "private, no-store", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer", "cross-origin-resource-policy": "same-origin" };
}
const deny = () => new Response("Forbidden", { status: 403, headers: headers() });

/** No partner request, one-time playback exchange, or context write is needed. */
export async function openStreamProxy(request: Request, env: StreamProxyEnv, uid: string, show: string) {
  const viewer = await identity(request);
  if (!viewer) throw new Error("Missing viewer session");
  const codec = await codecFor(env, viewer.binding);
  const reference: Reference = { url: allowed(env, "/stream.m3u8"), uid, show, exp: clock() + ROOT_TTL, root: true };
  return { playlist_url: `/api/room/media?r=${await codec.seal(JSON.stringify(reference))}`, qualities: [], expires_in: ROOT_TTL };
}

async function authorizePlaylist(env: StreamProxyEnv, kv: KVNamespace, sid: string, ref: Reference) {
  const key = `${sid}|${ref.uid}|${ref.show}`;
  if ((validated.get(key) || 0) > Date.now()) return true;
  const session = await kv.get<{ email: string }>(`sess:${sid}`, "json");
  if (!session?.email) return false;
  const user = await kv.get<{ id: string; email: string; role?: string }>(`user:${session.email}`, "json");
  if (!user || user.id !== ref.uid) return false;
  if (env.DB && user.role !== "admin" && !isAdmin(env, user.email) && !(await accessTo(env.DB, user.id, ref.show))) return false;
  validated.set(key, Date.now() + 15_000);
  if (validated.size > 256) validated.delete(validated.keys().next().value!);
  return true;
}

/** Headers only have a deadline; video bodies are streamed as bytes arrive. */
async function originFetch(env: StreamProxyEnv, target: string, range?: string | null) {
  let current = allowed(env, target);
  for (let i = 0; i < 4; i++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12_000);
    let response: Response;
    try {
      response = await fetch(current, { redirect: "manual", signal: ctrl.signal, headers: {
        accept: "*/*", ...(range ? { range } : {}), ...(env.STREAM_PROXY_KEY ? { "x-api-key": env.STREAM_PROXY_KEY } : {}),
      } });
    } finally { clearTimeout(timer); }
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get("location");
    await response.body?.cancel();
    if (!location) throw new Error("Invalid redirect");
    current = allowed(env, new URL(location, current).href);
  }
  throw new Error("Redirect limit");
}

async function readPlaylist(response: Response) {
  if (!response.body) return "";
  const reader = response.body.getReader(), parts: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const r = await reader.read(); if (r.done) break;
      size += r.value.byteLength;
      if (size > 1024 * 1024) throw new Error("Playlist too large");
      parts.push(r.value);
    }
  } catch (e) { await reader.cancel().catch(() => undefined); throw e; }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.length; }
  return new TextDecoder().decode(bytes);
}

/** A shared server-only playlist cache avoids resolving the upstream for each viewer. */
async function playlistFetch(env: StreamProxyEnv, target: string, ctx?: Context) {
  const key = new Request(`https://stream-cache.internal/v1/${await sha256(target)}`);
  const hit = await caches.default.match(key);
  const refresh = () => {
    let job = pending.get(target);
    if (!job) {
      job = (async () => {
        const res = await originFetch(env, target);
        if (!res.ok) return res;
        const text = await readPlaylist(res);
        if (!text.trimStart().startsWith("#EXTM3U")) return new Response(null, { status: 502 });
        const cached = new Response(text, { headers: { "content-type": "application/vnd.apple.mpegurl", "cache-control": "public, max-age=30", "x-cached-at": String(Date.now()) } });
        await caches.default.put(key, cached.clone()).catch(() => undefined);
        return cached;
      })().finally(() => pending.delete(target));
      pending.set(target, job);
    }
    return job.then(res => res.clone());
  };
  if (hit) {
    if (ctx && Date.now() - Number(hit.headers.get("x-cached-at")) > 3000) ctx.waitUntil(refresh().then(r => r.body?.cancel()).catch(() => undefined));
    return hit;
  }
  return refresh();
}

export async function streamProxyMedia(request: Request, env: StreamProxyEnv, kv: KVNamespace, url: URL, ctx?: Context) {
  const started = Date.now();
  if (request.headers.get("sec-fetch-site") === "cross-site" || (request.headers.has("origin") && request.headers.get("origin") !== url.origin)) return deny();
  const viewer = await identity(request);
  if (!viewer) return deny();
  const codec = await codecFor(env, viewer.binding);
  let ref: Reference;
  try {
    ref = JSON.parse(await codec.open(url.searchParams.get("r") || "")) as Reference;
    if (!Number.isSafeInteger(ref.exp) || ref.exp <= clock() || ref.exp > clock() + ROOT_TTL + 60 || !ref.uid || !ref.show) return deny();
    ref.url = allowed(env, ref.url);
  } catch { return deny(); }
  // Every resource verifies the session-bound encrypted reference. Playlists
  // additionally recheck live authentication/entitlement, amortized over 15 s.
  if (!(await authorizePlaylist(env, kv, viewer.sid, ref))) return deny();
  let res: Response;
  try { res = ref.root ? await playlistFetch(env, ref.url, ctx) : await originFetch(env, ref.url, request.headers.get("range")); }
  catch { return new Response("Video service temporarily unavailable", { status: 502, headers: headers() }); }
  if (!res.ok) { await res.body?.cancel(); return new Response(null, { status: res.status === 404 ? 404 : 502, headers: headers() }); }
  const type = res.headers.get("content-type") || "application/octet-stream";
  // Never give an upstream HTML/script response this site's executable origin.
  const safeType = /^(video|audio)\//i.test(type) ? type : "application/octet-stream";
  const outputHeaders = new Headers(headers(safeType));
  outputHeaders.set("server-timing", `stream;dur=${Date.now() - started}`);
  if (res.body && !/^(video|audio)\//i.test(type)) {
    const reader = res.body.getReader(), first = await reader.read();
    const prefix = first.value ? new TextDecoder().decode(first.value.subarray(0, 32)).trimStart() : "";
    if (prefix.startsWith("#EXTM3U")) {
      const remaining = new ReadableStream<Uint8Array>({
        start(c) { if (first.value) c.enqueue(first.value); if (first.done) c.close(); },
        async pull(c) { const r = await reader.read(); if (r.done) c.close(); else c.enqueue(r.value); },
        cancel(reason) { return reader.cancel(reason); },
      });
      try {
        const text = (await readPlaylist(new Response(remaining))).split("\n")
          .filter(line => !/^#EXT-X-(SESSION-DATA|DATERANGE):/.test(line.trim()) && (!line.startsWith("#") || line.startsWith("#EXT"))).join("\n");
        // Stable references within a five-minute bucket preserve HLS key/init caches.
        const exp = Math.floor(clock() / 300) * 300 + CHILD_TTL;
        const body = await rewritePlaylistAsync(text, ref.url, async absolute => {
          const next: Reference = { url: allowed(env, absolute), uid: ref.uid, show: ref.show, exp };
          return `/api/room/media?r=${await codec.seal(JSON.stringify(next))}`;
        });
        outputHeaders.set("content-type", "application/vnd.apple.mpegurl");
        return new Response(body, { headers: outputHeaders });
      } catch { return new Response("Invalid video playlist", { status: 502, headers: headers() }); }
    }
    if (/^\s*(?:<!doctype|<html|<script)/i.test(prefix)) { await reader.cancel(); return new Response(null, { status: 502, headers: headers() }); }
    const stream = new ReadableStream<Uint8Array>({
      start(c) { if (first.value) c.enqueue(first.value); if (first.done) c.close(); },
      async pull(c) { const r = await reader.read(); if (r.done) c.close(); else c.enqueue(r.value); },
      cancel(reason) { return reader.cancel(reason); },
    });
    for (const name of ["content-length", "content-range", "accept-ranges"]) { const value = res.headers.get(name); if (value) outputHeaders.set(name, value); }
    return new Response(stream, { status: res.status, headers: outputHeaders });
  }
  for (const name of ["content-length", "content-range", "accept-ranges"]) { const value = res.headers.get(name); if (value) outputHeaders.set(name, value); }
  return new Response(res.body, { status: res.status, headers: outputHeaders });
}
