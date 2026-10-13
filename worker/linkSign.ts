/** Signing and payload checks for the JKT48Connect link (worker/link.ts), free of Workers types. */

import { enc, hex, str } from "./http";

export interface LinkedMembership {
  plan_id: string;
  plan_name: string;
  expires_at: string;
}

const SKEW = 300;
const MAX_BODY = 16 * 1024;

async function hmacKey(secret: string) {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function sign(secret: string, timestamp: string, raw: string) {
  return `sha256=${hex(await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode(`${timestamp}.${raw}`)))}`;
}

/** The parsed body of a request JKT48Connect signed, or null. */
export async function verified(request: Request, secret: string, now = Date.now()): Promise<Record<string, unknown> | null> {
  const ts = request.headers.get("x-avonera-timestamp") ?? "";
  const sig = /^sha256=([a-f0-9]{64})$/i.exec(request.headers.get("x-avonera-signature") ?? "")?.[1];
  if (!sig || !/^\d{9,11}$/.test(ts) || Math.abs(now / 1000 - Number(ts)) > SKEW) return null;
  const raw = await request.text();
  if (raw.length > MAX_BODY) return null;
  const bytes = new Uint8Array(sig.match(/../g)!.map((h) => parseInt(h, 16)));
  // subtle.verify compares in constant time.
  if (!(await crypto.subtle.verify("HMAC", await hmacKey(secret), bytes, enc.encode(`${ts}.${raw}`)))) return null;
  try {
    const data = JSON.parse(raw);
    return data && typeof data === "object" ? data : null;
  } catch {
    return null;
  }
}

/** A membership that is still running, or null (none, ended, or unreadable). */
export function readMembership(v: unknown, now = Date.now()): LinkedMembership | null {
  if (!v || typeof v !== "object") return null;
  const m = v as Record<string, unknown>;
  const at = Date.parse(str(m.expires_at, 40));
  if (Number.isNaN(at) || at <= now) return null;
  const name = str(m.plan_name, 60).trim() || "JKT48Connect membership";
  return { plan_id: str(m.plan_id, 60).trim() || "jkt48connect", plan_name: name, expires_at: new Date(at).toISOString() };
}

