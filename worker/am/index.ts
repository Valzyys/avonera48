import { ensureAmSchema } from "./schema";
import { z } from "zod";
import type {
  AmAccount,
  AmMessage,
  AmWorkflow,
  AmActivity,
} from "../../shared/am";
import { body, reply, sameOrigin, sha256 } from "../http";
import {
  AmError,
  amContract,
  mailContract,
  type AmOperation,
} from "./contracts";
import {
  amRequest,
  domainName,
  domains,
  generateEmail,
  inbox,
  message,
} from "./providers";
import {
  permittedLink,
  readGrant,
  receiptCodec,
  requireGrant,
  privateLinkPolicy,
  verificationLink,
  type AmEnv,
} from "./authorization";

export type { AmEnv } from "./authorization";
interface Context extends AmEnv {
  DB?: D1Database;
}
interface Viewer {
  id: string;
  isAdmin?: boolean;
}
const idSchema = z.uuid();
const pageSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(15),
  cursor: z.string().max(150).optional(),
});
const consentSchema = z.object({
  consent: z.literal(true),
  owns_account: z.literal(true),
  acknowledge_resend: z.literal(true).optional(),
});
const verifySchema = consentSchema.extend({
  message_id: idSchema,
  link_sha256: z.string().regex(/^[a-f0-9]{64}$/),
});
const now = () => new Date().toISOString();
const maxAccounts = (env: AmEnv) =>
  Math.min(
    100,
    Math.max(1, Number.parseInt(env.AM_MAX_ACCOUNTS ?? "20", 10) || 20),
  );
const asAccount =
  "a.id, a.email, a.domain, a.status, a.created_at, a.updated_at, (SELECT COUNT(*) FROM am_messages m WHERE m.account_id = a.id) AS inbox_count";
function page(url: URL) {
  const parsed = pageSchema.safeParse({
    limit: url.searchParams.get("limit") ?? undefined,
    cursor: url.searchParams.get("cursor") ?? undefined,
  });
  if (!parsed.success)
    throw new AmError(400, "invalid_pagination", "Invalid page parameters.");
  let date = "9999";
  let id = "~";
  if (parsed.data.cursor) {
    const [d, i, extra] = parsed.data.cursor.split("|");
    if (
      !d ||
      !i ||
      extra ||
      !z.iso.datetime().safeParse(d).success ||
      !idSchema.safeParse(i).success
    )
      throw new AmError(400, "invalid_cursor", "Invalid page cursor.");
    date = d;
    id = i;
  }
  return { limit: parsed.data.limit, date, id };
}
function paged<T extends { id: string; created_at: string }>(
  items: T[],
  limit: number,
) {
  const hasMore = items.length > limit;
  const result = items.slice(0, limit);
  const last = result.at(-1);
  return {
    items: result,
    next_cursor: hasMore && last ? `${last.created_at}|${last.id}` : null,
  };
}
async function rate(
  db: D1Database,
  user: string,
  action: string,
  seconds: number,
  limit: number,
) {
  const window = Math.floor(Date.now() / 1000 / seconds) * seconds;
  const hit = await db
    .prepare(
      `INSERT INTO am_rate_limits (user_id, action, window_start, hits) VALUES (?, ?, ?, 1)
    ON CONFLICT(user_id, action, window_start) DO UPDATE SET hits = hits + 1 WHERE hits < ? RETURNING hits`,
    )
    .bind(user, action, window, limit)
    .first();
  if (!hit)
    throw new AmError(
      429,
      "rate_limited",
      "Too many requests. Wait before trying again.",
    );
}
async function owned(db: D1Database, user: string, id: string) {
  if (!idSchema.safeParse(id).success)
    throw new AmError(404, "account_not_found", "Account not found.");
  const row = await db
    .prepare(
      `SELECT ${asAccount} FROM am_accounts a WHERE a.id = ? AND a.user_id = ? AND a.status != 'deleted'`,
    )
    .bind(id, user)
    .first<AmAccount>();
  if (!row) throw new AmError(404, "account_not_found", "Account not found.");
  return row;
}
async function activity(
  db: D1Database,
  account: string,
  action: string,
  status: string,
) {
  await db
    .prepare(
      "INSERT INTO am_activity_logs(id, account_id, action, status, created_at) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(crypto.randomUUID(), account, action, status, now())
    .run();
}
async function createAccount(
  request: Request,
  env: Context,
  db: D1Database,
  user: string,
) {
  const parsed = z
    .object({ domain: domainName.optional() })
    .strict()
    .safeParse(await body(request));
  if (!parsed.success)
    throw new AmError(400, "invalid_domain", "Choose an active email domain.");
  await rate(db, user, "generate", 3600, 10);
  const active = await domains();
  const preferred = active.find((d) => d.name === "bussiness.biz.id");
  const domain = parsed.data.domain ?? preferred?.name;
  if (!domain || !active.some((d) => d.name === domain))
    return reply(
      {
        ok: false,
        error: "choose_domain",
        message: "Choose one of the domains currently active at TmailCloud.",
        domains: active,
      },
      409,
    );
  const id = crypto.randomUUID();
  const date = now();
  const inserted = await db
    .prepare(
      `INSERT INTO am_accounts(id, user_id, email, domain, status, created_at, updated_at)
    SELECT ?, ?, NULL, ?, 'creating', ?, ? WHERE (SELECT COUNT(*) FROM am_accounts WHERE user_id = ? AND status NOT IN ('deleted','failed')) < ? RETURNING id`,
    )
    .bind(id, user, domain, date, date, user, maxAccounts(env))
    .first();
  if (!inserted)
    throw new AmError(
      409,
      "account_limit",
      "Your saved account limit has been reached. Delete an old account from history first.",
    );
  try {
    const email = await generateEmail(domain);
    const workflow = crypto.randomUUID();
    await db.batch([
      db
        .prepare(
          "UPDATE am_accounts SET email = ?, status = 'ready', updated_at = ? WHERE id = ?",
        )
        .bind(email, now(), id),
      db
        .prepare(
          "INSERT INTO am_workflows(id, account_id, status, current_step, created_at, updated_at) VALUES (?, ?, 'awaiting_email', 'mailbox_created', ?, ?)",
        )
        .bind(workflow, id, date, date),
      db
        .prepare(
          "INSERT INTO am_activity_logs(id, account_id, action, status, created_at) VALUES (?, ?, 'account_generated', 'completed', ?)",
        )
        .bind(crypto.randomUUID(), id, date),
    ]);
    return reply({ ok: true, account: await owned(db, user, id) }, 201);
  } catch (error) {
    await db
      .prepare(
        "UPDATE am_accounts SET status = 'failed', updated_at = ? WHERE id = ?",
      )
      .bind(now(), id)
      .run();
    await activity(db, id, "account_generation", "failed");
    throw error;
  }
}
async function syncInbox(
  env: Context,
  db: D1Database,
  user: string,
  account: AmAccount,
) {
  if (!account.email || account.status !== "ready")
    throw new AmError(409, "account_not_ready", "This mailbox is not ready.");
  await rate(db, user, "inbox", 60, 20);
  const rows = await inbox(account.email, mailContract(env.TMAIL_RESPONSE_MAP));
  const before = await db
    .prepare("SELECT COUNT(*) AS n FROM am_messages WHERE account_id=?")
    .bind(account.id)
    .first<{ n: number }>();
  if (rows.length)
    await db.batch(
      rows.map((row) =>
        db
          .prepare(
            `INSERT INTO am_messages(id, account_id, provider_message_id, sender, subject, preview, received_at) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(account_id, provider_message_id) DO UPDATE SET sender=excluded.sender, subject=excluded.subject, preview=excluded.preview, received_at=excluded.received_at`,
          )
          .bind(
            crypto.randomUUID(),
            account.id,
            row.provider_message_id,
            row.sender,
            row.subject,
            row.preview,
            row.received_at,
          ),
      ),
    );
  const after = await db
    .prepare("SELECT COUNT(*) AS n FROM am_messages WHERE account_id=?")
    .bind(account.id)
    .first<{ n: number }>();
  if ((after?.n ?? 0) > (before?.n ?? 0)) {
    await activity(db, account.id, "messages_received", "completed");
    await db
      .prepare(
        "UPDATE am_workflows SET current_step='email_received', updated_at=? WHERE account_id=? AND status IN ('awaiting_email','awaiting_approval')",
      )
      .bind(now(), account.id)
      .run();
  }
  return reply({ ok: true, synced: rows.length });
}
async function ownedMessage(
  env: Context,
  db: D1Database,
  account: AmAccount,
  id: string,
) {
  if (!idSchema.safeParse(id).success)
    throw new AmError(404, "message_not_found", "Message not found.");
  const row = await db
    .prepare(
      "SELECT provider_message_id FROM am_messages WHERE id = ? AND account_id = ?",
    )
    .bind(id, account.id)
    .first<{ provider_message_id: string }>();
  if (!row) throw new AmError(404, "message_not_found", "Message not found.");
  return message(row.provider_message_id, mailContract(env.TMAIL_RESPONSE_MAP));
}
async function runOperation(
  request: Request,
  env: Context,
  db: D1Database,
  user: string,
  account: AmAccount,
  workflowId: string,
  operation: AmOperation,
  personal = false,
) {
  const input = await body(request);
  const consent = (
    operation === "verify" ? verifySchema : consentSchema
  ).safeParse(input);
  if (!consent.success)
    throw new AmError(
      400,
      "consent_required",
      "Confirm that you own this account and approve this specific step.",
    );
  if (!account.email || account.status !== "ready")
    throw new AmError(409, "account_not_ready", "This account is not ready.");
  if (!idSchema.safeParse(workflowId).success)
    throw new AmError(404, "workflow_not_found", "Workflow not found.");
  const workflow = await db
    .prepare("SELECT * FROM am_workflows WHERE id = ? AND account_id = ?")
    .bind(workflowId, account.id)
    .first<AmWorkflow & { provider_receipt: string | null }>();
  if (!workflow)
    throw new AmError(404, "workflow_not_found", "Workflow not found.");
  const grant =
    operation === "send" || personal
      ? null
      : await requireGrant(env, operation, account.email);
  const contract = amContract(env.AM_API_CONTRACT);
  if (!env.AM_API_KEY)
    throw new AmError(
      503,
      "am_key_missing",
      "The provider service has not been configured.",
    );
  const config = contract.operations[operation];
  if (!config)
    throw new AmError(
      503,
      "provider_step_not_configured",
      "This provider operation has not been configured.",
    );
  // Sending an email does not authenticate the account or grant a license.
  const codec =
    operation !== "send" || config.receipt !== undefined
      ? await receiptCodec(env, workflowId)
      : null;
  await rate(db, user, "workflow", 3600, 10);
  let link: string | undefined;
  if (operation === "verify") {
    const parsed = verifySchema.parse(input);
    const detail = await ownedMessage(env, db, account, parsed.message_id);
    for (const candidate of detail.links) {
      if (
        candidate.authentication &&
        (await sha256(candidate.url)) === parsed.link_sha256 &&
        permittedLink(candidate.url, detail.sender, personal ? privateLinkPolicy : grant!)
      ) {
        link = verificationLink(candidate.url, detail.sender, personal ? privateLinkPolicy : grant!);
        break;
      }
    }
    if (!link)
      throw new AmError(
        409,
        "link_not_approved",
        "The reviewed link is no longer available or is outside the authorized sender and host policy.",
      );
  }
  const allowed =
    operation === "send"
      ? ["awaiting_email", "awaiting_approval"]
      : operation === "verify"
        ? ["awaiting_email", "awaiting_approval"]
        : ["verified"];
  const resend = operation === "send" && workflow.status === "uncertain" &&
    ["send", "verify"].includes(workflow.current_step);
  const restartEmail = operation === "send" && workflow.status === "failed" &&
    ["send", "verify"].includes(workflow.current_step);
  if (resend && !consent.data.acknowledge_resend)
    throw new AmError(400, "resend_consent_required",
      "Check the inbox first, then explicitly approve another email. The previous request may have succeeded.");
  if (resend && Date.now() - Date.parse(workflow.updated_at) < 60000)
    throw new AmError(429, "resend_cooldown",
      "Wait one minute after the previous attempt and check your inbox before requesting another email.");
  if (!allowed.includes(workflow.status) && !resend && !restartEmail)
    throw new AmError(
      409,
      "workflow_state",
      "This step cannot run in the current workflow state. Refresh the account.",
    );
  const receipt =
    codec && workflow.provider_receipt && operation !== "send"
      ? await codec.open(workflow.provider_receipt)
      : undefined;
  // Compare-and-swap prevents concurrent clicks and cross-step replays.
  const locked = await db
    .prepare(
      "UPDATE am_workflows SET status='running', current_step=?, error_message=NULL, updated_at=? WHERE id=? AND status=? AND EXISTS(SELECT 1 FROM am_accounts WHERE id=am_workflows.account_id AND status='ready') RETURNING id",
    )
    .bind(operation, now(), workflowId, workflow.status)
    .first();
  if (!locked)
    throw new AmError(
      409,
      "workflow_busy",
      "This workflow is already processing.",
    );
  try {
    await activity(db, account.id, `${operation}_approved`, "running");
    const result = await amRequest(operation, contract, env.AM_API_KEY, {
      email: account.email,
      magic_link: link,
      receipt,
    });
    const state =
      operation === "send"
        ? "awaiting_approval"
        : operation === "verify"
          ? "verified"
          : "completed";
    const sealed = result.receipt
      ? await codec!.seal(result.receipt)
      : workflow.provider_receipt;
    await db.batch([
      db
        .prepare(
          "UPDATE am_workflows SET status=?, current_step=?, provider_receipt=?, updated_at=? WHERE id=?",
        )
        .bind(state, `${operation}_confirmed`, sealed, now(), workflowId),
      db
        .prepare(
          "INSERT INTO am_activity_logs(id, account_id, action, status, created_at) VALUES (?, ?, ?, 'completed', ?)",
        )
        .bind(crypto.randomUUID(), account.id, `${operation}_confirmed`, now()),
    ]);
    return reply({ ok: true, status: state });
  } catch (error) {
    // A timeout cannot establish that a write failed. Never auto-retry it.
    const detail = error instanceof AmError
      ? `${error.message} (${error.code}${error.diagnostic?.upstream_status ? `; HTTP ${error.diagnostic.upstream_status}` : ""})`
      : "The provider outcome could not be confirmed.";
    const declined = error instanceof AmError && error.code === "provider_declined";
    const guidance = operation === "send" || operation === "verify"
      ? "Check your inbox first. After one minute you may explicitly request another email; the previous request may have succeeded."
      : "Contact support to confirm the outcome before continuing.";
    await db
      .prepare(
        "UPDATE am_workflows SET status=?, error_message=?, updated_at=? WHERE id=?",
      )
      .bind(
        declined ? "failed" : "uncertain",
        `${detail} ${guidance}`,
        now(),
        workflowId,
      )
      .run();
    await activity(db, account.id, declined ? `${operation}_declined` : `${operation}_outcome_unknown`, declined ? "failed" : "uncertain");
    throw error;
  }
}

export async function handleAm(
  request: Request,
  env: Context,
  user: Viewer,
  url: URL,
): Promise<Response> {
  if (!env.DB)
    return reply(
      {
        ok: false,
        error: "database_unavailable",
        message: "Account management needs the existing D1 database binding.",
      },
      503,
    );
  const db = env.DB;
  try {
    if (!["GET", "POST", "DELETE"].includes(request.method))
      return reply(
        {
          ok: false,
          error: "method_not_allowed",
          message: "Method not allowed.",
        },
        405,
      );
    if (request.method !== "GET" && !sameOrigin(request, url))
      throw new AmError(
        403,
        "forbidden",
        "Cross-site requests are not allowed.",
      );
    try {
      await ensureAmSchema(db);
    } catch {
      throw new AmError(
        503,
        "am_database_unavailable",
        "Account management could not initialize its database. Please retry or check the D1 binding.",
      );
    }
    const suffix = url.pathname.slice("/api/am".length);
    if (suffix === "/status" && request.method === "GET") {
      await db.prepare("SELECT id FROM am_accounts LIMIT 1").first();
      let authorization: {
        valid: boolean;
        scopes: string[];
        reason: string;
        reference: string | null;
      };
      try {
        const grant = await readGrant(env);
        authorization = {
          valid: true,
          scopes: grant.scopes,
          reason: "Signed provider authorization verified",
          reference: grant.reference,
        };
      } catch (error) {
        authorization = {
          valid: false,
          scopes: [],
          reason:
            error instanceof AmError
              ? error.message
              : "Authorization unavailable",
          reference: null,
        };
      }
      if (user.isAdmin) authorization = {
        valid: true,
        scopes: ["magiclink:send", "account:verify", "license:apply"],
        reason: "Private administrator workflow",
        reference: null,
      };
      let mail: ReturnType<typeof mailContract> = {};
      let provider = false;
      let contract: ReturnType<typeof amContract> | null = null;
      try {
        mail = mailContract(env.TMAIL_RESPONSE_MAP);
      } catch {
        /* unavailable, shown in service status */
      }
      try {
        contract = amContract(env.AM_API_CONTRACT);
        provider =
          !!contract.operations.send &&
          !!contract.operations.verify &&
          !!contract.operations.apply &&
          !!env.AM_API_KEY &&
          !!env.AM_WORKFLOW_SECRET &&
          env.AM_WORKFLOW_SECRET.length >= 32;
      } catch {
        /* not configured */
      }
      const storageReady =
        !!env.AM_WORKFLOW_SECRET && env.AM_WORKFLOW_SECRET.length >= 32;
      const actionReady = (operation: AmOperation) => {
        if (!env.AM_API_KEY)
          return {
            ready: false,
            reason: "The account provider API credential is not configured.",
          };
        const config = contract?.operations[operation];
        if (!config)
          return {
            ready: false,
            reason: `${operation === "send" ? "Magic-link request" : operation === "verify" ? "Verification" : "Activation"} format has not been configured for the provider.`,
          };
        if (
          (operation !== "send" || config.receipt !== undefined) &&
          !storageReady
        )
          return {
            ready: false,
            reason: "Secure workflow storage has not been configured.",
          };
        const scope =
          operation === "verify" ? "account:verify" : "license:apply";
        if (
          operation !== "send" &&
          (!authorization.valid || !authorization.scopes.includes(scope))
        )
          return {
            ready: false,
            reason:
              "Verified provider authorization is required for this step.",
          };
        return {
          ready: true,
          reason:
            operation === "send"
              ? "Ready to request a sign-in email with your approval."
              : user.isAdmin ? "Ready for your private administrator workflow." : "Ready after your explicit approval.",
        };
      };
      return reply({
        ok: true,
        database: true,
        inbox_adapter: !!mail.inbox,
        detail_adapter: !!mail.message,
        authorization,
        private_admin: user.isAdmin === true,
        provider_contract: provider,
        actions: {
          send: actionReady("send"),
          verify: actionReady("verify"),
          apply: actionReady("apply"),
        },
        max_accounts: maxAccounts(env),
      });
    }
    if (suffix === "/domains" && request.method === "GET") {
      await rate(db, user.id, "domains", 60, 20);
      return reply({ ok: true, domains: await domains() });
    }
    if (suffix === "/accounts") {
      if (request.method === "POST")
        return await createAccount(request, env, db, user.id);
      if (request.method === "GET") {
        await db
          .prepare(
            "UPDATE am_accounts SET status='failed', updated_at=? WHERE user_id=? AND status='creating' AND updated_at<?",
          )
          .bind(now(), user.id, new Date(Date.now() - 300000).toISOString())
          .run();
        const p = page(url);
        const rows = await db
          .prepare(
            `SELECT ${asAccount} FROM am_accounts a WHERE a.user_id=? AND a.status!='deleted' AND (a.created_at < ? OR (a.created_at = ? AND a.id < ?)) ORDER BY a.created_at DESC, a.id DESC LIMIT ?`,
          )
          .bind(user.id, p.date, p.date, p.id, p.limit + 1)
          .all<AmAccount>();
        return reply({ ok: true, ...paged(rows.results, p.limit) });
      }
    }
    const match = /^\/accounts\/([^/]+)(?:\/(.*))?$/.exec(suffix);
    if (!match) throw new AmError(404, "not_found", "Not found.");
    const account = await owned(db, user.id, match[1]);
    const action = match[2] ?? "";
    if (!action && request.method === "DELETE") {
      const deleted = await db
        .prepare(
          "UPDATE am_accounts SET status='deleted', updated_at=? WHERE id=? AND status!='creating' AND NOT EXISTS(SELECT 1 FROM am_workflows WHERE account_id=? AND status='running') RETURNING id",
        )
        .bind(now(), account.id, account.id)
        .first();
      if (!deleted)
        throw new AmError(
          409,
          "workflow_busy",
          "Wait for account creation or the active workflow before deleting this account.",
        );
      // Keep an email tombstone to prevent reassignment; remove sensitive child rows.
      await db.batch([
        ...["am_messages", "am_workflows", "am_activity_logs"].map((table) =>
          db
            .prepare(`DELETE FROM ${table} WHERE account_id=?`)
            .bind(account.id),
        ),
      ]);
      return reply({ ok: true });
    }
    if (!action && request.method === "GET") {
      const p = page(url);
      const logs = await db
        .prepare(
          "SELECT * FROM am_activity_logs WHERE account_id=? AND (created_at < ? OR (created_at=? AND id<?)) ORDER BY created_at DESC,id DESC LIMIT ?",
        )
        .bind(account.id, p.date, p.date, p.id, p.limit + 1)
        .all<AmActivity>();
      const workflows = await db
        .prepare(
          "SELECT id,account_id,status,current_step,error_message,created_at,updated_at FROM am_workflows WHERE account_id=? ORDER BY created_at DESC,id DESC LIMIT 10",
        )
        .bind(account.id)
        .all<AmWorkflow>();
      const a = paged(logs.results, p.limit);
      return reply({
        ok: true,
        account,
        workflows: workflows.results,
        activity: a.items,
        activity_next_cursor: a.next_cursor,
      });
    }
    if (action === "sync" && request.method === "POST")
      return await syncInbox(env, db, user.id, account);
    if (action === "messages" && request.method === "GET") {
      const p = page(url);
      // IDs are stable local UUIDs; the cursor uses the stored timestamp or ISO minimum.
      const rows = await db
        .prepare(
          "SELECT id,provider_message_id,sender,subject,preview,received_at FROM am_messages WHERE account_id=? AND (COALESCE(received_at,'0001-01-01T00:00:00.000Z') < ? OR (COALESCE(received_at,'0001-01-01T00:00:00.000Z')=? AND id<?)) ORDER BY COALESCE(received_at,'0001-01-01T00:00:00.000Z') DESC,id DESC LIMIT ?",
        )
        .bind(account.id, p.date, p.date, p.id, p.limit + 1)
        .all<AmMessage>();
      const result = rows.results.slice(0, p.limit);
      const last = result.at(-1);
      return reply({
        ok: true,
        items: result,
        next_cursor:
          rows.results.length > p.limit && last
            ? `${last.received_at ?? "0001-01-01T00:00:00.000Z"}|${last.id}`
            : null,
      });
    }
    const msg = /^messages\/([^/]+)$/.exec(action);
    if (msg && request.method === "GET") {
      await rate(db, user.id, "message", 60, 30);
      return reply({
        ok: true,
        message: await ownedMessage(env, db, account, msg[1]),
      });
    }
    const combined = /^workflows\/([^/]+)\/verify-and-apply$/.exec(action);
    if (combined && request.method === "POST") {
      if (!user.isAdmin)
        throw new AmError(403, "admin_required", "This private workflow is available only to administrators.");
      await rate(db, user.id, "private_workflow", 3600, 10);
      if (!idSchema.safeParse(combined[1]).success)
        throw new AmError(404, "workflow_not_found", "Workflow not found.");
      const state = await db.prepare("SELECT status FROM am_workflows WHERE id=? AND account_id=?")
        .bind(combined[1], account.id).first<{ status: string }>();
      if (!state) throw new AmError(404, "workflow_not_found", "Workflow not found.");
      if (!["awaiting_email", "awaiting_approval", "verified"].includes(state.status))
        throw new AmError(409, "workflow_state", "This workflow cannot continue in its current state.");
      const contract = amContract(env.AM_API_CONTRACT);
      if (!contract.operations.verify?.receipt || !contract.operations.apply ||
        !Object.values(contract.operations.apply.body).includes("receipt"))
        throw new AmError(503, "provider_step_not_configured", "Verification token and activation formats must be configured first.");
      await receiptCodec(env, combined[1]);
      const input: Record<string, unknown> = { consent: true, owns_account: true };
      if (state.status !== "verified") {
        const sent = await db.prepare("SELECT created_at FROM am_activity_logs WHERE account_id=? AND action='send_approved' ORDER BY created_at DESC,id DESC LIMIT 1")
          .bind(account.id).first<{ created_at: string }>();
        // Avoid replaying an older login email while waiting for the new one.
        const cutoff = sent ? new Date(Date.parse(sent.created_at) - 30000).toISOString() : null;
        const rows = await db.prepare("SELECT id FROM am_messages WHERE account_id=? AND (? IS NULL OR received_at>=?) ORDER BY received_at DESC,id DESC LIMIT 10")
          .bind(account.id, cutoff, cutoff).all<{ id: string }>();
        for (const row of rows.results) {
          const detail = await ownedMessage(env, db, account, row.id);
          const links = detail.links.filter(link => link.authentication && permittedLink(link.url, detail.sender, privateLinkPolicy));
          if (links.length > 1)
            throw new AmError(409, "link_ambiguous", "This message contains multiple authentication links. Review the message before continuing.");
          if (links.length === 1) {
            input.message_id = row.id;
            input.link_sha256 = await sha256(links[0].url);
            break;
          }
        }
        if (!input.message_id)
          throw new AmError(409, "magic_link_missing", "No fresh Alight sign-in link was found. Wait for the latest email and refresh the inbox first.");
      }
      const internal = () => new Request(request.url, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input),
      });
      if (state.status !== "verified") {
        const verified = await runOperation(internal(), env, db, user.id, account, combined[1], "verify", true);
        if (!verified.ok) return verified;
      }
      return await runOperation(internal(), env, db, user.id, account, combined[1], "apply", true);
    }
    const workflow = /^workflows\/([^/]+)\/(send|verify|apply)$/.exec(action);
    if (workflow && request.method === "POST")
      return await runOperation(
        request,
        env,
        db,
        user.id,
        account,
        workflow[1],
        workflow[2] as AmOperation,
        user.isAdmin === true,
      );
    throw new AmError(404, "not_found", "Not found.");
  } catch (error) {
    if (error instanceof AmError)
      return reply(
        {
          ok: false,
          error: error.code,
          message: error.message,
          ...(error.diagnostic ? { diagnostic: error.diagnostic } : {}),
        },
        error.status,
      );
    // Never log thrown provider/SQL objects, which can include mail addresses or tokens.
    return reply(
      {
        ok: false,
        error: "am_unavailable",
        message: "Account management could not access its data. Please retry.",
      },
      503,
    );
  }
}
