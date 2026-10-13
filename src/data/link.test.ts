import { describe, expect, it } from "vitest";
import { readMembership, sign, verified } from "../../worker/linkSign";

const SECRET = "test_secret";
const NOW = Date.parse("2026-10-13T12:00:00Z");

async function signed(payload: unknown, ts = Math.floor(NOW / 1000), secret = SECRET) {
  const raw = JSON.stringify(payload);
  return new Request("https://avonera48.test/api/integrations/jkt48connect/status", {
    method: "POST",
    headers: { "content-type": "application/json", "x-avonera-timestamp": String(ts), "x-avonera-signature": await sign(secret, String(ts), raw) },
    body: raw,
  });
}

describe("JKT48Connect link signatures", () => {
  it("accepts a fresh request signed with the shared secret", async () => {
    expect(await verified(await signed({ account_id: "a1" }), SECRET, NOW)).toEqual({ account_id: "a1" });
  });

  it("refuses a wrong secret, a stale clock or a tampered body", async () => {
    expect(await verified(await signed({ account_id: "a1" }, undefined, "other"), SECRET, NOW)).toBeNull();
    expect(await verified(await signed({ account_id: "a1" }, Math.floor(NOW / 1000) - 600), SECRET, NOW)).toBeNull();
    const ok = await signed({ account_id: "a1" });
    const tampered = new Request(ok.url, { method: "POST", headers: ok.headers, body: JSON.stringify({ account_id: "a2" }) });
    expect(await verified(tampered, SECRET, NOW)).toBeNull();
    expect(await verified(new Request(ok.url, { method: "POST", body: "{}" }), SECRET, NOW)).toBeNull();
  });
});

describe("mirrored membership", () => {
  it("keeps only a membership that is still running", () => {
    expect(readMembership({ plan_name: "Premium", plan_id: "p", expires_at: "2026-12-01T00:00:00Z" }, NOW)).toEqual({
      plan_id: "p",
      plan_name: "Premium",
      expires_at: "2026-12-01T00:00:00.000Z",
    });
    expect(readMembership({ plan_name: "Old", expires_at: "2026-10-01T00:00:00Z" }, NOW)).toBeNull();
    expect(readMembership({ plan_name: "Bad", expires_at: "soon" }, NOW)).toBeNull();
    expect(readMembership(null, NOW)).toBeNull();
    expect(readMembership({ expires_at: "2027-01-01" }, NOW)?.plan_name).toBe("JKT48Connect membership");
  });
});
