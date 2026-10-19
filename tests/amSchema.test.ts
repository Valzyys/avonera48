import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { handleAm } from "../worker/am";
import { AM_SCHEMA, ensureAmSchema } from "../worker/am/schema";
let mf: Miniflare;
let db: D1Database;
const viewer = { id: "existing-user" };
beforeAll(async () => {
  mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: "export default { fetch() { return new Response('test'); } }",
      d1Databases: ["DB", "OTHER"],
    }),
  );
  db = (await mf.getD1Database("DB")) as unknown as D1Database;
  await db.batch([
    db.prepare(
      "CREATE TABLE orders(id TEXT PRIMARY KEY, status TEXT NOT NULL)",
    ),
    db.prepare("INSERT INTO orders VALUES ('existing-order','SUCCESS')"),
  ]);
}, 30000);
afterAll(async () => mf?.dispose());

describe("AM first-use database setup", () => {
  it("opens status and history concurrently without a pre-applied migration and preserves existing tables", async () => {
    const results = await Promise.all(
      ["/status", "/accounts", "/status"].map((path) => {
        const request = new Request(`https://avonera.example/api/am${path}`);
        return handleAm(request, { DB: db }, viewer, new URL(request.url));
      }),
    );
    expect(results.map((r) => r.status)).toEqual([200, 200, 200]);
    expect((await results[0].json()).database).toBe(true);
    expect((await results[1].json()).items).toEqual([]);
    expect(
      (
        await db
          .prepare("SELECT status FROM orders WHERE id='existing-order'")
          .first()
      )?.status,
    ).toBe("SUCCESS");
  });
  it("keeps existing AM accounts and supports applying the equivalent migration afterward", async () => {
    const id = crypto.randomUUID();
    const date = new Date().toISOString();
    await db
      .prepare(
        "INSERT INTO am_accounts VALUES (?,?,?,'bussiness.biz.id','ready',?,?)",
      )
      .bind(id, viewer.id, `${id}@bussiness.biz.id`, date, date)
      .run();
    const sql = (
      await readFile(
        new URL("../migrations/0001_am_dashboard.sql", import.meta.url),
        "utf8",
      )
    )
      .replace(/^--.*$/gm, "")
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s && !s.startsWith("PRAGMA"));
    expect(AM_SCHEMA.map((s) => s.replace(/\s+/g, " "))).toEqual(
      sql.map((s) => s.replace(/\s+/g, " ")),
    );
    await db.batch(sql.map((s) => db.prepare(s)));
    await ensureAmSchema(db);
    expect(
      (
        await db
          .prepare("SELECT status FROM am_accounts WHERE id=?")
          .bind(id)
          .first()
      )?.status,
    ).toBe("ready");
  });
  it("initializes another binding independently", async () => {
    const other = (await mf.getD1Database("OTHER")) as unknown as D1Database;
    const request = new Request("https://avonera.example/api/am/accounts");
    expect(
      (await handleAm(request, { DB: other }, viewer, new URL(request.url)))
        .status,
    ).toBe(200);
    expect(
      (await other.prepare("SELECT COUNT(*) AS n FROM am_accounts").first())?.n,
    ).toBe(0);
  });
  it("shares in-flight setup and retries after an initialization failure", async () => {
    const batch = vi
      .fn()
      .mockRejectedValueOnce(new Error("temporary D1 outage"))
      .mockResolvedValueOnce([]);
    const testDb = {
      prepare: vi.fn((sql: string) => sql),
      batch,
    } as unknown as D1Database;
    const first = ensureAmSchema(testDb);
    const second = ensureAmSchema(testDb);
    expect(first).toBe(second);
    await expect(first).rejects.toThrow("temporary D1 outage");
    await ensureAmSchema(testDb);
    expect(batch).toHaveBeenCalledTimes(2);
  });
});
