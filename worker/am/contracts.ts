import { z } from "zod";

export interface ProviderDiagnostic {
  service: "tmailcloud" | "amgratis";
  method: string;
  failure: "network" | "timeout" | "dns" | "tls" | "http" | "response";
  operation?: "send" | "verify" | "apply";
  upstream_status?: number;
  transport_code?: string;
  platform_code?: string;
}
export class AmError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public diagnostic?: ProviderDiagnostic,
    public retryAfterSeconds?: number,
  ) {
    super(message);
  }
}
export const pointer = z
  .string()
  .max(200)
  .regex(/^(\/([^~]|~[01])*)?$/);
export function at(value: unknown, path: string): unknown {
  if (path === "") return value;
  return path
    .slice(1)
    .split("/")
    .reduce<unknown>((node, part) => {
      const key = part.replace(/~1/g, "/").replace(/~0/g, "~");
      return node !== null &&
        typeof node === "object" &&
        Object.hasOwn(node, key)
        ? (node as Record<string, unknown>)[key]
        : undefined;
    }, value);
}
const fields = z.object({
  id: pointer,
  sender: pointer,
  subject: pointer,
  preview: pointer.optional(),
  received_at: pointer.optional(),
  received_at_format: z
    .enum(["iso", "unix_seconds", "unix_milliseconds"])
    .default("iso"),
});
export const mailContractSchema = z
  .object({
    inbox: z
      .object({
        items: pointer,
        fields,
        success: z
          .object({
            path: pointer,
            value: z.union([z.boolean(), z.string(), z.number()]),
          })
          .optional(),
      })
      .optional(),
    message: z
      .object({
        item: pointer,
        fields,
        html: pointer.optional(),
        text: pointer.optional(),
        raw: pointer.optional(),
        success: z
          .object({
            path: pointer,
            value: z.union([z.boolean(), z.string(), z.number()]),
          })
          .optional(),
      })
      .optional(),
  })
  .strict();
export type MailContract = z.infer<typeof mailContractSchema>;
// Field names and millisecond timestamps confirmed by actual TmailCloud responses.
const documentedMailContract: MailContract = {
  inbox: {
    items: "/messages",
    fields: {
      id: "/id", sender: "/sender", subject: "/subject",
      preview: "/body_text", received_at: "/created_at",
      received_at_format: "unix_milliseconds",
    },
    success: { path: "/success", value: true },
  },
  message: {
    item: "/message",
    fields: {
      id: "/id", sender: "/sender", subject: "/subject",
      received_at: "/created_at", received_at_format: "unix_milliseconds",
    },
    html: "/body_html", text: "/body_text",
    success: { path: "/success", value: true },
  },
};
export function mailContract(raw?: string): MailContract {
  try {
    return mailContractSchema.parse(raw ? JSON.parse(raw) : documentedMailContract);
  } catch {
    throw new AmError(
      503,
      "mail_contract_invalid",
      "The inbox response mapping needs to be configured by the site administrator.",
    );
  }
}
export const amOperation = z.enum(["send", "verify", "apply"]);
export type AmOperation = z.infer<typeof amOperation>;
const successCheck = z.object({
  path: pointer,
  value: z.union([z.boolean(), z.string().min(1), z.number()]),
});
const operation = z
  .object({
    body: z.record(
      z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,63}$/),
      z.enum(["email", "magic_link", "receipt"]),
    ),
    success: successCheck,
    success_all: z.array(successCheck).max(10).optional(),
    success_alternatives: z.array(z.array(successCheck).min(1).max(10)).max(5).optional(),
    receipt: pointer.optional(),
  })
  .strict();
export const amContractSchema = z
  .object({
    auth_header: z.enum(["Authorization", "X-API-Key", "x-api-key"]),
    auth_prefix: z
      .string()
      .max(30)
      .regex(/^[A-Za-z -]*$/),
    operations: z.object({
      send: operation.optional(),
      verify: operation.optional(),
      apply: operation.optional(),
    }),
  })
  .strict()
  .superRefine((contract, ctx) => {
    if (!Object.values(contract.operations).some(Boolean))
      ctx.addIssue({
        code: "custom",
        path: ["operations"],
        message: "Configure at least one documented provider operation.",
      });
    for (const [name, operation] of Object.entries(contract.operations)) {
      if (!operation) continue;
      const values = Object.values(operation.body);
      if (
        !values.includes("email") ||
        (name === "verify" && !values.includes("magic_link")) ||
        (name !== "verify" && values.includes("magic_link")) ||
        (name === "send" && values.includes("receipt"))
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["operations", name, "body"],
          message:
            "Each operation needs email; only verify may use magic_link, and send cannot use a receipt.",
        });
      }
    }
  });
export type AmContract = z.infer<typeof amContractSchema>;
// Documented AMGratis v1 contract. Credentials remain Worker secrets.
const documentedAmContract: AmContract = {
  auth_header: "x-api-key",
  auth_prefix: "",
  operations: {
    send: {
      body: { email: "email" },
      success: { path: "/success", value: true },
    },
    verify: {
      body: { email: "email", rawLink: "magic_link" },
      success: { path: "/success", value: true },
      receipt: "/idToken",
    },
    apply: {
      body: { email: "email", idToken: "receipt" },
      success: { path: "/status", value: "active" },
      success_all: [{ path: "/success", value: true }],
      success_alternatives: [[
        { path: "/data/success", value: true },
        { path: "/data/result/status", value: "success" },
        { path: "/data/result/accountLinkStatus", value: "linked-current" },
        { path: "/data/result/valid", value: true },
      ]],
    },
  },
};
export function amContract(raw?: string): AmContract {
  try {
    return amContractSchema.parse(raw ? JSON.parse(raw) : documentedAmContract);
  } catch {
    throw new AmError(
      503,
      "am_contract_required",
      "The provider request and response contract has not been configured.",
    );
  }
}
export function scalar(value: unknown, max: number, required = false): string {
  if (typeof value !== "string" && typeof value !== "number") {
    if (!required) return "";
    throw new AmError(
      502,
      "provider_shape_changed",
      "The provider response does not match the configured mapping.",
    );
  }
  const result = String(value);
  if (required && (!result || result.length > max))
    throw new AmError(
      502,
      "provider_shape_changed",
      "The provider response does not match the configured mapping.",
    );
  return result.slice(0, max);
}
export function timestamp(
  value: unknown,
  format: "iso" | "unix_seconds" | "unix_milliseconds" = "iso",
): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (format !== "iso") {
    const number = z.coerce.number().finite().nonnegative().safeParse(value);
    const ms = number.success
      ? number.data * (format === "unix_seconds" ? 1000 : 1)
      : NaN;
    if (!Number.isFinite(ms) || !Number.isFinite(new Date(ms).getTime()))
      throw new AmError(
        502,
        "provider_timestamp_format",
        "The timestamp does not match its configured format.",
      );
    return new Date(ms).toISOString();
  }
  const result = z.iso.datetime({ offset: true }).safeParse(value);
  if (!result.success)
    throw new AmError(
      502,
      "provider_timestamp_format",
      "The provider timestamp must be mapped to an ISO 8601 timestamp.",
    );
  return new Date(result.data).toISOString();
}
