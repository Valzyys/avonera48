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
import { readGrant, type AmEnv } from "../worker/am/authorization";
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
  actor = user,
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
    delete env.TMAIL_RESPONSE_MAP;
    const result = await call(`/accounts/${account}/sync`, "POST", {});
    expect(result.status).toBe(503);
    expect((await result.json()).error).toBe("inbox_adapter_required");
    expect(fetchMock).not.toHaveBeenCalled();
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
  });
});
