import { afterEach, describe, expect, it, vi } from "vitest";
import { cancelPayment, checkPayment, createPayment, isV2Ref } from "../../worker/payment";

const env = { PAYMENT_V2_API_KEY: "GIV2-test", PAYMENT_V2_URL: "https://gw.test" };

function stub(body: unknown, status = 200) {
  const fn = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe("Gateway V2 payments", () => {
  it("creates a payment with the final amount and keeps the ref_id", async () => {
    const fn = stub({
      status: true,
      data: { ref_id: "GIV2-abc", trx_id: "GIV2-X1-0001", amount: 5000, unique_code: 123, final_amount: 5123, qr_image: "https://qr.test/a.png", expired_at: "2026-10-16T10:00:00.000Z" },
    });
    const r = await createPayment(env, 5000, "order123", { name: "Valzyy", email: "v@example.com", description: "Avonera48 · Pajama Drive" });
    expect(r.ok).toBe(true);
    expect(r.data).toEqual({ trx_id: "GIV2-abc", payment_token: "GIV2-X1-0001", amount: 5123, qr_image: "https://qr.test/a.png", payment_url: null, expired_at: "2026-10-16T10:00:00.000Z" });

    const [url, init] = fn.mock.calls[0];
    expect(url).toBe("https://gw.test/gateway/v2/payment/create");
    expect((init?.headers as Record<string, string>)["x-api-key"]).toBe("GIV2-test");
    expect(JSON.parse(String(init?.body))).toMatchObject({ amount: 5000, custom_trx_id: "order123", customer_name: "Valzyy", timeout_minutes: 30 });
  });

  it("reports a failed create", async () => {
    stub({ status: false, message: "API Key tidak valid" }, 401);
    const r = await createPayment(env, 5000, "order123");
    expect(r.ok).toBe(false);
    expect(r.message).toBe("API Key tidak valid");
  });

  it("maps the payment status", async () => {
    stub({ status: true, payment_status: "paid", ref_id: "GIV2-abc", data: { amount: 5123 } });
    expect((await checkPayment(env, "GIV2-abc")).data).toEqual({ status: "SUCCESS", amount: 5123 });
    stub({ status: true, payment_status: "pending", data: {} });
    expect((await checkPayment(env, "GIV2-abc")).data?.status).toBe("PENDING");
    stub({ status: true, payment_status: "expired", data: {} });
    expect((await checkPayment(env, "GIV2-abc")).data?.status).toBe("EXPIRED");
    stub({ status: true, payment_status: "something-new", data: {} });
    expect((await checkPayment(env, "GIV2-abc")).ok).toBe(false);
  });

  it("cancels with DELETE on the ref_id", async () => {
    const fn = stub({ status: true, message: "Pembayaran berhasil dibatalkan", ref_id: "GIV2-abc" });
    expect((await cancelPayment(env, "GIV2-abc")).data?.status).toBe("CANCELLED");
    expect(fn.mock.calls[0][0]).toBe("https://gw.test/gateway/v2/payment/cancel/GIV2-abc");
    expect(fn.mock.calls[0][1]?.method).toBe("DELETE");
  });

  it("sends older MYPG orders to MYPG", async () => {
    expect(isV2Ref("GIV2-abc")).toBe(true);
    expect(isV2Ref("TRX123")).toBe(false);
    const fn = stub({ status: true, data: { status: "SUCCESS" } });
    const r = await checkPayment({ ...env, MYPG_API_KEY: "m", MYPG_API_URL: "https://mypg.test" }, "TRX123");
    expect(r.data?.status).toBe("SUCCESS");
    expect(fn.mock.calls[0][0]).toBe("https://mypg.test?action=checkstatus");
  });
});
