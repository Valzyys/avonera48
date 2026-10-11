import { describe, expect, it } from "vitest";
import { rewritePlaylist } from "../../worker/hls";

describe("room media proxy", () => {
  it("points every playlist URI (lines and URI attributes) back at the proxy", () => {
    const src = ["#EXTM3U", '#EXT-X-MAP:URI="init.mp4"', '#EXT-X-KEY:METHOD=AES-128,URI="https://p.example/api/partner/s/key1"', "#EXTINF:2.0,", "seg0.m4s", "", "https://p.example/api/partner/s/abc"].join("\n");
    const out = rewritePlaylist(src, "https://p.example/api/partner/s/index", (u) => `/proxy?u=${encodeURIComponent(u)}`);
    expect(out).toContain(`URI="/proxy?u=${encodeURIComponent("https://p.example/api/partner/s/init.mp4")}"`);
    expect(out).toContain(`URI="/proxy?u=${encodeURIComponent("https://p.example/api/partner/s/key1")}"`);
    expect(out).toContain(`/proxy?u=${encodeURIComponent("https://p.example/api/partner/s/seg0.m4s")}`);
    expect(out).toContain(`/proxy?u=${encodeURIComponent("https://p.example/api/partner/s/abc")}`);
    expect(out.split("\n")[3]).toBe("#EXTINF:2.0,");
  });
});
