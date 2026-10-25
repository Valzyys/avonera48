import { describe, expect, it } from "vitest";
import { mediaUrls } from "../../worker/mediaUrls";
import { rewritePlaylistAsync } from "../../worker/hls";

const upstream = "https://jkt48connect.com/api/partner/s/private-id?key=secret";

describe("opaque media references", () => {
  it("reuses hot references while keeping fresh nonces across codec instances", async () => {
    const codec = await mediaUrls("signing-secret", "viewer-a");
    const first = await codec.seal(upstream);
    const second = await codec.seal(upstream);
    expect(first).toBe(second);
    const fresh = await (await mediaUrls("signing-secret", "viewer-a")).seal(upstream);
    expect(fresh).not.toBe(first);
    expect(await codec.open(fresh)).toBe(upstream);
    expect(first).not.toContain("jkt48connect");
    expect(await codec.open(first)).toBe(upstream);
  });

  it("rejects tampering, another viewer and another secret", async () => {
    const codec = await mediaUrls("signing-secret", "viewer-a");
    const sealed = await codec.seal(upstream);
    const tampered = (sealed[0] === "A" ? "B" : "A") + sealed.slice(1);
    await expect(codec.open(tampered)).rejects.toThrow();
    await expect((await mediaUrls("signing-secret", "viewer-b")).open(sealed)).rejects.toThrow();
    await expect((await mediaUrls("different-secret", "viewer-a")).open(sealed)).rejects.toThrow();
    await expect(codec.open(upstream)).rejects.toThrow();
  });

  it("hides playlist, initialization and key addresses, including nested query strings", async () => {
    const codec = await mediaUrls("signing-secret", "viewer-a");
    const body = ['#EXTM3U', `#EXT-X-KEY:METHOD=AES-128,URI="${upstream}"`, '#EXT-X-MAP:URI="init.mp4"', '#EXTINF:2,', 'part.ts?token=private'].join("\n");
    const rewritten = await rewritePlaylistAsync(body, upstream, async (url) => `/api/room/media?r=${await codec.seal(url)}`);
    expect(rewritten).not.toContain("jkt48connect.com");
    expect(rewritten).not.toContain("secret");
    expect(rewritten).not.toContain("private");
    expect(rewritten.match(/\/api\/room\/media\?r=/g)).toHaveLength(3);
    expect(rewritten).toContain("#EXTINF:2,");
  });
});

it("keeps HLS key references stable across sliding playlist refreshes", async () => {
  const codec = await mediaUrls("secret", "viewer");
  const wrap = (url: string) => codec.seal(url);
  const key = '#EXT-X-KEY:METHOD=AES-128,URI="key"';
  const first = await rewritePlaylistAsync(`#EXTM3U\n${key}\nseg1.ts\nseg2.ts`, upstream, wrap);
  const next = await rewritePlaylistAsync(`#EXTM3U\n${key}\nseg2.ts\nseg3.ts`, upstream, wrap);
  expect(first.split("\n")[1]).toBe(next.split("\n")[1]);
  expect(first.split("\n")[3]).toBe(next.split("\n")[2]);
});
it("bounds the reference cache without making older URLs undecryptable", async () => {
  const codec = await mediaUrls("secret", "viewer");
  const old = await codec.seal(upstream);
  for (let n = 0; n < 256; n++) await codec.seal(`${upstream}&segment=${n}`);
  expect(await codec.seal(upstream)).not.toBe(old);
  expect(await codec.open(old)).toBe(upstream);
});
it("shares concurrent sealing of the same resource", async () => {
  const codec = await mediaUrls("secret", "viewer");
  const refs = await Promise.all(Array.from({ length: 10 }, () => codec.seal(upstream)));
  expect(new Set(refs).size).toBe(1);
});
