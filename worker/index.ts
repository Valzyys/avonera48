/**
 * AVONERA48 Worker entry.
 *
 * Static assets (the React app) are served by the Workers assets layer.
 * This script only handles /api/* — during the UI preview phase it exposes a
 * health endpoint and answers every other API path with an explicit
 * "not available yet" response instead of fabricated data.
 */

export interface Env {
  ASSETS: Fetcher;
  APP_ENV: string;
}

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      if (request.method !== "GET" && request.method !== "HEAD") {
        return json({ error: "method_not_allowed" }, 405);
      }
      return json({
        service: "avonera48",
        status: "ok",
        environment: env.APP_ENV,
        dataSource: "preview",
      });
    }

    if (url.pathname.startsWith("/api/")) {
      return json(
        {
          error: "not_available",
          message:
            "The AVONERA48 data API is not public yet. The dashboard currently runs on preview data.",
        },
        501,
      );
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
