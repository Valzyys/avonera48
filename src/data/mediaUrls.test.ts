import { describe, expect, it } from "vitest";
import { mediaUrls } from "../../worker/mediaUrls";
import { rewritePlaylistAsync } from "../../worker/hls";

const upstream = "https://jkt48connect.com/api/partner/s/private-id?key=secret";

describe("opaque media references", () => {
  it("encrypts upstream addresses with fresh nonces", async () => {
    const codec = await mediaUrls("signing-secret", "viewer-a");
    const first = await codec.seal(upstream);
    const second = await codec.seal(upstream);
    expect(first).not.toBe(second);
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
