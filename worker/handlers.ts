/**
 * Request handlers shared by the Worker (worker/index.ts) and Cloudflare
 * Pages Functions (functions/), so /api and /media work on either platform.
 *
 *   - /api/health — status, including whether the data API key is set.
 *   - /api/v1/…   — a read-only proxy to the upstream data API. The key
 *     lives in a secret and never reaches the browser. Upstream image URLs
 *     in the responses are rewritten to this site's /media proxy, so the
 *     browser only ever talks to this origin. Responses are cached at the
 *     edge for a short, per-endpoint time.
 */

export interface Env {
  ASSETS?: Fetcher;
  APP_ENV?: string;
  /** Upstream API key: `wrangler secret put DATA_API_KEY`. */
  DATA_API_KEY?: string;
  /** Older name for DATA_API_KEY, still honoured. */
  JKT48CONNECT_API_KEY?: string;
}

const UPSTREAM = "https://jkt48connect.com";
const apiKey = (env: Env) => env.DATA_API_KEY || env.JKT48CONNECT_API_KEY;

/** Upstream image URLs (plain or JSON-escaped) → /media/… on this origin. */
const UPSTREAM_IMG = /https?:\\?\/\\?\/(?:www\.)?jkt48connect\.com\\?\/((?:api\\?\/)?img\\?\/)/gi;
const rewriteImages = (body: string) => body.replace(UPSTREAM_IMG, "/media/$1");

/** Allowed upstream paths and their edge cache time (seconds). */
const ROUTES: { pattern: RegExp; ttl: number }[] = [
  { pattern: /^\/api\/v1\/live$/, ttl: 20 },
  { pattern: /^\/api\/v1\/recent$/, ttl: 30 },
  { pattern: /^\/api\/v1\/recent\/detail$/, ttl: 60 },
  { pattern: /^\/api\/v1\/members$/, ttl: 600 },
  { pattern: /^\/api\/v1\/members\/[A-Za-z0-9_-]{1,64}$/, ttl: 600 },
  { pattern: /^\/api\/v1\/birthday$/, ttl: 3600 },
  { pattern: /^\/api\/v1\/theater$/, ttl: 300 },
  { pattern: /^\/api\/v1\/news$/, ttl: 300 },
  { pattern: /^\/api\/v1\/news\/[A-Za-z0-9-]{1,200}$/, ttl: 1800 },
];
/** Query parameters passed through to the upstream; everything else is dropped. */
const PASS_PARAMS = new Set(["page", "limit", "offset", "name", "type", "from", "to", "sort", "order", "room_id"]);

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "x-content-type-options": "nosniff",
};

function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, "cache-control": "no-store", ...extra } });
}

async function proxy(request: Request, env: Env, ctx: ExecutionContext, url: URL): Promise<Response> {
  const route = ROUTES.find((r) => r.pattern.test(url.pathname));
  if (!route) return json({ ok: false, error: "not_found" }, 404);
  const key = apiKey(env);
  if (!key) return json({ ok: false, error: "not_configured", message: "DATA_API_KEY is not set." }, 503);

  const upstream = new URL(url.pathname, UPSTREAM);
  for (const [k, v] of url.searchParams) if (PASS_PARAMS.has(k) && v.length <= 100) upstream.searchParams.set(k, v);

  // Edge cache keyed on the upstream URL (the key itself is not part of it);
  // `_r` versions the rewritten body.
  const cache = caches.default;
  const cacheKey = new Request(`${upstream.toString()}${upstream.search ? "&" : "?"}_r=2`, { method: "GET" });
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  let res: Response;
  try {
    res = await fetch(upstream.toString(), { headers: { "x-api-key": key, accept: "application/json" } });
  } catch {
    return json({ ok: false, error: "upstream_unreachable" }, 502);
  }
  const body = rewriteImages(await res.text());
  if (!res.ok) {
    // Pass the upstream status through, without its headers.
    return new Response(body, { status: res.status, headers: { ...JSON_HEADERS, "cache-control": "no-store" } });
  }
  const out = new Response(body, { status: 200, headers: { ...JSON_HEADERS, "cache-control": `public, max-age=${route.ttl}` } });
  ctx.waitUntil(cache.put(cacheKey, out.clone()));
  return out;
}

/**
 * Image proxy: /media/<path> → the upstream's <path>, for its image paths
 * only. Images there are content-addressed, so they are cached
 * at the edge and in browsers for a year.
 */
async function media(request: Request, ctx: ExecutionContext, url: URL): Promise<Response> {
  const path = url.pathname.slice("/media/".length);
  let upstream: string;
  let headers: Record<string, string> = {};
  let ttl = 31536000;
  if (/^(api\/img|img)\/[A-Za-z0-9/_.-]{1,300}$/.test(path)) {
    upstream = `${UPSTREAM}/${path}`;
  } else {
    // /media/x/<host>/<path>: images embedded in official news articles. The
    // official site only serves them to its own pages, so ask as jkt48.com.
    const m = /^x\/([a-z0-9.-]{1,80})\/(.{1,400})$/i.exec(path);
    if (!m || !/(^|\.)jkt48\.com$/i.test(m[1])) return new Response("Not found", { status: 404 });
    upstream = `https://${m[1]}/${m[2]}${url.search}`;
    headers = { Origin: "https://jkt48.com", Referer: "https://jkt48.com/", "User-Agent": "Mozilla/5.0 (compatible; Avonera48 image proxy)" };
    ttl = 2592000;
  }
  const cache = caches.default;
  const key = new Request(upstream, { method: "GET" });
  const hit = await cache.match(key);
  if (hit) return hit;
  let res: Response;
  try {
    res = await fetch(upstream, { headers, cf: { cacheEverything: true, cacheTtl: ttl } } as RequestInit);
  } catch {
    return new Response("Upstream unreachable", { status: 502 });
  }
  const type = res.headers.get("content-type") ?? "";
  if (!res.ok || !type.startsWith("image/")) return new Response("Not found", { status: res.ok ? 404 : res.status });
  const out = new Response(res.body, {
    status: 200,
    headers: { "content-type": type, "cache-control": `public, max-age=${ttl}${ttl > 2592000 ? ", immutable" : ""}`, "x-content-type-options": "nosniff" },
  });
  ctx.waitUntil(cache.put(key, out.clone()));
  return out;
}

type Ctx = Pick<ExecutionContext, "waitUntil">;

/** Handles /api/* and /media/*; returns null for everything else. */
export async function handle(request: Request, env: Env, ctx: Ctx): Promise<Response | null> {
  const url = new URL(request.url);

  if (url.pathname.startsWith("/media/")) {
    if (request.method !== "GET" && request.method !== "HEAD") return new Response(null, { status: 405, headers: { allow: "GET, HEAD" } });
    return media(request, ctx as ExecutionContext, url);
  }

  if (!url.pathname.startsWith("/api/")) return null;
  if (request.method !== "GET" && request.method !== "HEAD") return json({ ok: false, error: "method_not_allowed" }, 405, { allow: "GET, HEAD" });

  if (url.pathname === "/api/health") {
    return json({ service: "avonera48", status: "ok", environment: env.APP_ENV ?? "pages", dataSource: apiKey(env) ? "live" : "not_configured" });
  }
  if (url.pathname.startsWith("/api/v1/")) return proxy(request, env, ctx as ExecutionContext, url);
  return json({ ok: false, error: "not_found" }, 404);
}
