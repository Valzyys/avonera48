# Avonera48 /am

`/am` uses the existing React/Vite application, AuthProvider session, Worker API
router, `AUTH` KV binding and `DB` D1 binding. It does not introduce Next.js, a
new project, a separate server or a second database. Navigation is available from
the signed-in dashboard.

## Deploy

1. Install dependencies with `npm ci`.
2. AM tables and indexes are created automatically on the first authenticated
   `/api/am/*` request, using additive `IF NOT EXISTS` statements, like the
   existing shop schema. No manual migration is required to open `/am` on an
   existing deployment. Concurrent initialization is shared per D1 binding and
   failed initialization can be retried.

   The equivalent migration remains available for managed deployments:

   ```sh
   npx wrangler d1 migrations apply DB --local
   npx wrangler d1 migrations apply DB --remote
   ```

   Review the target database shown by Wrangler before applying remotely. The
   migration adds only `am_*` tables/indexes and never drops existing tables.
   Users are stored in existing KV, so `user_id` is the authenticated KV user ID;
   child message/workflow/activity records have D1 foreign keys to AM accounts.

3. Configure the response mappings below from **actual provider responses**.
4. Set `AM_API_KEY` and `AM_WORKFLOW_SECRET`. Private workflows use the existing
   administrator session; signed grants are only used by the separate delegated-user flow.
5. Run `npm run typecheck`, `npm test`, `npm run lint`, `npm run build`, then deploy
   using the repository's existing Worker/Pages deployment.

For local development run `npm run preview` (Worker + assets), rather than the
Vite-only development server. Put local secrets in ignored `.dev.vars`.

## Provider contracts: what is known and what is not

TmailCloud is fixed to `https://tmailcloud.my.id`. Its documented domain response
is `{success:true, domains:[{name,is_active,...}]}` and generation response is
`{success:true,inbox:{address,domain,...}}`. These are validated directly with
Zod. Only active domains returned by `/api/domains` are offered. `bussiness.biz.id`
is preselected only when present and active; otherwise the user must select an
actual alternative. Username entropy is 128 bits from Web Crypto.

Actual inbox and detail responses have now been supplied. Their field mappings
are built into the backend, along with the documented AMGratis v1 contract.
There are no production mock messages. Integration tests use synthetic content
in those confirmed response shapes; live provider access is unavailable in the
implementation environment.

### TMAIL_RESPONSE_MAP (optional Worker variable, JSON)

Leave this variable unset for the confirmed TmailCloud format:

- Inbox: `{success:true,messages:[...]}`, with `id`, `sender`, `subject`,
  `body_text` (preview) and `created_at` (Unix milliseconds).
- Detail: `{success:true,message:{...}}`, with the same metadata and
  `body_text` / `body_html` for full content. No raw MIME field was supplied,
  so raw-message view remains unavailable.
- Both operations require `success: true`; malformed responses fail explicitly.
- `verification_code` is not trusted as an OTP: the actual sample contains a
  year (`2026`). OTPs require verification-code context in the message content.
- Firebase-hosted Alight sender/link candidates are detected for user review;
  detection does not establish provider authorization or licensing rights.

Remove a stale `TMAIL_RESPONSE_MAP` override in Cloudflare and redeploy to use
these defaults. Explicit overrides remain supported for documented format
changes. Invalid overrides fail instead of silently selecting another schema.
Paths are RFC 6901 JSON Pointers: `""` means the whole response/row, `/a/b` means
nested fields, `~1` escapes `/`, and `~0` escapes `~` in a field name.

The accepted configuration has these keys:

- `inbox.items`: pointer to the actual array in the inbox response.
- `inbox.fields`: `id`, `sender`, `subject` pointers relative to each array row;
  optional `preview` and `received_at` pointers.
- `inbox.fields.received_at_format`: `iso` (default), `unix_seconds`, or
  `unix_milliseconds`, chosen to match the real provider value.
- `message.item`: pointer to the actual message object in its response.
- `message.fields`: `id`, `sender`, `subject`, optional `received_at` and its format.
- `message.html`, `message.text`, `message.raw`: optional pointers relative to the
  message object. Configure raw only if the provider actually returns raw text.
- Each `inbox`/`message` object can specify `success:{path,value}` to check an
  actual response flag. A mismatch fails explicitly.

Use the real provider message ID field, not the array offset or a generated ID.
The dashboard exposes stable local UUIDs and checks account ownership before
looking up provider IDs. Both address and message ID URL segments are encoded.
No endpoint accepts an arbitrary provider URL or inbox address from the browser.

### AM_API_CONTRACT (Worker variable, JSON)

This is an optional override. Leave it unset to use the documented AMGratis v1
format built into the Worker:

- Header: `x-api-key`, using the `AM_API_KEY` secret without a prefix.
- Send: `{email}`, requiring `success: true`.
- Verify: `{email, rawLink}`, requiring `success: true` and a nonempty `idToken`.
- Apply: `{email, idToken}`, requiring confirmed active status.

If a stale or invalid `AM_API_CONTRACT` is already set in Cloudflare, remove it
and redeploy to select these defaults. No API key belongs in this variable.
This configuration does not bypass user consent or verified licensing authority.

For a documented provider contract change, an explicit override defines:

- `auth_header`: `Authorization`, `X-API-Key`, or `x-api-key` as documented by the
  provider; `auth_prefix`: the exact prefix, including any required trailing space.
- `operations.send`, `operations.verify`, `operations.apply`, each configured operation with:
  - `body`: mapping of actual JSON request field names to `email`, `magic_link`,
    or `receipt`. Every operation must be bound to `email`; verify must include
    `magic_link`; only verify may use it. Send cannot use a prior receipt.
  - `success:{path,value}`: the exact provider success condition. HTTP 200 alone
    is not confirmation. The value must be boolean, a nonempty string or number.
  - Optional `receipt`: pointer to a returned string needed by the next step.

Endpoints are fixed: POST `/send-magiclink`, `/verify-account`, `/apply-premium`
on `https://www.amgratis.my.id/api/v1`. There is no arbitrary endpoint setting.
Operations can be configured independently. Configuring only `send` is sufficient
for user-approved magic-link email requests; it does not enable verification or
licensing. No missing request schema is inferred from another operation.

This adapter supports flat JSON request fields and string receipts. If actual
provider documentation requires a different contract, extend and test the
adapter against that response before enabling it.

## Authorization and secrets

Set secrets through Cloudflare, never in source control:

```sh
npx wrangler secret put AM_API_KEY
npx wrangler secret put AM_WORKFLOW_SECRET
```

`AM_WORKFLOW_SECRET` must contain at least 32 high-entropy characters. Provider
receipts are encrypted at rest with AES-GCM and bound to their workflow ID. Full
email bodies, login links and OTPs are fetched on demand rather than persisted.
Previews redact URLs and numeric code candidates. No provider body, credential,
authentication link or receipt is written to activity logs.

### Private administrator workflow

For the site owner's own accounts, existing authenticated administrators can use
**Verify & Apply** without configuring a signed authorization grant or accepting
additional consent dialogs. Administrator identity comes from the existing
server-side role / `ADMIN_EMAILS` check, never from request JSON. No admin role is
granted by visiting `/am`. The API key and workflow encryption secret are still
required. Mailboxes remain scoped to the signed-in user, including administrators.

POST `/api/am/accounts/:id/workflows/:workflowId/verify-and-apply` selects a link
from the newest saved messages of that owned mailbox. It fetches the message,
requires an exact trusted Alight sender and HTTPS link host, then re-fetches and
matches the link hash before verification. Firebase Alight wrapper links are
decoded locally to their nested Alight authentication URL, with both hosts and
the nested route validated. No authentication URL is fetched by the Worker. Multiple
candidate links in one message fail explicitly instead of choosing arbitrarily.

Only a confirmed verification with a nonempty token permits activation. Tokens
are encrypted in D1, never sent to the browser. If verification completed but
activation has not started, the same button can resume from `verified`. Ambiguous
verification or activation results remain locked against automatic replay. This
mode uses the provider's API and does not assert that the website independently
validated the provider's licensing arrangements. It does not make these actions
available to ordinary users.

### Optional delegated-user authorization (existing flow)

The earlier signed-grant integration remains available for delegated non-admin
users. It is an Avonera access-control mechanism, not an AMGratis API requirement.
Configure `AM_AUTHORIZATION_ISSUER`, `AM_AUTHORIZATION_PUBLIC_KEY` and the secret
`AM_AUTHORIZATION_GRANT` only when using that separate flow.

The signed grant contract is:

- Header: exactly `alg:"RS256", typ:"JWT"`.
- `iss`: matches the configured trusted issuer; `aud`: `avonera48-am`.
- `provider`: `https://www.amgratis.my.id/api/v1`.
- `nbf`, `exp`: integer Unix seconds, checked on every verification/activation operation.
- `reference`: nonsecret authorization reference.
- `scopes`: any authorized subset of `magiclink:send`, `account:verify`,
  `license:apply`.
- `email_domains`: exact allowed generated-mailbox domains.
- `sender_domains`: exact allowed authentication-mail sender domains.
- `magic_link_hosts`: exact HTTPS authentication-link hosts. Subdomains are not
  implicitly trusted.

If no supported signed authorization is available, mailbox management, manual
message review, and explicitly approved magic-link email requests (with a valid
provider key and documented send contract) remain usable. Account verification
and activation stay locked for non-admin users.

## Internal API

All `/api/am/*` routes require an existing Avonera48 session. Mutation routes
also require same-origin JSON. Account IDs are checked against the session user
before message/provider/workflow access. Another user's address or message ID
cannot grant access.

| Route                                                    | Purpose                                                     |
| -------------------------------------------------------- | ----------------------------------------------------------- |
| GET `/api/am/status`                                     | Database/adapter/authorization readiness, no credentials    |
| GET `/api/am/domains`                                    | Actual active domains                                       |
| GET `/api/am/accounts?limit=&cursor=`                    | Server-paginated owned history                              |
| POST `/api/am/accounts`                                  | Validate active domain, reserve quota, generate and persist |
| GET `/api/am/accounts/:id?limit=&cursor=`                | Owned account, recent workflows, paginated activity         |
| DELETE `/api/am/accounts/:id`                            | Remove owned history; keep email tombstone                  |
| POST `/api/am/accounts/:id/sync`                         | Provider inbox sync and metadata upsert                     |
| GET `/api/am/accounts/:id/messages?limit=&cursor=`       | Paginated saved metadata                                    |
| GET `/api/am/accounts/:id/messages/:localId`             | Fetch owned message detail                                  |
| POST `/api/am/accounts/:id/workflows/:workflowId/send`   | Explicitly approved magic-link request                      |
| POST `/api/am/accounts/:id/workflows/:workflowId/verify` | Submit the exact reviewed link                              |
| POST `/api/am/accounts/:id/workflows/:workflowId/apply`  | Explicitly approved, licensed activation                    |
| POST `/api/am/accounts/:id/workflows/:workflowId/verify-and-apply` | Private admin verification followed by confirmed activation |

Individual step mutations require `consent:true, owns_account:true`.
The private admin combined endpoint uses the authenticated button action directly. Verify also
requires `message_id` (local UUID) and `link_sha256`. The backend re-fetches that
owned message, matches the exact reviewed URL hash, checks its sender and host
against the private admin allowlist or delegated signed grant, and only then submits it to the verification API. It
never follows, clicks or redeems authentication URLs directly.

Only a confirmed verification unlocks activation; only a confirmed activation
response marks the workflow `completed`. Access is checked on every request using the private admin session or delegated grant. Sending a sign-in email requires an owned
mailbox, a valid configured API key/send contract and explicit consent, but no
license grant. If the documented send response includes a receipt, the workflow
encryption secret is required before sending. Sending an email never unlocks
verification or activation. A database compare-and-swap and unique running-workflow index prevent
concurrent operations. A timeout/rejection after a provider write is conservatively
marked `uncertain`, without automatic retries or claims of success. Uncertain activation outcomes require operator reconciliation.
For an uncertain email-send or verification step, the user may check their inbox and approve
a new email after a one-minute cooldown, explicitly acknowledging that the prior
request may have succeeded. This starts a new email request, never replays the
uncertain verification token or retries an uncertain activation. Explicit
`success:false` responses are stored as `failed` with the operation identified;
a failed send or verification can start a new email request. A fresh email
request excludes messages older than that request (30 seconds of clock skew
allowed), so Verify & Apply does not accidentally reuse an old sign-in link.
Provider error text and tokens are never forwarded; safe diagnostics identify
the operation and whether failure was a refusal or an unconfirmed response.
The stored error includes only sanitized internal error codes and HTTP status,
never provider bodies, login links, tokens or raw exception messages.

## Limits, retention and rendering

- Default retained account limit: 20 per user; `AM_MAX_ACCOUNTS` can set 1–100.
  Reservations count toward the limit, preventing concurrent generation races.
- Generate: 10 attempts per user per hour; workflow writes: 10/hour; inbox sync:
  20/minute; detail reads: 30/minute. Limits use atomic D1 counters.
- History, message lists and activity use stable timestamp/ID cursors and bounded
  page sizes. Polling deduplicates stable IDs without discarding older loaded pages.
- Inbox polls every 5 seconds while visible, aborts/pauses on hidden tabs, resumes
  when visible, and backs off up to 60 seconds on errors. GET provider retries use
  exponential backoff; non-idempotent writes are never automatically retried.
- TmailCloud requests time out after 8 seconds per attempt; AMGratis writes allow
  25 seconds for email dispatch. Response size is
  bounded to 2 MB. Read-only TmailCloud requests follow at most three redirects
  within `https://tmailcloud.my.id` and `https://www.tmailcloud.my.id`, only when
  returned by the provider. HTTPS downgrade, arbitrary hosts, credential URLs,
  missing locations and loops are rejected. Writes and AMGratis redirects are
  never followed. No user-controlled URL can select the
  destination host.
- HTML uses DOMPurify allowlisting, no active links/forms/CSS URLs, a sandboxed
  iframe and restrictive CSP. Remote images are removed by default. Opting in
  allows only HTTPS images and warns about sender tracking.
- OTP and Alight Creative sender matches are candidates, not evidence that a
  sender or login link is trustworthy. Review remains explicit.
- `is_permanent` is not used to promise retention. D1 stores metadata, not an
  email backup. Provider message deletion/retention can make old bodies unavailable.
- Delete from History removes message/workflow/activity records, not the remote
  mailbox. The email tombstone prevents reassignment to another local user.
- Abandoned creating reservations become failed after five minutes on history
  access, permitting removal. Old rate-limit buckets can be periodically removed:
  `DELETE FROM am_rate_limits WHERE window_start < unixepoch() - 86400`.

## Verification

`npm test` includes actual local D1 integration tests using Miniflare: tenant
isolation, CSRF, domain validation, atomic quota, pagination, deduplication,
authorization expiry/signatures, explicit link consent, encrypted receipts and
uncertain provider outcomes. Email sanitation is tested in jsdom. Tests use
fixtures only in test files and do not contact or activate real provider accounts.

### Troubleshooting domain loading

A failed domain lookup is different from an empty active-domain list. The UI
shows "Could not load domains" on connection failure. GET failures no longer
suggest an email was generated: no write was attempted. Response error codes
separate `provider_timeout`, `provider_dns_failed`, `provider_tls_failed`,
`provider_unreachable` and rejected/looping redirects. These codes do not contain
provider response bodies, source message URLs or credentials. A lookup that
still cannot connect requires checking provider DNS, TLS, availability or whether
it permits Cloudflare Worker requests; the application never invents domains or
disables HTTPS verification to hide that failure.

While signed in, open `/api/am/domains` on the Avonera48 site to inspect the
current lookup result. Failed connections include a sanitized `diagnostic`
with service, method and failure class, and only recognized transport/platform
codes. HTTP rejections include their upstream status. Exception messages and
provider response bodies are not exposed. A browser successfully reaching the
provider confirms availability from that browser; it does not establish that the
provider permits requests from Cloudflare Workers.

### Workflow action readiness

`GET /api/am/status` includes `actions.send`, `actions.verify` and
`actions.apply`, each with `ready` and a nonsecret `reason`. The UI uses these
per-step checks instead of gating email requests on licensing rights. A disabled
magic-link button identifies missing provider credentials, a documented request
format or required receipt storage. API keys and contracts still have to be
configured from the actual provider documentation; no guessed request is sent.
