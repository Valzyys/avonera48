import { describe, expect, it } from "vitest";
// Exercise the complete exchange through the site Worker, without another server.
import { afterEach, beforeEach, vi } from "vitest";
import { openProxied, roomMedia } from "../worker/roomMedia";
import { mediaUrls } from "../worker/mediaUrls";
import { partnerCall } from "../worker/partner";
import { handleAuth } from "../worker/auth";
import { sha256 } from "../worker/http";

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
    const opened = await openProxied(env, kv, "viewer", playback, null, "viewer-agent", "https://site.example");
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(["https://partner.example/api/partner/p/one-time", "https://partner.example/api/partner/p/open"]);
    expect(fetchMock.mock.calls[0][1].redirect).toBe("manual");
    expect(fetchMock.mock.calls[0][1].headers.get("origin")).toBe("https://site.example");
    expect(fetchMock.mock.calls[1][1].headers.get("referer")).toBe("https://site.example/");
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
    expect(fetchMock.mock.calls[2][1].headers.get("origin")).toBe("https://site.example");
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
    const opened = await openProxied(env, kv, "viewer", playback, "https://partner.example/api/partner/resume", "agent", "https://site.example");
    const url = new URL(opened.playlist_url, "https://site.example");
    const media = await roomMedia(new Request(url, { headers: { range: "bytes=0-6" } }), env, kv, url);
    expect(media.status).toBe(206);
    expect(media.headers.get("content-range")).toBe("bytes 0-6/7");
    expect(fetchMock.mock.calls[2][0]).toBe("https://partner.example/api/partner/resume");
    expect(fetchMock.mock.calls[2][1].headers.get("origin")).toBe("https://site.example");
    expect(fetchMock.mock.calls[4][1].headers.get("origin")).toBe("https://site.example");
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

  it.each([true, false])("returns sanitized playback diagnostics only to admins (admin=%s)", async (admin) => {
    const token = "a".repeat(64);
    values.set(`sess:${await sha256(token)}`, JSON.stringify({ email: "viewer@example.com" }));
    values.set("user:viewer@example.com", JSON.stringify({ id: "viewer", email: "viewer@example.com", name: "Viewer", ...(admin ? { role: "admin" } : {}) }));
    fetchMock.mockResolvedValueOnce(Response.json({ ok: true, playback_url: playback }))
      .mockResolvedValueOnce(Response.json({ ok: false, code: "ORIGIN_NOT_ALLOWED", message: `Denied ${playback}`, hint: "private-key" }, { status: 404 }));
    const request = new Request("https://site.example/api/room/session", {
      method: "POST", headers: { cookie: `avn_session=${token}`, origin: "https://site.example", "content-type": "application/json" }, body: JSON.stringify({ show: "jkt48_official" }),
    });
    const res = await handleAuth(request, { ...env, AUTH: kv, PARTNER_KEY_ID: "test-key", PARTNER_SERVER_IP: "192.0.2.1" }, new URL(request.url));
    expect(res!.status).toBe(502);
    const body = await res!.json();
    expect(body.error).toBe("playback_origin_not_allowed");
    if (admin) expect(body.diagnostic).toEqual({ stage: "playback", upstream_status: 404, response_kind: "json", partner_code: "ORIGIN_NOT_ALLOWED" });
    else expect(body).not.toHaveProperty("diagnostic");
    expect(JSON.stringify(body)).not.toContain("partner.example");
    expect(JSON.stringify(body)).not.toContain("private-key");
    expect(fetchMock.mock.calls[1][1].headers.get("origin")).toBe("https://site.example");
  });

  it("distinguishes HTML route failures from JSON domain rejections without exposing bodies", async () => {
    fetchMock.mockResolvedValueOnce(new Response("<!doctype html>private-token", { status: 404, headers: { "content-type": "text/html" } }));
    await expect(openProxied(env, kv, "viewer", playback, null, "agent")).rejects.toMatchObject({
      code: "playback_not_found", diagnostic: { upstream_status: 404, response_kind: "html", partner_code: null },
    });
    fetchMock.mockResolvedValueOnce(Response.json({ code: "https://partner.example/private-token" }, { status: 404 }));
    await expect(openProxied(env, kv, "viewer", playback, null, "agent")).rejects.toMatchObject({ diagnostic: { partner_code: null } });
  });

  it("refuses redirects to unrelated hosts without forwarding credentials", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "https://unrelated.example/steal", "set-cookie": "viewer=private" } }));
    await expect(openProxied(env, kv, "viewer", playback, null, "agent")).rejects.toMatchObject({ code: "playback_unreachable" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(kv.put).not.toHaveBeenCalled();
  });
});

describe("Worker playback proxy under live load", () => {
  const segmentUrl = async (opened: { playlist_url: string }, path = "https://partner.example/api/partner/s/seg-1.ts") => {
    const t = new URL(opened.playlist_url, "https://site.example").searchParams.get("t")!;
    const codec = await mediaUrls(env.PARTNER_SECRET, "viewer");
    return new URL(`https://site.example/api/room/media?t=${t}&r=${await codec.seal(path)}`);
  };

  it("doesn't write KV for every segment when the partner rotates cookies", async () => {
    fetchMock.mockResolvedValueOnce(response());
    const opened = await openProxied(env, kv, "viewer", playback, null, "agent");
    const writes = vi.mocked(kv.put).mock.calls.length;
    for (let i = 0; i < 5; i++) {
      fetchMock.mockResolvedValueOnce(new Response("segment", { headers: { "content-type": "video/mp2t", "set-cookie": `lb=${i}; Path=/` } }));
      const url = await segmentUrl(opened);
      expect((await roomMedia(new Request(url), env, kv, url)).status).toBe(200);
    }
    expect(vi.mocked(kv.put).mock.calls.length).toBe(writes);
  });

  it("still serves the segment when KV refuses a write", async () => {
    fetchMock.mockResolvedValueOnce(response());
    const opened = await openProxied(env, kv, "viewer", playback, null, "agent");
    const saved = JSON.parse(values.get("media:viewer")!);
    values.set("media:viewer", JSON.stringify({ ...saved, savedAt: 0 })); // due for a write
    vi.mocked(kv.put).mockRejectedValue(new Error("KV PUT failed: 429 Too Many Requests"));
    fetchMock.mockResolvedValueOnce(new Response("segment", { headers: { "content-type": "video/mp2t", "set-cookie": "lb=new; Path=/" } }));
    const url = await segmentUrl(opened);
    const res = await roomMedia(new Request(url), env, kv, url);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("segment");
  });

  it("resumes once when the playlist and a segment are refused together", async () => {
    fetchMock.mockResolvedValueOnce(response());
    const opened = await openProxied(env, kv, "viewer", playback, "https://partner.example/api/partner/resume", "agent");
    let resumes = 0;
    fetchMock.mockImplementation(async (input: string, init: RequestInit) => {
      if (input.endsWith("/resume")) {
        resumes++;
        await new Promise((r) => setTimeout(r, 20));
        return Response.json({ ok: true, play_header_value: `renewed-${resumes}` });
      }
      const key = new Headers(init.headers).get("X-Play-Key");
      return key === "private-key" ? new Response(null, { status: 403 }) : new Response("segment", { headers: { "content-type": "video/mp2t" } });
    });
    const a = await segmentUrl(opened, "https://partner.example/api/partner/s/seg-1.ts");
    const b = await segmentUrl(opened, "https://partner.example/api/partner/s/seg-2.ts");
    const [ra, rb] = await Promise.all([roomMedia(new Request(a), env, kv, a), roomMedia(new Request(b), env, kv, b)]);
    expect([ra.status, rb.status]).toEqual([200, 200]);
    expect(resumes).toBe(1);
  });

  it("streams octet-stream segments and still rewrites octet-stream playlists", async () => {
    fetchMock.mockResolvedValueOnce(response());
    const opened = await openProxied(env, kv, "viewer", playback, null, "agent");
    const bytes = new Uint8Array(4096).map((_, i) => i % 251);
    fetchMock.mockResolvedValueOnce(new Response(bytes, { headers: { "content-type": "application/octet-stream" } }));
    let url = await segmentUrl(opened);
    const seg = await roomMedia(new Request(url), env, kv, url);
    expect(new Uint8Array(await seg.arrayBuffer())).toEqual(bytes);
    fetchMock.mockResolvedValueOnce(new Response("#EXTM3U\n#EXTINF:2,\nseg-9.ts", { headers: { "content-type": "binary/octet-stream" } }));
    url = await segmentUrl(opened, main);
    const list = await (await roomMedia(new Request(url), env, kv, url)).text();
    expect(list).toContain("/api/room/media?");
    expect(list).not.toContain("partner.example");
  });

  it("answers 504 instead of hanging when the partner doesn't respond", async () => {
    fetchMock.mockResolvedValueOnce(response());
    const opened = await openProxied(env, kv, "viewer", playback, null, "agent");
    const url = await segmentUrl(opened);
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      fetchMock.mockImplementationOnce((_u: string, init: RequestInit) => new Promise((_r, reject) => init.signal!.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))));
      const pending = roomMedia(new Request(url), env, kv, url);
      while (fetchMock.mock.calls.length < 2) await new Promise((r) => setImmediate(r));
      await vi.advanceTimersByTimeAsync(16_000);
      expect((await pending).status).toBe(504);
    } finally {
      vi.useRealTimers();
    }
  });
});
