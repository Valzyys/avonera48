/**
 * AVONERA48 Worker entry.
 *
 * Static assets (the React app) are served by the Workers assets layer.
 * This script handles /api/*:
 *   - /api/health — status, including whether the data API key is set.
 *   - /api/v1/…   — a read-only proxy to the jkt48connect.com API. The key
 *     lives in the JKT48CONNECT_API_KEY secret and never reaches the browser.
 *     Responses are cached at the edge for a short, per-endpoint time.
 */

export interface Env {
  ASSETS: Fetcher;
  APP_ENV: string;
  /** Set with `wrangler secret put JKT48CONNECT_API_KEY`. */
  JKT48CONNECT_API_KEY?: string;
}

const UPSTREAM = "https://jkt48connect.com";

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
  if (!env.JKT48CONNECT_API_KEY) return json({ ok: false, error: "not_configured", message: "JKT48CONNECT_API_KEY is not set." }, 503);

  const upstream = new URL(url.pathname, UPSTREAM);
  for (const [k, v] of url.searchParams) if (PASS_PARAMS.has(k) && v.length <= 100) upstream.searchParams.set(k, v);

  // Edge cache keyed on the upstream URL (the key itself is not part of it).
  const cache = caches.default;
  const cacheKey = new Request(upstream.toString(), { method: "GET" });
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  let res: Response;
  try {
    res = await fetch(upstream.toString(), { headers: { "x-api-key": env.JKT48CONNECT_API_KEY, accept: "application/json" } });
  } catch {
    return json({ ok: false, error: "upstream_unreachable" }, 502);
  }
  const body = await res.text();
  if (!res.ok) {
    // Pass the upstream status through, without its headers.
    return new Response(body, { status: res.status, headers: { ...JSON_HEADERS, "cache-control": "no-store" } });
  }
  const out = new Response(body, { status: 200, headers: { ...JSON_HEADERS, "cache-control": `public, max-age=${route.ttl}` } });
  ctx.waitUntil(cache.put(cacheKey, out.clone()));
  return out;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/") && request.method !== "GET" && request.method !== "HEAD") {
      return json({ ok: false, error: "method_not_allowed" }, 405, { allow: "GET, HEAD" });
    }

    if (url.pathname === "/api/health") {
      return json({ service: "avonera48", status: "ok", environment: env.APP_ENV, dataSource: env.JKT48CONNECT_API_KEY ? "jkt48connect" : "not_configured" });
    }

    if (url.pathname.startsWith("/api/v1/")) return proxy(request, env, ctx, url);
    if (url.pathname.startsWith("/api/")) return json({ ok: false, error: "not_found" }, 404);

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
