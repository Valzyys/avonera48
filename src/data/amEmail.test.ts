// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { emailDocument } from "../features/am/sanitize";
import { extractContent } from "../../worker/am/content";

describe("inert AM email rendering", () => {
  it("removes active HTML, navigation and remote images by default", () => {
    const result = emailDocument(
      '<script>alert(1)</script><form action="https://evil.example"><input></form><img src="https://tracker.example/pixel" onerror="alert(1)"><a href="https://login.example/auth?token=secret">Sign in</a><div style="background:url(https://tracker.example)">Hello</div>',
      false,
    );
    const doc = new DOMParser().parseFromString(result, "text/html");
    expect(
      doc.body.querySelector("script,form,input,img,[href],[onerror],[style]"),
    ).toBeNull();
    expect(doc.body.textContent).toContain("Hello");
    expect(doc.body.innerHTML).not.toContain("token=secret");
  });
  it("loads only explicit HTTPS images after opt-in", () => {
    const doc = new DOMParser().parseFromString(
      emailDocument(
        '<img src="https://image.example/a"><img src="data:image/png;base64,AAAA"><img src="http://image.example/a">',
        true,
      ),
      "text/html",
    );
    expect(doc.querySelectorAll("img")).toHaveLength(1);
    expect(doc.querySelector("img")?.getAttribute("referrerpolicy")).toBe(
      "no-referrer",
    );
  });
  it("finds encoded auth URLs and contextual OTPs without visiting them", () => {
    const result = extractContent(
      '<a href="https://login.example/auth?oobCode=secret&amp;mode=signIn">Continue</a><script>verification code 999999</script>',
      "Your verification code: 123456",
      "Alight Creative <mail@alightcreative.com>",
    );
    expect(result.otps).toEqual(["123456"]);
    expect(result.links[0].url).toContain("&mode=signIn");
    expect(
      extractContent(
        '<a href="https://short.example/abc123">Sign in to your account</a>',
        null,
        "Sender",
      ).links[0].authentication,
    ).toBe(true);
    expect(result.links[0].authentication).toBe(true);
    expect(result.alight_candidate).toBe(true);
  });
});
