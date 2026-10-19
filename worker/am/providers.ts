import { z } from "zod";
import type { AmDomain, AmMessageDetail } from "../../shared/am";
import {
  AmError,
  at,
  scalar,
  timestamp,
  type MailContract,
  type AmContract,
  type AmOperation,
  type ProviderDiagnostic,
} from "./contracts";
import { extractContent, metadataPreview } from "./content";

const MAIL = "https://tmailcloud.my.id";
const AM = "https://www.amgratis.my.id/api/v1";
const domainName = z
  .string()
  .toLowerCase()
  .regex(
    /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/,
  );
export { domainName };
const MAIL_ORIGINS = new Set([MAIL, "https://www.tmailcloud.my.id"]);
const REDIRECTS = new Set([301, 302, 303, 307, 308]);

/** Only read-only Tmail redirects to its own HTTPS hosts may be followed. */
async function fetchProvider(
  service: "mail" | "am",
  path: string,
  init: RequestInit,
  signal: AbortSignal,
) {
  let url = new URL(`${service === "mail" ? MAIL : AM}${path}`);
  for (let hops = 0; ; hops++) {
    const headers = new Headers(init.headers);
    headers.set("accept", "application/json");
    const response = await fetch(url.href, {
      ...init,
      headers,
      signal,
      redirect: "manual",
    });
    if (!REDIRECTS.has(response.status)) return response;
    const location = response.headers.get("location");
    await response.body?.cancel();
    if (service !== "mail" || (init.method ?? "GET") !== "GET") {
      throw new AmError(
        502,
        "provider_write_redirect",
        "The provider redirected a write request. Its result is unconfirmed; check with the provider before retrying.",
      );
    }
    if (!location || hops >= 3)
      throw new AmError(
        502,
        "provider_redirect_invalid",
        "TmailCloud returned a missing or looping redirect. Please contact the provider.",
      );
    let next: URL;
    try {
      next = new URL(location, url);
    } catch {
      throw new AmError(
        502,
        "provider_redirect_invalid",
        "TmailCloud returned an invalid redirect.",
      );
    }
    if (!MAIL_ORIGINS.has(next.origin) || next.username || next.password)
      throw new AmError(
        502,
        "provider_redirect_blocked",
        "TmailCloud redirected the request outside its approved HTTPS API hosts.",
      );
    url = next;
  }
}

function networkError(error: unknown, method: string, service: "mail" | "am") {
  const label = service === "mail" ? "TmailCloud" : "The account provider";
  // Classify locally; never return exception text or URLs containing credentials.
  const failure =
    error instanceof Error ? `${error.name} ${error.message}` : "";
  const cause: unknown = error instanceof Error ? error.cause : null;
  const rawCode =
    cause && typeof cause === "object" && "code" in cause ? cause.code : null;
  const transportCodes = [
    "ENOTFOUND",
    "EAI_AGAIN",
    "ECONNREFUSED",
    "ECONNRESET",
    "ETIMEDOUT",
    "UND_ERR_CONNECT_TIMEOUT",
    "UND_ERR_SOCKET",
  ];
  const transportCode =
    typeof rawCode === "string" && transportCodes.includes(rawCode)
      ? rawCode
      : undefined;
  const platformCode =
    /\b(?:error(?: code)?|code)[: #]*(10\d{2}|11\d{2}|52\d|53\d)\b/i.exec(
      failure,
    )?.[1];
  const kind = /timeout|timed out|abort/i.test(
    `${failure} ${transportCode ?? ""}`,
  )
    ? "timeout"
    : /dns|enotfound|eai_again|name.?resol/i.test(
          `${failure} ${transportCode ?? ""}`,
        )
      ? "dns"
      : /tls|ssl|certificate/i.test(failure)
        ? "tls"
        : "network";
  const diagnostic: ProviderDiagnostic = {
    service: service === "mail" ? "tmailcloud" : "amgratis",
    method,
    failure: kind,
    ...(transportCode ? { transport_code: transportCode } : {}),
    ...(platformCode ? { platform_code: platformCode } : {}),
  };
  if (method !== "GET")
    return new AmError(
      502,
      "provider_unreachable",
      `${label} could not be reached. The write result is unconfirmed; check its status before retrying.`,
      diagnostic,
    );
  if (kind === "timeout")
    return new AmError(
      504,
      "provider_timeout",
      `${label} took too long to respond. Please retry.`,
      diagnostic,
    );
  if (kind === "dns")
    return new AmError(
      502,
      "provider_dns_failed",
      `${label}'s hostname could not be resolved from this site. Please contact the provider.`,
      diagnostic,
    );
  if (kind === "tls")
    return new AmError(
      502,
      "provider_tls_failed",
      `${label}'s secure connection could not be established. Please contact the provider.`,
      diagnostic,
    );
  return new AmError(
    502,
    "provider_unreachable",
    `${label} could not be reached from this site. Please retry.`,
    diagnostic,
  );
}

/** Fixed destinations; writes are never retried or redirected. */
export async function providerRequest(
  service: "mail" | "am",
  path: string,
  init: RequestInit = {},
): Promise<unknown> {
  const method = (init.method ?? "GET").toUpperCase();
  const retries = method === "GET" ? 2 : 0;
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetchProvider(
        service,
        path,
        { ...init, method },
        AbortSignal.timeout(service === "am" ? 25000 : 8000),
      );
    } catch (error) {
      if (error instanceof AmError) throw error;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 250 * 2 ** attempt));
        continue;
      }
      throw networkError(error, method, service);
    }
    if ((res.status === 429 || res.status >= 500) && attempt < retries) {
      await res.body?.cancel();
      await new Promise((r) => setTimeout(r, 250 * 2 ** attempt));
      continue;
    }
    if (!res.ok) {
      await res.body?.cancel();
      throw new AmError(
        res.status === 429 ? 429 : 502,
        "provider_rejected",
        "The provider rejected this request. Please try again later.",
        {
          service: service === "mail" ? "tmailcloud" : "amgratis",
          method,
          failure: "http",
          upstream_status: res.status,
        },
      );
    }
    if (!res.body)
      throw new AmError(
        502,
        "provider_empty",
        "The provider returned an empty response.",
      );
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 2_000_000) {
          await reader.cancel();
          throw new AmError(
            502,
            "provider_too_large",
            "The provider response is too large.",
          );
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const part of chunks) {
      bytes.set(part, offset);
      offset += part.length;
    }
    try {
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      throw new AmError(
        502,
        "provider_invalid_json",
        "The provider did not return valid JSON.",
      );
    }
  }
}
const domainsSchema = z.object({
  success: z.literal(true),
  domains: z
    .array(z.object({ name: domainName, is_active: z.boolean() }))
    .max(500),
});
export async function domains(): Promise<AmDomain[]> {
  const parsed = domainsSchema.safeParse(
    await providerRequest("mail", "/api/domains"),
  );
  if (!parsed.success)
    throw new AmError(
      502,
      "domains_shape_changed",
      "The domain list does not match the documented provider response.",
    );
  return [
    ...new Map(
      parsed.data.domains.filter((d) => d.is_active).map((d) => [d.name, d]),
    ).values(),
  ];
}
export async function generateEmail(domain: string) {
  const username = `am_${[...crypto.getRandomValues(new Uint8Array(16))].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
  const raw = await providerRequest("mail", "/api/email/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ domain, username }),
  });
  const parsed = z
    .object({
      success: z.literal(true),
      inbox: z.object({ address: z.email().max(320), domain: domainName }),
    })
    .safeParse(raw);
  if (
    !parsed.success ||
    parsed.data.inbox.domain !== domain ||
    parsed.data.inbox.address.toLowerCase() !== `${username}@${domain}`
  )
    throw new AmError(
      502,
      "generated_address_mismatch",
      "The provider did not return the requested mailbox address.",
    );
  return parsed.data.inbox.address.toLowerCase();
}
function requireSuccess(
  raw: unknown,
  check?: { path: string; value: string | boolean | number },
) {
  if (check && at(raw, check.path) !== check.value)
    throw new AmError(
      502,
      "provider_unsuccessful",
      "The provider did not confirm this request.",
    );
}
export async function inbox(address: string, contract: MailContract) {
  const config = contract.inbox;
  if (!config)
    throw new AmError(
      503,
      "inbox_adapter_required",
      "The inbox response mapping has not been configured. Your mailbox is saved; try again after setup.",
    );
  const raw = await providerRequest(
    "mail",
    `/api/email/inbox/${encodeURIComponent(address)}`,
  );
  requireSuccess(raw, config.success);
  const rows = at(raw, config.items);
  if (!Array.isArray(rows) || rows.length > 500)
    throw new AmError(
      502,
      "provider_shape_changed",
      "The inbox list does not match the configured response mapping.",
    );
  const seen = new Set<string>();
  return rows
    .map((row) => ({
      provider_message_id: scalar(at(row, config.fields.id), 200, true),
      sender: scalar(at(row, config.fields.sender), 500, true),
      subject: metadataPreview(scalar(at(row, config.fields.subject), 500)),
      preview: metadataPreview(
        scalar(
          config.fields.preview ? at(row, config.fields.preview) : "",
          3000,
        ),
      ),
      received_at: timestamp(
        config.fields.received_at ? at(row, config.fields.received_at) : null,
        config.fields.received_at_format,
      ),
    }))
    .filter((row) => {
      if (seen.has(row.provider_message_id)) return false;
      seen.add(row.provider_message_id);
      return true;
    });
}
export async function message(
  id: string,
  contract: MailContract,
): Promise<AmMessageDetail> {
  if ([".", ".."].includes(id))
    throw new AmError(
      502,
      "message_identity_invalid",
      "The provider message identifier is invalid.",
    );
  const config = contract.message;
  if (!config)
    throw new AmError(
      503,
      "message_adapter_required",
      "The message response mapping has not been configured.",
    );
  const raw = await providerRequest(
    "mail",
    `/api/email/message/${encodeURIComponent(id)}`,
  );
  requireSuccess(raw, config.success);
  const row = at(raw, config.item);
  const html = config.html
    ? scalar(at(row, config.html), 1_000_000) || null
    : null;
  const text = config.text
    ? scalar(at(row, config.text), 1_000_000) || null
    : null;
  const sender = scalar(at(row, config.fields.sender), 500, true);
  const sourceId = scalar(at(row, config.fields.id), 200, true);
  if (sourceId !== id)
    throw new AmError(
      502,
      "message_identity_mismatch",
      "The provider returned a different message.",
    );
  return {
    id,
    sender,
    subject: scalar(at(row, config.fields.subject), 500),
    received_at: timestamp(
      config.fields.received_at ? at(row, config.fields.received_at) : null,
      config.fields.received_at_format,
    ),
    html,
    text,
    raw: config.raw ? scalar(at(row, config.raw), 1_000_000) || null : null,
    ...extractContent(html, text, sender),
  };
}
const endpoints: Record<AmOperation, string> = {
  send: "/send-magiclink",
  verify: "/verify-account",
  apply: "/apply-premium",
};
export async function amRequest(
  operation: AmOperation,
  contract: AmContract,
  apiKey: string,
  values: { email: string; magic_link?: string; receipt?: string },
) {
  const config = contract.operations[operation];
  if (!config)
    throw new AmError(
      503,
      "provider_step_not_configured",
      "This provider operation has not been configured.",
    );
  const body: Record<string, string> = {};
  for (const [key, source] of Object.entries(config.body)) {
    const value = values[source];
    if (!value)
      throw new AmError(
        409,
        "provider_input_missing",
        "A confirmed result from the previous step is required.",
      );
    body[key] = value;
  }
  if (!Object.values(config.body).includes("email"))
    throw new AmError(
      503,
      "provider_contract_invalid",
      "The provider contract must bind this operation to the account email.",
    );
  const raw = await providerRequest("am", endpoints[operation], {
    method: "POST",
    headers: {
      "content-type": "application/json",
      [contract.auth_header]: `${contract.auth_prefix}${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  requireSuccess(raw, config.success);
  return {
    receipt:
      config.receipt !== undefined
        ? scalar(at(raw, config.receipt), 10000, true)
        : null,
  };
}
