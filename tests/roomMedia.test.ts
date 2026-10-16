import { describe, expect, it } from "vitest";
// Exercise the complete exchange through the site Worker, without another server.
import { afterEach, beforeEach, vi } from "vitest";
import { openProxied, roomMedia } from "../worker/roomMedia";
import { mediaUrls } from "../worker/mediaUrls";
import { partnerCall } from "../worker/partner";

// Old deployed variables must not reroute Worker requests to another server.
const env = { PARTNER_SECRET: "test-secret", PARTNER_API_BASE: "https://obsolete-relay.example", PARTNER_MEDIA_BASE: "https://obsolete-media.example" };
const playback = "https://partner.example/api/partner/p/one-time";
const main = "https://partner.example/api/partner/s/main";
const response = () => Response.json({ ok: true, playlist_url: main, play_header_name: "X-Play-Key", play_header_value: "private-key" });
let values: Map<string, string>;
let kv: KVNamespace;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  values = new Map();
  kv = {
    put: vi.fn(async (key: string, value: string) => { values.set(key, value); }),
    get: vi.fn(async (key: string) => JSON.parse(values.get(key) ?? "null")),
  } as unknown as KVNamespace;
  vi.stubGlobal("caches", { default: { put: vi.fn(async () => {}), match: vi.fn(async () => undefined) } });
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("Worker playback proxy", () => {
  it("sends signed API calls directly to the partner despite old relay variables", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ ok: true, playback_url: playback }));
    const payload = { show_slug: "jkt48_official", viewer_id: "viewer", ttl: 120 };
    const result = await partnerCall({ ...env, PARTNER_KEY_ID: "test-key", PARTNER_SERVER_IP: "192.0.2.1" }, "POST", "/api/public/partner/v1/session", payload);
    expect(result.ok).toBe(true);
    expect(fetchMock.mock.calls[0][0]).toBe("https://jkt48connect.com/api/public/partner/v1/session");
    expect(fetchMock.mock.calls[0][1].body).toBe(JSON.stringify(payload));
    expect(fetchMock.mock.calls[0][1].headers["X-Partner-Key"]).toBe("test-key");
    expect(fetchMock.mock.calls[0][1].headers["X-Signature"]).toMatch(/^[a-f0-9]{64}$/);
  });

  it("opens exact partner URLs and keeps cookies and media requests in the Worker", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "/api/partner/p/open", "set-cookie": "viewer=bound; Path=/; HttpOnly" } }))
      .mockResolvedValueOnce(response())
      .mockResolvedValueOnce(new Response("#EXTM3U\nsegment.ts", { headers: { "content-type": "application/vnd.apple.mpegurl" } }));
    const opened = await openProxied(env, kv, "viewer", playback, null, "viewer-agent");
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(["https://partner.example/api/partner/p/one-time", "https://partner.example/api/partner/p/open"]);
    expect(fetchMock.mock.calls[0][1].redirect).toBe("manual");
    expect(fetchMock.mock.calls[1][1].headers.get("cookie")).toBe("viewer=bound");
    expect(JSON.parse(values.get("media:viewer")!).cookie).toBe("viewer=bound");
    expect(JSON.stringify(opened)).not.toContain("private-key");
    // Simulate an existing KV context saved by the old relay version.
    const saved = JSON.parse(values.get("media:viewer")!);
    values.set("media:viewer", JSON.stringify({ ...saved, via: "https://obsolete-relay.example" }));
    const url = new URL(opened.playlist_url, "https://site.example");
    const media = await roomMedia(new Request(url), env, kv, url);
    expect(media.status).toBe(200);
    const manifest = await media.text();
    expect(manifest).toContain("/api/room/media?");
    expect(manifest).not.toContain("partner.example");
    expect(decodeURIComponent(manifest)).not.toContain("partner.example");
    expect(JSON.stringify(opened)).not.toContain("partner.example");
    const segment = new URL(manifest.split("\n")[1], "https://site.example");
    const codec = await mediaUrls(env.PARTNER_SECRET, "viewer");
    expect(await codec.open(segment.searchParams.get("r")!)).toBe("https://partner.example/api/partner/s/segment.ts");
    expect(fetchMock.mock.calls[2][0]).toBe("https://partner.example/api/partner/s/main");
    expect(fetchMock.mock.calls[2][1].headers.get("X-Play-Key")).toBe("private-key");
    expect(fetchMock.mock.calls[2][1].headers.get("cookie")).toBe("viewer=bound");
  });

  it("resolves relative playback URLs using the final partner URL", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "https://partner.example/api/partner/p/open?token=one-time" } }))
      .mockResolvedValueOnce(Response.json({ ok: true, playlist_url: "../s/main", play_header_name: "X-Play-Key", play_header_value: "key" }));
    const opened = await openProxied(env, kv, "viewer", playback, null, "agent");
    expect(fetchMock.mock.calls[1][0]).toBe("https://partner.example/api/partner/p/open?token=one-time");
    const url = new URL(opened.playlist_url, "https://site.example");
    expect(url.searchParams.has("u")).toBe(false);
    const codec = await mediaUrls(env.PARTNER_SECRET, "viewer");
    expect(await codec.open(url.searchParams.get("r")!)).toBe(main);
  });

  it("resumes a refused media session in the Worker with rotated credentials", async () => {
    fetchMock.mockResolvedValueOnce(response())
      .mockResolvedValueOnce(new Response(null, { status: 403 }))
      .mockResolvedValueOnce(new Response(null, { status: 307, headers: { location: "/api/partner/resume-ready", "set-cookie": "viewer=renewed; Path=/" } }))
      .mockResolvedValueOnce(Response.json({ ok: true, play_header_value: "renewed-key" }))
      .mockResolvedValueOnce(new Response("segment", { status: 206, headers: { "content-type": "video/mp2t", "content-range": "bytes 0-6/7" } }));
    const opened = await openProxied(env, kv, "viewer", playback, "https://partner.example/api/partner/resume", "agent");
    const url = new URL(opened.playlist_url, "https://site.example");
    const media = await roomMedia(new Request(url, { headers: { range: "bytes=0-6" } }), env, kv, url);
    expect(media.status).toBe(206);
    expect(media.headers.get("content-range")).toBe("bytes 0-6/7");
    expect(fetchMock.mock.calls[2][0]).toBe("https://partner.example/api/partner/resume");
    expect(fetchMock.mock.calls[4][1].headers.get("X-Play-Key")).toBe("renewed-key");
    expect(fetchMock.mock.calls[4][1].headers.get("cookie")).toBe("viewer=renewed");
    expect(fetchMock.mock.calls[4][1].headers.get("range")).toBe("bytes=0-6");
  });

  it("rejects modified encrypted references and plain upstream URLs before fetching", async () => {
    fetchMock.mockResolvedValueOnce(response());
    const opened = await openProxied(env, kv, "viewer", playback, null, "agent");
    const url = new URL(opened.playlist_url, "https://site.example");
    const reference = url.searchParams.get("r")!;
    url.searchParams.set("r", (reference[0] === "A" ? "B" : "A") + reference.slice(1));
    expect((await roomMedia(new Request(url), env, kv, url)).status).toBe(403);
    url.searchParams.delete("r");
    url.searchParams.set("u", main);
    expect((await roomMedia(new Request(url), env, kv, url)).status).toBe(403);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reports invalid partner responses and partner playback 404 clearly", async () => {
    fetchMock.mockResolvedValueOnce(new Response("<!doctype html><title>Not JSON</title>"));
    await expect(openProxied(env, kv, "viewer", playback, null, "agent")).rejects.toMatchObject({ code: "playback_invalid_response" });
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }));
    await expect(openProxied(env, kv, "viewer", playback, null, "agent")).rejects.toMatchObject({ code: "playback_not_found" });
    expect(kv.put).not.toHaveBeenCalled();
  });

  it("refuses redirects to unrelated hosts without forwarding credentials", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "https://unrelated.example/steal", "set-cookie": "viewer=private" } }));
    await expect(openProxied(env, kv, "viewer", playback, null, "agent")).rejects.toMatchObject({ code: "playback_unreachable" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(kv.put).not.toHaveBeenCalled();
  });
});
