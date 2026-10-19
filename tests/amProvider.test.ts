import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { amRequest, domains, providerRequest } from "../worker/am/providers";
import { amContract } from "../worker/am/contracts";
import { privateLinkPolicy, verificationLink } from "../worker/am/authorization";
let mocked: ReturnType<typeof vi.fn>;
const supplied = {
  success: true,
  domains: [
    {
      id: "1",
      name: "tmailcloud.my.id",
      is_active: true,
      is_default: true,
      records_ready: true,
    },
    {
      id: "2",
      name: "tmailcloud.biz.id",
      is_active: true,
      is_default: false,
      records_ready: true,
    },
    {
      id: "3",
      name: "e-bisnis.my.id",
      is_active: true,
      is_default: false,
      records_ready: true,
    },
    {
      id: "4",
      name: "bussiness.biz.id",
      is_active: true,
      is_default: false,
      records_ready: true,
    },
  ],
};
beforeEach(() => {
  vi.useFakeTimers();
  mocked = vi.fn();
  vi.stubGlobal("fetch", mocked);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe("AM provider transport", () => {
  it("accepts the actual nested activation response only for a valid linked account", async () => {
    const applied = {
      success: true, email: "owner@example.com",
      data: { success: true, result: {
        status: "success", accountLinkStatus: "linked-current", source: "cache",
        valid: true, autoRenewing: true, expiryTimeMillis: 1814627568734,
      } },
    };
    const activate = () => amRequest("apply", amContract(), "test-key", { email: "owner@example.com", receipt: "test-session" });
    mocked.mockResolvedValueOnce(Response.json(applied));
    expect(await activate()).toEqual({ receipt: null });
    for (const response of [
      { ...applied, data: { ...applied.data, success: false } },
      { ...applied, data: { ...applied.data, result: { ...applied.data.result, valid: false } } },
      { ...applied, data: { ...applied.data, result: { ...applied.data.result, status: "pending" } } },
      { ...applied, data: { ...applied.data, result: { ...applied.data.result, accountLinkStatus: "unlinked" } } },
      { success: true, message: "Premium activation applied successfully." },
    ]) {
      mocked.mockResolvedValueOnce(Response.json(response));
      await expect(activate()).rejects.toMatchObject({ code: "provider_unsuccessful" });
    }
    mocked.mockResolvedValueOnce(Response.json({ ...applied, email: "someone-else@example.com" }));
    await expect(activate()).rejects.toMatchObject({ code: "provider_account_mismatch" });
    mocked.mockResolvedValueOnce(Response.json({ ...applied, success: false }));
    await expect(activate()).rejects.toMatchObject({ code: "provider_declined" });
  });
  it("unwraps the real Firebase link format without changing nested login parameters", () => {
    const inner = "https://alightcreative.com/auth_action/?apiKey=test-only&mode=signIn&oobCode=test-only&continueUrl=https://alightcreative.com?ui_sid%3Dtest%26ui_sd%3D0&lang=en";
    const sender = "noreply@alight-creative.firebaseapp.com";
    const wrapped = `https://alight-creative.firebaseapp.com/__/auth/links?link=${encodeURIComponent(inner)}`;
    expect(verificationLink(wrapped, sender, privateLinkPolicy)).toBe(inner);
    for (const nested of ["https://evil.example/auth_action/?oobCode=test", "http://alightcreative.com/auth_action/", "https://user:password@alightcreative.com/auth_action/", "https://alightcreative.com/redirect"]) {
      expect(() => verificationLink(`https://alight-creative.firebaseapp.com/__/auth/links?link=${encodeURIComponent(nested)}`, sender, privateLinkPolicy)).toThrow();
    }
    expect(() => verificationLink(wrapped + "&link=" + encodeURIComponent(inner), sender, privateLinkPolicy)).toThrow();
    expect(mocked).not.toHaveBeenCalled();
  });
  it("identifies explicit provider refusal and its stage without exposing response secrets", async () => {
    mocked.mockResolvedValueOnce(Response.json({ success: false, message: "sensitive-provider-message", idToken: "sensitive-token" }));
    await expect(amRequest("verify", amContract(), "test-key", {
      email: "owner@example.com", magic_link: "https://alightcreative.com/auth_action/?oobCode=test",
    })).rejects.toMatchObject({ status: 422, code: "provider_declined", diagnostic: { operation: "verify" }, message: expect.not.stringContaining("sensitive") });
    mocked.mockResolvedValueOnce(Response.json({ success: true, status: "pending" }));
    await expect(amRequest("apply", amContract(), "test-key", { email: "owner@example.com", receipt: "test" })).rejects.toMatchObject({ code: "provider_unsuccessful", diagnostic: { operation: "apply" } });
  });
  it("maps documented verification and activation fields and requires confirmed results", async () => {
    const contract = amContract();
    mocked.mockResolvedValueOnce(Response.json({ success: true, idToken: "test-session" }));
    expect(await amRequest("verify", contract, "test-key", {
      email: "owner@example.com", magic_link: "https://alightcreative.com/auth/action?test=1",
    })).toEqual({ receipt: "test-session" });
    expect(JSON.parse(mocked.mock.calls[0][1].body)).toEqual({
      email: "owner@example.com", rawLink: "https://alightcreative.com/auth/action?test=1",
    });
    mocked.mockResolvedValueOnce(Response.json({ success: true, status: "active" }));
    await amRequest("apply", contract, "test-key", { email: "owner@example.com", receipt: "test-session" });
    expect(JSON.parse(mocked.mock.calls[1][1].body)).toEqual({ email: "owner@example.com", idToken: "test-session" });
    mocked.mockResolvedValueOnce(Response.json({ success: true, status: "pending" }));
    await expect(amRequest("apply", contract, "test-key", { email: "owner@example.com", receipt: "test-session" })).rejects.toMatchObject({ code: "provider_unsuccessful" });
    mocked.mockResolvedValueOnce(Response.json({ success: true }));
    await expect(amRequest("verify", contract, "test-key", { email: "owner@example.com", magic_link: "https://alightcreative.com/auth/action?test=1" })).rejects.toMatchObject({ code: "provider_shape_changed" });
  });
  it("accepts the actual supplied domain response", async () => {
    mocked.mockResolvedValueOnce(Response.json(supplied));
    expect((await domains()).map((d) => d.name)).toEqual(
      supplied.domains.map((d) => d.name),
    );
  });
  it("follows real GET redirects to the provider's own HTTPS hosts", async () => {
    mocked
      .mockResolvedValueOnce(
        new Response(null, {
          status: 301,
          headers: { location: "https://www.tmailcloud.my.id/api/domains" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(null, {
          status: 307,
          headers: { location: "/api/domains/?v=1" },
        }),
      )
      .mockResolvedValueOnce(Response.json(supplied));
    expect(await providerRequest("mail", "/api/domains")).toEqual(supplied);
    expect(mocked.mock.calls.map(([url]) => url)).toEqual([
      "https://tmailcloud.my.id/api/domains",
      "https://www.tmailcloud.my.id/api/domains",
      "https://www.tmailcloud.my.id/api/domains/?v=1",
    ]);
    expect(
      mocked.mock.calls.every(([, init]) => init.redirect === "manual"),
    ).toBe(true);
  });
  it.each([
    "https://other.example/api/domains",
    "http://tmailcloud.my.id/api/domains",
    "https://secret@tmailcloud.my.id/api/domains",
    "https://tmailcloud.my.id:444/api/domains",
  ])("refuses unsafe redirect %s", async (location) => {
    mocked.mockResolvedValueOnce(
      new Response(null, { status: 302, headers: { location } }),
    );
    await expect(providerRequest("mail", "/api/domains")).rejects.toMatchObject(
      { code: "provider_redirect_blocked" },
    );
    expect(mocked).toHaveBeenCalledTimes(1);
  });
  it("bounds redirect loops without restarting the chain", async () => {
    mocked.mockImplementation(
      async () =>
        new Response(null, {
          status: 302,
          headers: { location: "/api/domains" },
        }),
    );
    await expect(providerRequest("mail", "/api/domains")).rejects.toMatchObject(
      { code: "provider_redirect_invalid" },
    );
    expect(mocked).toHaveBeenCalledTimes(4);
  });
  it.each(["mail", "am"] as const)(
    "does not replay %s writes across redirects",
    async (service) => {
      mocked.mockResolvedValueOnce(
        new Response(null, {
          status: 307,
          headers: { location: "https://www.tmailcloud.my.id/collect" },
        }),
      );
      await expect(
        providerRequest(service, "/send-magiclink", {
          method: "POST",
          headers: { "X-API-Key": "private" },
          body: "private-body",
        }),
      ).rejects.toMatchObject({ code: "provider_write_redirect" });
      expect(mocked).toHaveBeenCalledTimes(1);
    },
  );
  it("does not imply a write happened when a GET cannot connect", async () => {
    mocked.mockRejectedValue(
      new TypeError("fetch failed for https://tmailcloud.my.id/private-id"),
    );
    const result = providerRequest("mail", "/api/domains").catch(
      (e: unknown) => e,
    );
    await vi.runAllTimersAsync();
    const error = (await result) as Error;
    expect(error).toMatchObject({
      code: "provider_unreachable",
      diagnostic: { method: "GET", failure: "network" },
    });
    expect(error.message).not.toMatch(/write|accepted|private-id/);
    expect(mocked).toHaveBeenCalledTimes(3);
  });
  it("reports DNS transport codes without leaking exception messages", async () => {
    mocked.mockRejectedValue(
      new TypeError("secret-token", { cause: { code: "ENOTFOUND" } }),
    );
    const result = providerRequest("mail", "/api/domains").catch(
      (e: unknown) => e,
    );
    await vi.runAllTimersAsync();
    const error = await result;
    expect(error).toMatchObject({
      code: "provider_dns_failed",
      diagnostic: { transport_code: "ENOTFOUND" },
    });
    expect(JSON.stringify(error)).not.toContain("secret-token");
  });
  it("reports timeout separately", async () => {
    mocked.mockRejectedValue(new DOMException("Timed out", "TimeoutError"));
    const result = providerRequest("mail", "/api/domains").catch(
      (e: unknown) => e,
    );
    await vi.runAllTimersAsync();
    expect(await result).toMatchObject({
      status: 504,
      code: "provider_timeout",
    });
  });
  it("retains HTTP rejection status in sanitized diagnostics", async () => {
    mocked.mockResolvedValueOnce(new Response("private-body", { status: 403 }));
    await expect(providerRequest("mail", "/api/domains")).rejects.toMatchObject(
      { code: "provider_rejected", diagnostic: { upstream_status: 403 } },
    );
  });
});
