import { z } from "zod";
import { AmError, type AmOperation } from "./contracts";
import { mediaUrls } from "../mediaUrls";

export interface AmEnv {
  AM_API_KEY?: string;
  AM_API_CONTRACT?: string;
  TMAIL_RESPONSE_MAP?: string;
  AM_MAX_ACCOUNTS?: string;
  AM_AUTHORIZATION_PUBLIC_KEY?: string;
  AM_AUTHORIZATION_GRANT?: string;
  AM_AUTHORIZATION_ISSUER?: string;
  AM_WORKFLOW_SECRET?: string;
}
const host = z
  .string()
  .toLowerCase()
  .regex(/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/);
const grantSchema = z.object({
  iss: z.url(),
  aud: z.literal("avonera48-am"),
  provider: z.literal("https://www.amgratis.my.id/api/v1"),
  exp: z.number().int().positive(),
  nbf: z.number().int().nonnegative(),
  reference: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[A-Za-z0-9_:./-]+$/),
  scopes: z
    .array(z.enum(["magiclink:send", "account:verify", "license:apply"]))
    .min(1),
  email_domains: z.array(host).min(1).max(50),
  sender_domains: z.array(host).min(1).max(50),
  magic_link_hosts: z.array(host).min(1).max(50),
});
export type AmGrant = z.infer<typeof grantSchema>;
function decode(value: string) {
  return Uint8Array.from(
    atob(value.replace(/-/g, "+").replace(/_/g, "/")),
    (c) => c.charCodeAt(0),
  );
}
export async function readGrant(env: AmEnv): Promise<AmGrant> {
  if (
    !env.AM_AUTHORIZATION_PUBLIC_KEY ||
    !env.AM_AUTHORIZATION_GRANT ||
    !env.AM_AUTHORIZATION_ISSUER
  )
    throw new AmError(
      403,
      "authorization_required",
      "Provider authorization and licensing rights have not been verified.",
    );
  try {
    const [head, payload, signature, extra] =
      env.AM_AUTHORIZATION_GRANT.split(".");
    if (
      !head ||
      !payload ||
      !signature ||
      extra ||
      env.AM_AUTHORIZATION_GRANT.length > 20000
    )
      throw new Error();
    const header: unknown = JSON.parse(new TextDecoder().decode(decode(head)));
    z.object({ alg: z.literal("RS256"), typ: z.literal("JWT") })
      .strict()
      .parse(header);
    const jwk = z
      .object({
        kty: z.literal("RSA"),
        n: z.string().min(100),
        e: z.string().min(1),
      })
      .parse(JSON.parse(env.AM_AUTHORIZATION_PUBLIC_KEY));
    const key = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
    if (
      !(await crypto.subtle.verify(
        "RSASSA-PKCS1-v1_5",
        key,
        decode(signature),
        new TextEncoder().encode(`${head}.${payload}`),
      ))
    )
      throw new Error();
    const grant = grantSchema.parse(
      JSON.parse(new TextDecoder().decode(decode(payload))),
    );
    const now = Date.now() / 1000;
    if (
      grant.iss !== env.AM_AUTHORIZATION_ISSUER ||
      grant.nbf > now ||
      grant.exp <= now
    )
      throw new Error();
    return grant;
  } catch {
    throw new AmError(
      403,
      "authorization_invalid",
      "The provider authorization is invalid or expired.",
    );
  }
}
const scopes: Record<AmOperation, AmGrant["scopes"][number]> = {
  send: "magiclink:send",
  verify: "account:verify",
  apply: "license:apply",
};
export async function requireGrant(
  env: AmEnv,
  operation: AmOperation,
  email: string,
) {
  const grant = await readGrant(env);
  if (
    !grant.scopes.includes(scopes[operation]) ||
    !grant.email_domains.includes(email.split("@")[1])
  )
    throw new AmError(
      403,
      "authorization_scope",
      "The authorization does not cover this operation or email domain.",
    );
  return grant;
}
export async function receiptCodec(env: AmEnv, workflow: string) {
  if (!env.AM_WORKFLOW_SECRET || env.AM_WORKFLOW_SECRET.length < 32)
    throw new AmError(
      503,
      "workflow_secret_required",
      "Secure workflow storage has not been configured.",
    );
  return mediaUrls(`${env.AM_WORKFLOW_SECRET}|am-workflow`, workflow);
}
export const privateLinkPolicy = {
  sender_domains: ["alightcreative.com", "alight-creative.firebaseapp.com"],
  magic_link_hosts: ["alightcreative.com", "login.alightcreative.com", "alight-creative.firebaseapp.com"],
};
export function permittedLink(url: string, sender: string, grant: Pick<AmGrant, "sender_domains" | "magic_link_hosts">) {
  let hostName: string;
  try {
    const u = new URL(url);
    if (
      u.protocol !== "https:" ||
      u.username ||
      u.password ||
      (u.port && u.port !== "443")
    )
      return false;
    hostName = u.hostname;
  } catch {
    return false;
  }
  const address =
    /(?:<|\s|^)([^<>\s]+@[^<>\s]+)>?$/.exec(sender.trim())?.[1] ?? "";
  const domain = address.split("@")[1]?.toLowerCase();
  return (
    !!domain &&
    grant.sender_domains.includes(domain) &&
    grant.magic_link_hosts.includes(hostName)
  );
}
