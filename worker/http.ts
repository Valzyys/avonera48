/** Small helpers shared by the API modules. */

const HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" };

export const reply = (body: unknown, status = 200, extra: HeadersInit = {}) => new Response(JSON.stringify(body), { status, headers: { ...HEADERS, ...extra } });

export const fail = (status: number, error: string, message: string, field?: string) => reply({ ok: false, error, message, ...(field ? { field } : {}) }, status);

/** Same-origin JSON only, so another site cannot post a form at these endpoints. */
export function sameOrigin(request: Request, url: URL) {
  const origin = request.headers.get("origin");
  if (origin && origin !== url.origin) return false;
  return (request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json");
}

export async function body(request: Request): Promise<Record<string, unknown>> {
  try {
    const data = await request.json();
    return data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

/** A whole number in [min, max], or null. */
export function int(v: unknown, min: number, max: number): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

export const enc = new TextEncoder();
export const hex = (buf: ArrayBuffer | Uint8Array) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
export const randomHex = (bytes: number) => hex(crypto.getRandomValues(new Uint8Array(bytes)));
export const sha256 = async (s: string) => hex(await crypto.subtle.digest("SHA-256", enc.encode(s)));

/** URL-safe random id, e.g. for order ids in /dashboard/pay/<id>. */
export function randomId(len = 16) {
  const abc = "abcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return [...bytes].map((b) => abc[b % abc.length]).join("");
}
