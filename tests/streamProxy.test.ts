import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { openStreamProxy, streamProxyMedia } from "../worker/streamProxy";
import { handleAuth } from "../worker/auth";
import { sha256 } from "../worker/http";

const env = { STREAM_PROXY_BASE: "https://stream.test", STREAM_MEDIA_SECRET: "private-server-key" };
let token: string, kv: KVNamespace, values: Map<string, unknown>;
let fetchMock: ReturnType<typeof vi.fn>;
const origin = "https://avonera.test";
const req = (path: string, session = token, extra: Record<string, string> = {}) => new Request(new URL(path, origin), { headers: { cookie: `avn_session=${session}`, "user-agent": "test-browser", ...extra } });
const media = async (path: string, session = token, extra: Record<string, string> = {}) => { const r = req(path, session, extra); return streamProxyMedia(r, env, kv, new URL(r.url)); };
const open = () => openStreamProxy(req("/api/room/session"), env, "viewer", "show-live");
beforeEach(async () => {
  token = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, "0")).join("");
  values = new Map([[`sess:${await sha256(token)}`, { email: "viewer@example.com" }], ["user:viewer@example.com", { id: "viewer", email: "viewer@example.com", role: "admin" }]]);
  kv = { get: vi.fn(async (key: string) => values.get(key) ?? null), put: vi.fn(async (key: string, value: string) => { values.set(key, value); }) } as unknown as KVNamespace;
  const cache = new Map<string, Response>();
  vi.stubGlobal("caches", { default: { match: vi.fn(async (r: Request) => cache.get(r.url)?.clone()), put: vi.fn(async (r: Request, response: Response) => { cache.set(r.url, response.clone()); }) } });
  fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it("opens the room without partner calls or stored playback contexts", async () => {
  const request = new Request(origin + "/api/room/session", { method: "POST", headers: { cookie: `avn_session=${token}`, "user-agent": "test-browser", origin, "content-type": "application/json" }, body: JSON.stringify({ show: "show-live" }) });
  const response = await handleAuth(request, { ...env, AUTH: kv }, new URL(request.url));
  expect(response?.status).toBe(200);
  const output = await response!.json() as { playlist_url: string };
  expect(output.playlist_url).toMatch(/^\/api\/room\/media\?r=/);
  expect(JSON.stringify(output)).not.toContain("stream.test");
  expect(JSON.stringify(output)).not.toContain("private-server-key");
  expect(fetchMock).not.toHaveBeenCalled();
  expect([...values.keys()].some(k => k.startsWith("media:"))).toBe(false);
});

it("rewrites every playlist URI, strips upstream metadata, and preserves stable references", async () => {
  fetchMock.mockResolvedValueOnce(new Response('#EXTM3U\n#EXT-X-SESSION-DATA:DATA-ID="NODE",VALUE="upstream.example"\n#EXT-X-KEY:METHOD=AES-128,URI="/s/key"\n#EXTINF:6,\n/s/segment', { headers: { "content-type": "application/vnd.apple.mpegurl" } }));
  const opened = await open(), first = await media(opened.playlist_url);
  const text = await first.text();
  expect(text).not.toContain("stream.test");expect(text).not.toContain("upstream.example");expect(text).not.toContain("SESSION-DATA");
  expect(text).toContain('URI="/api/room/media?r=');
  expect(first.headers.get("cache-control")).toContain("no-store");
  expect(await (await media(opened.playlist_url)).text()).toBe(text);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0][1].headers.cookie).toBeUndefined();
});

it("refuses replay without the original login cookie/browser, tampering and cross-site requests", async () => {
  const opened = await open();
  const missing = new Request(new URL(opened.playlist_url, origin));
  expect((await streamProxyMedia(missing, env, kv, new URL(missing.url))).status).toBe(403);
  expect((await media(opened.playlist_url, "b".repeat(64))).status).toBe(403);
  expect((await media(opened.playlist_url, token, { "user-agent": "another-browser" })).status).toBe(403);
  expect((await media(opened.playlist_url, token, { origin: "https://other.test" })).status).toBe(403);
  expect((await media(opened.playlist_url, token, { "sec-fetch-site": "cross-site" })).status).toBe(403);
  const modified = new URL(opened.playlist_url, origin);const ref = modified.searchParams.get("r")!;
  modified.searchParams.set("r", (ref[0] === "A" ? "B" : "A") + ref.slice(1));
  expect((await media(modified.href)).status).toBe(403);
  expect(fetchMock).not.toHaveBeenCalled();
});

it("rejects expired capabilities and revoked sessions before contacting the proxy", async () => {
  const opened = await open();
  values.delete(`sess:${await sha256(token)}`);
  expect((await media(opened.playlist_url)).status).toBe(403);
  vi.useFakeTimers();vi.setSystemTime(Date.now() + 7 * 3600_000);
  expect((await media(opened.playlist_url)).status).toBe(403);
  expect(fetchMock).not.toHaveBeenCalled();
});

it("streams binary bytes without waiting for the segment to finish and forwards byte ranges", async () => {
  const opened = await open();
  fetchMock.mockResolvedValueOnce(new Response("#EXTM3U\n#EXTINF:6,\n/s/segment"));
  const text = await (await media(opened.playlist_url)).text();const path = text.split("\n").at(-1)!;
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  fetchMock.mockResolvedValueOnce(new Response(new ReadableStream<Uint8Array>({ start(c) { controller = c; c.enqueue(new Uint8Array([71, 2, 3])); } }), { status: 206, headers: { "content-type": "video/mp2t", "content-range": "bytes 0-5/6" } }));
  const response = await media(path, token, { range: "bytes=0-5" });const reader = response.body!.getReader();
  expect(response.status).toBe(206);expect(response.headers.get("content-range")).toBe("bytes 0-5/6");
  expect((await reader.read()).value).toEqual(new Uint8Array([71, 2, 3]));
  expect(fetchMock.mock.calls[1][1].headers.range).toBe("bytes=0-5");
  controller.close();await reader.cancel();
});

it("does not leak an upstream URL through redirects, errors or executable HTML", async () => {
  const opened = await open();
  fetchMock.mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "https://private.example/secret" } }));
  const bad = await media(opened.playlist_url);expect(bad.status).toBe(502);expect(await bad.text()).not.toContain("private.example");
  fetchMock.mockResolvedValueOnce(new Response('<html><script>alert(1)</script></html>', { headers: { "content-type": "text/html" } }));
  expect((await media(opened.playlist_url)).status).toBe(502);
});
