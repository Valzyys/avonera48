import type {
  AmAccount,
  AmAccountDetail,
  AmDomain,
  AmMessage,
  AmMessageDetail,
  AmPage,
  AmService,
} from "../../../shared/am";
import { ApiError } from "@/features/members/api";
export class AmApiError extends ApiError {
  constructor(message: string, status: number, code: string | undefined, readonly retryAfterSeconds: number) {
    super(message, status, code);
  }
}
const cooldowns = new Map<string, { until: number; message: string; code?: string }>();
async function request<T>(
  path: string,
  init?: { method?: string; body?: unknown; signal?: AbortSignal },
): Promise<T> {
  const key = `${init?.method ?? "GET"}:${path}`;
  const cooldown = cooldowns.get(key);
  if (cooldown && cooldown.until > Date.now()) {
    const seconds = Math.ceil((cooldown.until - Date.now()) / 1000);
    throw new AmApiError(`${cooldown.message} Retry in ${seconds} seconds.`, 429, cooldown.code, seconds);
  }
  cooldowns.delete(key);
  const res = await fetch(`/api/am${path}`, {
    method: init?.method ?? "GET",
    signal: init?.signal,
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      accept: "application/json",
      ...(init?.body !== undefined
        ? { "content-type": "application/json" }
        : {}),
    },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || data?.ok !== true) {
    const seconds = Math.max(1, Number(data?.retry_after ?? res.headers.get("retry-after")) || 60);
    if (res.status === 429) cooldowns.set(key, {
      until: Date.now() + seconds * 1000,
      message: data?.message ?? "Requests are temporarily limited.", code: data?.error,
    });
    throw new AmApiError(
      data?.message ?? "Could not reach account management. Please try again.",
      res.status,
      data?.error,
      seconds,
    );
  }
  return data as T;
}
const page = (cursor?: string | null) =>
  cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
export const am = {
  status: () => request<AmService>("/status"),
  domains: () => request<{ domains: AmDomain[] }>("/domains"),
  accounts: (cursor?: string | null) =>
    request<AmPage<AmAccount>>(`/accounts${page(cursor)}`),
  create: (domain?: string, automatic = false) =>
    request<{ account: AmAccount }>("/accounts", {
      method: "POST",
      body: { ...(domain ? { domain } : {}), ...(automatic ? { automatic: true } : {}) },
    }),
  account: (id: string, cursor?: string | null, signal?: AbortSignal) =>
    request<AmAccountDetail>(`/accounts/${id}${page(cursor)}`, { signal }),
  delete: (id: string) =>
    request(`/accounts/${id}`, { method: "DELETE", body: {} }),
  sync: (id: string, signal?: AbortSignal) =>
    request(`/accounts/${id}/sync`, { method: "POST", body: {}, signal }),
  messages: (id: string, cursor?: string | null, signal?: AbortSignal) =>
    request<AmPage<AmMessage>>(`/accounts/${id}/messages${page(cursor)}`, {
      signal,
    }),
  message: (id: string, message: string, signal?: AbortSignal) =>
    request<{ message: AmMessageDetail }>(
      `/accounts/${id}/messages/${message}`,
      { signal },
    ),
  operation: (
    id: string,
    workflow: string,
    operation: "send" | "verify" | "apply" | "verify-and-apply" | "confirm-login",
    consent: Record<string, unknown>,
  ) =>
    request(`/accounts/${id}/workflows/${workflow}/${operation}`, {
      method: "POST",
      body: consent,
    }),
};
export async function digest(value: string) {
  return [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
  ]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
}
