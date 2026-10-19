import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { readFile } from "node:fs/promises";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { handleAm } from "../worker/am";
import { handleAuth } from "../worker/auth";
import { readGrant, receiptCodec, type AmEnv } from "../worker/am/authorization";
import { sha256 } from "../worker/http";

let mf: Miniflare;
let db: D1Database;
let kv: KVNamespace;
let fetchMock: ReturnType<typeof vi.fn>;
const user = { id: "owner" };
const stranger = { id: "stranger" };
const responseMap = JSON.stringify({
  inbox: {
    items: "/results",
    fields: {
      id: "/key",
      sender: "/from",
      subject: "/title",
      preview: "/snippet",
      received_at: "/time",
    },
  },
  message: {
    item: "/payload",
    fields: {
      id: "/key",
      sender: "/from",
      subject: "/title",
      received_at: "/time",
    },
    html: "/body",
    text: "/plain",
    raw: "/source",
  },
});
const apiContract = JSON.stringify({
  auth_header: "X-API-Key",
  auth_prefix: "",
  operations: {
    send: {
      body: { email: "email" },
      success: { path: "/confirmed", value: true },
    },
    verify: {
      body: { email: "email", link: "magic_link" },
      success: { path: "/confirmed", value: true },
      receipt: "/receipt",
    },
    apply: {
      body: { email: "email", proof: "receipt" },
      success: { path: "/confirmed", value: true },
    },
  },
});
let env: AmEnv & { DB: D1Database; AUTH: KVNamespace };
const date = "2026-10-19T10:00:00.000Z";
const link = "https://login.alightcreative.com/auth?token=very-private";
const detailPayload = (id: string) => ({
  payload: {
    key: id,
    from: "Alight Creative <sign-in@alightcreative.com>",
    title: "Verify account",
    time: date,
    body: `<p>Verification code 123456</p><a href="${link}">Sign in</a>`,
    plain: "Verification code 123456",
    source: "raw provider message",
  },
});
async function call(
  path: string,
  method = "GET",
  data?: unknown,
  actor: { id: string; isAdmin?: boolean } = user,
) {
  const request = new Request(`https://avonera.example/api/am${path}`, {
    method,
    headers: {
      origin: "https://avonera.example",
      ...(data === undefined ? {} : { "content-type": "application/json" }),
    },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  return handleAm(request, env, actor, new URL(request.url));
}
async function seed() {
  const account = crypto.randomUUID();
  const workflow = crypto.randomUUID();
  await db
    .prepare(
      "INSERT INTO am_accounts VALUES (?, 'owner', ?, 'bussiness.biz.id', 'ready', ?, ?)",
    )
    .bind(account, `${account}@bussiness.biz.id`, date, date)
    .run();
  await db
    .prepare(
      "INSERT INTO am_workflows(id,account_id,status,current_step,created_at,updated_at) VALUES (?,?,'awaiting_email','mailbox_created',?,?)",
    )
    .bind(workflow, account, date, date)
    .run();
  return { account, workflow };
}
const b64 = (value: Uint8Array) =>
  btoa(String.fromCharCode(...value))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
let issuerKey: CryptoKeyPair;
async function authorize(exp = Math.floor(Date.now() / 1000) + 3600) {
  const header = b64(
    new TextEncoder().encode(JSON.stringify({ alg: "RS256", typ: "JWT" })),
  );
  const payload = b64(
    new TextEncoder().encode(
      JSON.stringify({
        iss: "https://licensing.example",
        aud: "avonera48-am",
        provider: "https://www.amgratis.my.id/api/v1",
        exp,
        nbf: 0,
        reference: "test-only-grant",
        scopes: ["magiclink:send", "account:verify", "license:apply"],
        email_domains: ["bussiness.biz.id"],
        sender_domains: ["alightcreative.com"],
        magic_link_hosts: ["login.alightcreative.com"],
      }),
    ),
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      issuerKey.privateKey,
      new TextEncoder().encode(`${header}.${payload}`),
    ),
  );
  env.AM_AUTHORIZATION_PUBLIC_KEY = JSON.stringify(
    await crypto.subtle.exportKey("jwk", issuerKey.publicKey),
  );
  env.AM_AUTHORIZATION_GRANT = `${header}.${payload}.${b64(signature)}`;
  env.AM_AUTHORIZATION_ISSUER = "https://licensing.example";
}
beforeAll(async () => {
  mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: "export default { fetch() { return new Response('test'); } }",
      d1Databases: ["DB"],
      kvNamespaces: ["AUTH"],
    }),
  );
  db = (await mf.getD1Database("DB")) as unknown as D1Database;
  kv = (await mf.getKVNamespace("AUTH")) as unknown as KVNamespace;
  const sql = (
    await readFile(
      new URL("../migrations/0001_am_dashboard.sql", import.meta.url),
      "utf8",
    )
  ).replace(/^--.*$/gm, "");
  await db.batch(
    sql
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => db.prepare(s)),
  );
  issuerKey = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
}, 30000);
beforeEach(async () => {
  await db.batch([
    db.prepare("DELETE FROM am_accounts"),
    db.prepare("DELETE FROM am_rate_limits"),
  ]);
  env = {
    DB: db,
    AUTH: kv,
    TMAIL_RESPONSE_MAP: responseMap,
    AM_API_CONTRACT: apiContract,
    AM_API_KEY: "private-api-key",
    AM_WORKFLOW_SECRET: "a-secure-workflow-key-with-at-least-32-characters",
  };
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());
afterAll(async () => mf?.dispose());

describe("AM authenticated persistence", () => {
  it("derives private access from the existing server-side admin role", async () => {
    const token = "a".repeat(64);
    const email = "private-admin@example.com";
    await kv.put(`sess:${await sha256(token)}`, JSON.stringify({ email, createdAt: date }));
    const record = { id: "owner", email, name: "Owner", salt: "test", hash: "test", iterations: 1, createdAt: date };
    const request = new Request("https://avonera.example/api/am/status", { headers: { cookie: `avn_session=${token}` } });
    await kv.put(`user:${email}`, JSON.stringify({ ...record, role: "admin" }));
    expect((await (await handleAuth(request, env, new URL(request.url)))!.json()).private_admin).toBe(true);
    await kv.put(`user:${email}`, JSON.stringify(record));
    const regular = await (await handleAuth(request, env, new URL(request.url)))!.json();
    expect(regular.private_admin).toBe(false);
    expect(regular.actions.verify.ready).toBe(false);
  });
  it("requires the existing session and rejects cross-origin mutations", async () => {
    const request = new Request("https://avonera.example/api/am/accounts");
    expect((await handleAuth(request, env, new URL(request.url)))?.status).toBe(
      401,
    );
    const cross = new Request(request.url, {
      method: "POST",
      headers: {
        origin: "https://other.example",
        "content-type": "application/json",
      },
      body: "{}",
    });
    expect((await handleAm(cross, env, user, new URL(cross.url))).status).toBe(
      403,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("does not read or delete another user's mailbox or messages", async () => {
    const { account } = await seed();
    for (const [path, method] of [
      [`/accounts/${account}`, "GET"],
      [`/accounts/${account}`, "DELETE"],
      [`/accounts/${account}/sync`, "POST"],
      [`/accounts/${account}/messages/${crypto.randomUUID()}`, "GET"],
    ]) {
      expect(
        (await call(path, method, method === "GET" ? undefined : {}, stranger))
          .status,
      ).toBe(404);
    }
    expect(fetchMock).not.toHaveBeenCalled();
    expect(
      (await (await call("/accounts", "GET", undefined, stranger)).json())
        .items,
    ).toHaveLength(0);
  });
  it("uses only active domains and never invents preferred-domain availability", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({
        success: true,
        domains: [
          { name: "bussiness.biz.id", is_active: false },
          { name: "e-bisnis.my.id", is_active: true },
        ],
      }),
    );
    const res = await call("/accounts", "POST", {});
    expect(res.status).toBe(409);
    expect((await res.json()).domains).toEqual([
      { name: "e-bisnis.my.id", is_active: true },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("atomically limits concurrent generation and stores the confirmed random address", async () => {
    env.AM_MAX_ACCOUNTS = "1";
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/api/domains"))
        return Response.json({
          success: true,
          domains: [{ name: "bussiness.biz.id", is_active: true }],
        });
      const input = JSON.parse(String(init?.body));
      expect(input.username).toMatch(/^am_[0-9a-f]{32}$/);
      return Response.json({
        success: true,
        inbox: {
          address: `${input.username}@${input.domain}`,
          domain: input.domain,
          is_permanent: true,
        },
      });
    });
    const results = await Promise.all([
      call("/accounts", "POST", {}),
      call("/accounts", "POST", {}),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    const history = await (await call("/accounts")).json();
    expect(history.items).toHaveLength(1);
    expect(history.items[0].status).toBe("ready");
    expect(
      fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/generate")),
    ).toHaveLength(1);
  });
  it("applies generation limits before calling the provider", async () => {
    await db
      .prepare("INSERT INTO am_rate_limits VALUES('owner','generate',?,10)")
      .bind(Math.floor(Date.now() / 3600000) * 3600)
      .run();
    expect((await call("/accounts", "POST", {})).status).toBe(429);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("encodes addresses, deduplicates by provider ID, and preserves metadata across reloads", async () => {
    const { account } = await seed();
    const row = {
      key: "msg/with?punctuation",
      from: "Alight Creative",
      title: "Sign in",
      snippet: `${link} OTP 123456`,
      time: date,
    };
    fetchMock.mockImplementation(async () =>
      Response.json({ results: [row, row] }),
    );
    expect((await call(`/accounts/${account}/sync`, "POST", {})).status).toBe(
      200,
    );
    expect((await call(`/accounts/${account}/sync`, "POST", {})).status).toBe(
      200,
    );
    const list = await (await call(`/accounts/${account}/messages`)).json();
    expect(list.items).toHaveLength(1);
    expect(list.items[0].preview).not.toContain("very-private");
    expect(list.items[0].preview).not.toContain("123456");
    expect(fetchMock.mock.calls[0][0]).toContain("%40bussiness.biz.id");
    expect(
      (await (await call(`/accounts/${account}`)).json()).account.inbox_count,
    ).toBe(1);
  });
  it("returns explicit setup errors instead of inventing an inbox schema or empty success", async () => {
    const { account } = await seed();
    env.TMAIL_RESPONSE_MAP = "{}";
    const result = await call(`/accounts/${account}/sync`, "POST", {});
    expect(result.status).toBe(503);
    expect((await result.json()).error).toBe("inbox_adapter_required");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("syncs the supplied TmailCloud format and reads full messages without a custom mapping", async () => {
    const { account } = await seed();
    delete env.TMAIL_RESPONSE_MAP;
    const status = await (await call("/status")).json();
    expect(status.inbox_adapter).toBe(true);
    expect(status.detail_adapter).toBe(true);
    // Synthetic content in the real supplied shape; never retain live login tokens.
    const row = {
      id: "msg_example", sender: "noreply@alight-creative.firebaseapp.com",
      subject: "Sign in to Alight Creative requested at 2026 October 19 03:20 UTC",
      body_text: "We received a request to sign in to Alight Creative at 2026 October 19.",
      body_html: "<p>Hello</p><a href='https://alight-creative.firebaseapp.com/__/auth/links?link=https%3A%2F%2Falightcreative.com%2Fauth_action%2F%3Fmode%3DsignIn%26oobCode%3Dtest-only'>Sign in to Alight Creative</a>",
      verification_code: "2026", created_at: 1792380020557, is_read: false,
    };
    fetchMock.mockImplementation(async (url) => Response.json(
      String(url).includes("/inbox/")
        ? { success: true, total: 2, count: 2, messages: [row, { ...row, id: "msg_older", created_at: 1792379746756 }] }
        : { success: true, message: row },
    ));
    for (let attempt = 0; attempt < 2; attempt++)
      expect((await call(`/accounts/${account}/sync`, "POST", {})).status).toBe(200);
    const list = await (await call(`/accounts/${account}/messages`)).json();
    expect(list.items).toHaveLength(2);
    expect(list.items[0].received_at).toBe(new Date(row.created_at).toISOString());
    const detail = await (await call(`/accounts/${account}/messages/${list.items[0].id}`)).json();
    expect(detail.message.html).toBe(row.body_html);
    expect(detail.message.text).toBe(row.body_text);
    expect(detail.message.raw).toBeNull();
    expect(detail.message.otps).toEqual([]);
    expect(detail.message.alight_candidate).toBe(true);
    expect(detail.message.links).toHaveLength(1);
    expect(detail.message.links[0].authentication).toBe(true);
    const saved = await (await call(`/accounts/${account}`)).json();
    expect(saved.account.inbox_count).toBe(2);
    expect(saved.workflows[0].current_step).toBe("email_received");
    expect(JSON.stringify(saved)).not.toContain("test-only");
    fetchMock.mockResolvedValueOnce(Response.json({ success: false, messages: [] }));
    expect((await call(`/accounts/${account}/sync`, "POST", {})).status).toBe(502);
  });
  it("paginates account history deterministically and deletes only owned history", async () => {
    const first = await seed();
    await seed();
    await seed();
    const page1 = await (await call("/accounts?limit=2")).json();
    const page2 = await (
      await call(
        `/accounts?limit=2&cursor=${encodeURIComponent(page1.next_cursor)}`,
      )
    ).json();
    expect(
      new Set([...page1.items, ...page2.items].map((a: { id: string }) => a.id))
        .size,
    ).toBe(3);
    expect(page2.next_cursor).toBeNull();
    expect(
      (await call(`/accounts/${first.account}`, "DELETE", {})).status,
    ).toBe(200);
    expect((await call(`/accounts/${first.account}`)).status).toBe(404);
    expect(
      (
        await db
          .prepare("SELECT status FROM am_accounts WHERE id=?")
          .bind(first.account)
          .first()
      )?.status,
    ).toBe("deleted");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("AM approved workflows", () => {
  it("uses separate step budgets and does not charge invalid workflow states", async () => {
    const { account, workflow } = await seed();
    const window = Math.floor(Date.now() / 3600000) * 3600;
    await db.prepare("INSERT INTO am_rate_limits VALUES ('owner','workflow',?,10)").bind(window).run();
    await db.prepare("INSERT INTO am_rate_limits VALUES ('owner','workflow_verify',?,10)").bind(window).run();
    fetchMock.mockResolvedValueOnce(Response.json({ confirmed: true }));
    const path = `/accounts/${account}/workflows/${workflow}/send`;
    expect((await call(path, "POST", { consent: true, owns_account: true })).status).toBe(200);
    await db.prepare("UPDATE am_workflows SET status='completed' WHERE id=?").bind(workflow).run();
    expect((await call(path, "POST", { consent: true, owns_account: true })).status).toBe(409);
    expect((await db.prepare("SELECT hits FROM am_rate_limits WHERE user_id='owner' AND action='workflow_send' AND window_start=?").bind(window).first())?.hits).toBe(1);
    await db.prepare("UPDATE am_workflows SET status='awaiting_email' WHERE id=?").bind(workflow).run();
    await db.prepare("UPDATE am_rate_limits SET hits=10 WHERE action='workflow_send'").run();
    const limited = await call(path, "POST", { consent: true, owns_account: true });
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
    expect((await limited.json()).message).toContain("Avonera48");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("keeps confirmed verification available when the provider rate-limits activation", async () => {
    const { account, workflow } = await seed();
    const token = await (await receiptCodec(env, workflow)).seal("test-session");
    await db.prepare("UPDATE am_workflows SET status='verified',current_step='verify_confirmed',provider_receipt=? WHERE id=?").bind(token, workflow).run();
    fetchMock.mockResolvedValueOnce(Response.json({}, { status: 429, headers: { "retry-after": "120" } }));
    const response = await call(`/accounts/${account}/workflows/${workflow}/apply`, "POST", { consent: true, owns_account: true }, { ...user, isAdmin: true });
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("120");
    expect((await response.json()).retry_after).toBe(120);
    expect((await db.prepare("SELECT status,current_step FROM am_workflows WHERE id=?").bind(workflow).first())).toMatchObject({ status: "verified", current_step: "verify_confirmed" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("allows a private admin to verify and apply in sequence without a signed grant", async () => {
    const { account, workflow } = await seed();
    const admin = { ...user, isAdmin: true };
    const status = await (await call("/status", "GET", undefined, admin)).json();
    expect(status.private_admin).toBe(true);
    expect(status.actions.verify.ready).toBe(true);
    expect(status.actions.apply.ready).toBe(true);
    const id = crypto.randomUUID();
    await db.prepare("INSERT INTO am_messages(id,account_id,provider_message_id,sender,subject,preview,received_at) VALUES(?,?,?,'Alight Creative','Sign in','',?)")
      .bind(id, account, "private-message", date).run();
    const inner = "https://alightcreative.com/auth_action/?mode=signIn&oobCode=test-only";
    const wrapper = `https://alight-creative.firebaseapp.com/__/auth/links?link=${encodeURIComponent(inner)}`;
    fetchMock.mockImplementation(async (url) => {
      if (String(url).includes("/api/email/message/")) {
        const payload = detailPayload("private-message");
        payload.payload.from = "noreply@alight-creative.firebaseapp.com";
        payload.payload.body = `<a href="${wrapper}">Sign in to Alight Creative</a>`;
        return Response.json(payload);
      }
      if (String(url).endsWith("/verify-account")) return Response.json({ confirmed: true, receipt: "private-session-token" });
      return Response.json({ confirmed: true });
    });
    const path = `/accounts/${account}/workflows/${workflow}/verify-and-apply`;
    expect((await call(path, "POST", { isAdmin: true })).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
    expect((await call(path, "POST", {}, admin)).status).toBe(200);
    const writes = fetchMock.mock.calls.filter(([url]) => String(url).includes("amgratis.my.id"));
    expect(writes.map(([url]) => url)).toEqual([
      "https://www.amgratis.my.id/api/v1/verify-account",
      "https://www.amgratis.my.id/api/v1/apply-premium",
    ]);
    expect(JSON.parse(writes[1][1].body).proof).toBe("private-session-token");
    expect(JSON.parse(writes[0][1].body).link).toBe(inner);
    expect(fetchMock.mock.calls.some(([url]) => url === link)).toBe(false);
    const row = await db.prepare("SELECT status,provider_receipt FROM am_workflows WHERE id=?").bind(workflow).first();
    expect(row?.status).toBe("completed");
    expect(row?.provider_receipt).not.toContain("private-session-token");
    expect((await call(path, "POST", {}, admin)).status).toBe(409);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes("amgratis.my.id"))).toHaveLength(2);
  });
  it("recovers a declined verification with a fresh email and excludes old messages", async () => {
    const { account, workflow } = await seed();
    const admin = { ...user, isAdmin: true };
    await db.prepare("INSERT INTO am_messages(id,account_id,provider_message_id,sender,subject,preview,received_at) VALUES(?,?,?,'Alight Creative','Sign in','',?)")
      .bind(crypto.randomUUID(), account, "old-message", new Date(Date.now() - 3600000).toISOString()).run();
    fetchMock.mockImplementation(async (url) => Response.json(
      String(url).includes("/api/email/message/") ? detailPayload("old-message") : { success: false },
    ));
    const path = `/accounts/${account}/workflows/${workflow}`;
    expect((await call(`${path}/verify-and-apply`, "POST", {}, admin)).status).toBe(422);
    expect((await db.prepare("SELECT status FROM am_workflows WHERE id=?").bind(workflow).first())?.status).toBe("failed");
    fetchMock.mockResolvedValueOnce(Response.json({ confirmed: true }));
    expect((await call(`${path}/send`, "POST", { consent: true, owns_account: true }, admin)).status).toBe(200);
    const before = fetchMock.mock.calls.length;
    const waiting = await call(`${path}/verify-and-apply`, "POST", {}, admin);
    expect(waiting.status).toBe(409);
    expect((await waiting.json()).error).toBe("magic_link_missing");
    expect(fetchMock).toHaveBeenCalledTimes(before);
    await db.prepare("UPDATE am_workflows SET status='uncertain',current_step='verify',updated_at=? WHERE id=?")
      .bind(new Date(Date.now() - 61000).toISOString(), workflow).run();
    fetchMock.mockResolvedValueOnce(Response.json({ confirmed: true }));
    expect((await call(`${path}/send`, "POST", { consent: true, owns_account: true, acknowledge_resend: true }, admin)).status).toBe(200);
  });
  it("stops private activation after a failed verification and never replays an uncertain token exchange", async () => {
    const { account, workflow } = await seed();
    const admin = { ...user, isAdmin: true };
    await db.prepare("INSERT INTO am_messages(id,account_id,provider_message_id,sender,subject,preview,received_at) VALUES(?,?,?,'Alight Creative','Sign in','',?)")
      .bind(crypto.randomUUID(), account, "private-message", date).run();
    fetchMock.mockImplementation(async (url) => Response.json(
      String(url).includes("/api/email/message/") ? detailPayload("private-message") : { confirmed: false },
    ));
    const path = `/accounts/${account}/workflows/${workflow}/verify-and-apply`;
    expect((await call(path, "POST", {}, admin)).status).toBe(502);
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith("/apply-premium"))).toBe(false);
    expect((await call(path, "POST", {}, admin)).status).toBe(409);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/verify-account"))).toHaveLength(1);
  });
  it("refuses private verification of another user's account or an untrusted sender", async () => {
    const { account, workflow } = await seed();
    const path = `/accounts/${account}/workflows/${workflow}/verify-and-apply`;
    expect((await call(path, "POST", {}, { ...stranger, isAdmin: true })).status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
    await db.prepare("INSERT INTO am_messages(id,account_id,provider_message_id,sender,subject,preview,received_at) VALUES(?,?,?,'Sender','Sign in','',?)")
      .bind(crypto.randomUUID(), account, "untrusted", date).run();
    const payload = detailPayload("untrusted");
    payload.payload.from = "attacker@example.com";
    fetchMock.mockResolvedValue(Response.json(payload));
    expect((await call(path, "POST", {}, { ...user, isAdmin: true })).status).toBe(409);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("amgratis.my.id"))).toBe(false);
  });
  it("rejects absent, expired and forged authorization", async () => {
    const { account, workflow } = await seed();
    expect(
      (
        await call(
          `/accounts/${account}/workflows/${workflow}/verify`,
          "POST",
          {
            consent: true,
            owns_account: true,
            message_id: crypto.randomUUID(),
            link_sha256: "a".repeat(64),
          },
        )
      ).status,
    ).toBe(403);
    await authorize(1);
    await expect(readGrant(env)).rejects.toThrow();
    await authorize();
    env.AM_AUTHORIZATION_GRANT =
      env.AM_AUTHORIZATION_GRANT!.slice(0, -10) + "XXXXXXXXXX";
    await expect(readGrant(env)).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("allows a consented magic-link email for an owned mailbox without unlocking authentication or licensing", async () => {
    const { account, workflow } = await seed();
    delete env.AM_WORKFLOW_SECRET;
    const full = JSON.parse(apiContract);
    env.AM_API_CONTRACT = JSON.stringify({
      ...full,
      operations: { send: full.operations.send },
    });
    const status = await (await call("/status")).json();
    expect(status.authorization.valid).toBe(false);
    expect(status.actions.send.ready).toBe(true);
    expect(status.actions.verify.ready).toBe(false);
    expect(status.actions.apply.ready).toBe(false);
    fetchMock.mockResolvedValueOnce(Response.json({ confirmed: true }));
    const result = await call(
      `/accounts/${account}/workflows/${workflow}/send`,
      "POST",
      { consent: true, owns_account: true },
    );
    expect(result.status).toBe(200);
    expect((await result.json()).status).toBe("awaiting_approval");
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://www.amgratis.my.id/api/v1/send-magiclink",
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).email).toContain(
      "@bussiness.biz.id",
    );
    expect(
      (
        await call(
          `/accounts/${account}/workflows/${workflow}/verify`,
          "POST",
          {
            consent: true,
            owns_account: true,
            message_id: crypto.randomUUID(),
            link_sha256: "a".repeat(64),
          },
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await call(`/accounts/${account}/workflows/${workflow}/apply`, "POST", {
          consent: true,
          owns_account: true,
        })
      ).status,
    ).toBe(403);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("uses the documented magic-link format without an environment mapping", async () => {
    delete env.AM_API_CONTRACT;
    const { account, workflow } = await seed();
    let status = await (await call("/status")).json();
    expect(status.actions.send.ready).toBe(true);
    expect(status.actions.verify.ready).toBe(false);
    expect(status.actions.apply.ready).toBe(false);
    fetchMock.mockResolvedValueOnce(Response.json({ success: true }));
    expect((await call(
      `/accounts/${account}/workflows/${workflow}/send`, "POST",
      { consent: true, owns_account: true },
    )).status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://www.amgratis.my.id/api/v1/send-magiclink");
    expect(new Headers(init.headers).get("x-api-key")).toBe(env.AM_API_KEY);
    expect(Object.keys(JSON.parse(init.body))).toEqual(["email"]);
    env.AM_API_CONTRACT = "invalid";
    status = await (await call("/status")).json();
    expect(status.actions.send.reason).toContain("format has not been configured");
    expect(status.actions.send.ready).toBe(false);
    delete env.AM_API_KEY;
    status = await (await call("/status")).json();
    expect(status.actions.send.reason).toContain(
      "credential is not configured",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("requires step-specific consent and never opens a magic link automatically", async () => {
    const { account, workflow } = await seed();
    await authorize();
    expect(
      (
        await call(`/accounts/${account}/workflows/${workflow}/send`, "POST", {
          owns_account: true,
        })
      ).status,
    ).toBe(400);
    const id = crypto.randomUUID();
    await db
      .prepare(
        "INSERT INTO am_messages VALUES(?,?,?,'Alight Creative','Subject','',?)",
      )
      .bind(id, account, "provider_1", date)
      .run();
    fetchMock
      .mockResolvedValueOnce(Response.json(detailPayload("provider_1")))
      .mockResolvedValueOnce(
        Response.json({ confirmed: true, receipt: "verified-proof" }),
      );
    const result = await call(
      `/accounts/${account}/workflows/${workflow}/verify`,
      "POST",
      {
        consent: true,
        owns_account: true,
        message_id: id,
        link_sha256: await sha256(link),
      },
    );
    expect(result.status).toBe(200);
    expect((await result.json()).status).toBe("verified");
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "https://tmailcloud.my.id/api/email/message/provider_1",
      "https://www.amgratis.my.id/api/v1/verify-account",
    ]);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).link).toBe(link);
    const stored = await db
      .prepare("SELECT * FROM am_workflows WHERE id=?")
      .bind(workflow)
      .first();
    expect(JSON.stringify(stored)).not.toContain("verified-proof");
    expect(JSON.stringify(stored)).not.toContain("very-private");
    const accountView = await (await call(`/accounts/${account}`)).json();
    expect(JSON.stringify(accountView)).not.toContain("provider_receipt");
    fetchMock.mockResolvedValueOnce(Response.json({ confirmed: true }));
    expect(
      (
        await call(`/accounts/${account}/workflows/${workflow}/apply`, "POST", {
          consent: true,
          owns_account: true,
        })
      ).status,
    ).toBe(200);
    expect(JSON.parse(fetchMock.mock.calls[2][1].body).proof).toBe(
      "verified-proof",
    );
    expect(
      (
        await call(`/accounts/${account}/workflows/${workflow}/apply`, "POST", {
          consent: true,
          owns_account: true,
        })
      ).status,
    ).toBe(409);
  });
  it("blocks a simultaneous workflow and deletion while a provider operation is running", async () => {
    const { account, workflow } = await seed();
    await authorize();
    let complete: ((value: Response) => void) | undefined;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          complete = resolve;
        }),
    );
    const first = call(
      `/accounts/${account}/workflows/${workflow}/send`,
      "POST",
      { consent: true, owns_account: true },
    );
    await vi.waitFor(() => expect(complete).toBeDefined());
    expect(
      (
        await call(`/accounts/${account}/workflows/${workflow}/send`, "POST", {
          consent: true,
          owns_account: true,
        })
      ).status,
    ).toBe(409);
    expect((await call(`/accounts/${account}`, "DELETE", {})).status).toBe(409);
    complete!(Response.json({ confirmed: true }));
    expect((await first).status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("rejects an unreviewed URL without contacting the authentication provider", async () => {
    const { account, workflow } = await seed();
    await authorize();
    const id = crypto.randomUUID();
    await db
      .prepare(
        "INSERT INTO am_messages VALUES(?,?,?,'Alight Creative','Subject','',?)",
      )
      .bind(id, account, "provider_1", date)
      .run();
    fetchMock.mockResolvedValueOnce(Response.json(detailPayload("provider_1")));
    expect(
      (
        await call(
          `/accounts/${account}/workflows/${workflow}/verify`,
          "POST",
          {
            consent: true,
            owns_account: true,
            message_id: id,
            link_sha256: await sha256(`${link}-different`),
          },
        )
      ).status,
    ).toBe(409);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not claim success for an ambiguous provider write or automatically retry it", async () => {
    const { account, workflow } = await seed();
    await authorize();
    fetchMock.mockRejectedValueOnce(
      new Error("network failure with sensitive provider data"),
    );
    expect(
      (
        await call(`/accounts/${account}/workflows/${workflow}/send`, "POST", {
          consent: true,
          owns_account: true,
        })
      ).status,
    ).toBe(502);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const row = await db
      .prepare("SELECT status,error_message FROM am_workflows WHERE id=?")
      .bind(workflow)
      .first();
    expect(row?.status).toBe("uncertain");
    expect(row?.error_message).not.toContain("sensitive");
    expect(row?.error_message).toContain("provider_unreachable");
    expect(row?.error_message).toContain("Check your inbox first");
    const path = `/accounts/${account}/workflows/${workflow}/send`;
    expect((await call(path, "POST", {
      consent: true, owns_account: true,
    })).status).toBe(400);
    expect((await call(path, "POST", {
      consent: true, owns_account: true, acknowledge_resend: true,
    })).status).toBe(429);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await db.prepare("UPDATE am_workflows SET updated_at=? WHERE id=?")
      .bind(new Date(Date.now() - 61000).toISOString(), workflow).run();
    fetchMock.mockResolvedValueOnce(Response.json({ confirmed: true }));
    expect((await call(path, "POST", {
      consent: true, owns_account: true, acknowledge_resend: true,
    })).status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((await db.prepare("SELECT status FROM am_workflows WHERE id=?")
      .bind(workflow).first())?.status).toBe("awaiting_approval");
    await db.prepare("UPDATE am_workflows SET status='uncertain',current_step='apply' WHERE id=?")
      .bind(workflow).run();
    expect((await call(path, "POST", {
      consent: true, owns_account: true, acknowledge_resend: true,
    })).status).toBe(409);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
