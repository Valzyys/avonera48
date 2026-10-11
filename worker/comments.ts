/**
 * Live comments in the watch room, per show.
 *
 *   GET    /api/room/:show/comments?after=<id>         latest (or newer than id)
 *   GET    /api/room/:show/comments/stream?after=<id>  Server-Sent Events
 *   POST   /api/room/:show/comments                    { body }
 *   DELETE /api/room/:show/comments/:id                own comment, or admin
 *
 * Only viewers with access to the show (or admins) can read and post. The
 * stream pushes new comments as they land, for about a minute per
 * connection; EventSource reconnects with Last-Event-ID.
 */

import { ensureSchema } from "./db";
import { body, fail, reply, str } from "./http";
import { accessTo, isAdmin, type ShopEnv, type Viewer } from "./shop";

interface Row {
  id: number;
  user_id: string;
  name: string;
  avatar: string | null;
  body: string;
  created_at: number;
}

const out = (r: Row, me: string) => ({ id: r.id, name: r.name, avatar: r.avatar, body: r.body, at: r.created_at, mine: r.user_id === me });

async function since(db: D1Database, show: string, after: number) {
  if (after > 0) return (await db.prepare("SELECT * FROM comments WHERE show = ? AND id > ? ORDER BY id LIMIT 100").bind(show, after).all<Row>()).results;
  const latest = await db.prepare("SELECT * FROM comments WHERE show = ? ORDER BY id DESC LIMIT 60").bind(show).all<Row>();
  return latest.results.reverse();
}

function stream(db: D1Database, show: string, after: number, me: string) {
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  const te = new TextEncoder();
  (async () => {
    let last = after;
    const until = Date.now() + 60_000;
    try {
      await writer.write(te.encode("retry: 1500\n\n"));
      while (Date.now() < until) {
        const rows = await since(db, show, last);
        for (const r of rows) {
          last = Math.max(last, r.id);
          await writer.write(te.encode(`id: ${r.id}\ndata: ${JSON.stringify(out(r, me))}\n\n`));
        }
        if (!rows.length) await writer.write(te.encode(": ping\n\n"));
        await new Promise((res) => setTimeout(res, 1500));
      }
    } catch {
      /* the viewer left */
    }
    await writer.close().catch(() => undefined);
  })();
  return new Response(readable, { headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" } });
}

export async function handleComments(request: Request, env: ShopEnv, viewer: Viewer & { avatar?: string | null }, url: URL, sameOriginOk: boolean): Promise<Response | null> {
  const m = /^\/api\/room\/([a-z0-9_-]{1,40})\/comments(?:\/(stream|\d+))?$/.exec(url.pathname);
  if (!m) return null;
  if (!env.DB) return fail(503, "not_configured", "Comments aren’t set up yet.");
  const db = env.DB;
  await ensureSchema(db);
  const show = m[1];
  const admin = isAdmin(env, viewer.email);
  if (!admin && !(await accessTo(db, viewer.id, show))) return fail(402, "no_access", "Get a ticket or a membership to join the chat.");

  if (request.method === "GET") {
    const after = Number(url.searchParams.get("after") ?? request.headers.get("last-event-id") ?? 0) || 0;
    if (m[2] === "stream") return stream(db, show, after, viewer.id);
    if (m[2]) return fail(404, "not_found", "Not found.");
    return reply({ ok: true, comments: (await since(db, show, after)).map((r) => out(r, viewer.id)) });
  }

  if (!sameOriginOk) return fail(403, "forbidden", "Cross-site requests are not allowed.");

  if (request.method === "POST" && !m[2]) {
    const text = str((await body(request)).body, 600).replace(/\s+/g, " ").trim().slice(0, 280);
    if (!text) return fail(400, "invalid", "Write something first.");
    const last = await db.prepare("SELECT created_at FROM comments WHERE show = ? AND user_id = ? ORDER BY id DESC LIMIT 1").bind(show, viewer.id).first<{ created_at: number }>();
    if (last && Date.now() - last.created_at < 2000) return fail(429, "slow_down", "Slow down a little.");
    const now = Date.now();
    const r = await db
      .prepare("INSERT INTO comments (show, user_id, name, avatar, body, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(show, viewer.id, viewer.name, viewer.avatar ?? null, text, now)
      .run();
    return reply({ ok: true, comment: { id: r.meta.last_row_id, name: viewer.name, avatar: viewer.avatar ?? null, body: text, at: now, mine: true } });
  }

  if (request.method === "DELETE" && m[2] && /^\d+$/.test(m[2])) {
    const id = Number(m[2]);
    const r = admin
      ? await db.prepare("DELETE FROM comments WHERE id = ? AND show = ?").bind(id, show).run()
      : await db.prepare("DELETE FROM comments WHERE id = ? AND show = ? AND user_id = ?").bind(id, show, viewer.id).run();
    return r.meta.changes ? reply({ ok: true }) : fail(404, "not_found", "That comment is gone.");
  }
  return fail(405, "method_not_allowed", "Not allowed.");
}
