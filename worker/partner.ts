/**
 * Theater room video through the upstream partner API. All signed calls
 * happen here, server side. The site Worker also proxies playback and media;
 * the browser only receives encrypted same-origin media references.
 *
 * Secrets (never in the repo):
 *   PARTNER_KEY_ID     key id
 *   PARTNER_SECRET     signing secret
 *   PARTNER_SERVER_IP  the server IP registered with the partner dashboard
 *
 * Signing: subkey = HMAC(secret, "YYYY-MM-DD|keyId|serverIp") per UTC day,
 * signature = HMAC(subkey bytes, "ts:nonce:METHOD:path:sha256(body)").
 */

export interface PartnerEnv {
  PARTNER_KEY_ID?: string;
  PARTNER_SECRET?: string;
  PARTNER_SERVER_IP?: string;
}

const UPSTREAM = "https://jkt48connect.com";
const enc = new TextEncoder();
const hex = (buf: ArrayBuffer | Uint8Array) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const fromHex = (h: string) => new Uint8Array(h.match(/../g)!.map((x) => parseInt(x, 16)));

async function hmac(key: Uint8Array, msg: string) {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", k, enc.encode(msg)));
}

export const partnerReady = (env: PartnerEnv) => !!(env.PARTNER_KEY_ID && env.PARTNER_SECRET && env.PARTNER_SERVER_IP);

async function signedHeaders(env: PartnerEnv, method: string, path: string, body: string) {
  const day = new Date().toISOString().slice(0, 10);
  const subkey = await hmac(enc.encode(env.PARTNER_SECRET!), `${day}|${env.PARTNER_KEY_ID}|${env.PARTNER_SERVER_IP}`);
  const ts = String(Math.floor(Date.now() / 1000));
  const nonce = hex(crypto.getRandomValues(new Uint8Array(16)));
  const bodyHash = hex(await crypto.subtle.digest("SHA-256", enc.encode(body)));
  const signature = await hmac(fromHex(subkey), `${ts}:${nonce}:${method}:${path}:${bodyHash}`);
  return {
    "X-Partner-Key": env.PARTNER_KEY_ID!,
    "X-Timestamp": ts,
    "X-Nonce": nonce,
    "X-Signature": signature,
    "content-type": "application/json",
    accept: "application/json",
  };
}

export interface PartnerResult<T> {
  ok: boolean;
  status: number;
  data: T & { ok?: boolean; code?: string; message?: string; field?: string; hint?: string };
}

/** One signed call. The body is signed and sent as the exact same string. */
export async function partnerCall<T>(env: PartnerEnv, method: "GET" | "POST", path: string, payload?: unknown): Promise<PartnerResult<T>> {
  const body = payload === undefined ? "" : JSON.stringify(payload);
  const headers = await signedHeaders(env, method, path, body);
  let res: Response;
  try {
    // A partner that doesn't answer must not leave the viewer on a spinner.
    res = await fetch(`${UPSTREAM}${path}`, { method, headers, body: method === "POST" ? body : undefined, signal: AbortSignal.timeout(12_000) });
  } catch {
    return { ok: false, status: 502, data: { code: "UPSTREAM_UNREACHABLE" } as PartnerResult<T>["data"] };
  }
  const data = ((await res.json().catch(() => ({}))) ?? {}) as PartnerResult<T>["data"];
  return { ok: res.ok && data.ok !== false, status: res.status, data };
}

export interface PartnerShow {
  show_slug: string;
  title: string;
  entitled: boolean;
  reason: string | null;
}

export interface PartnerSession {
  session_id: string;
  playback_url: string;
  expires_in: number;
  resume_url?: string;
  max_resolution?: number;
}
