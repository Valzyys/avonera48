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
4. Set the required secrets and signed authorization for provider workflows.
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

The supplied documentation did **not** include JSON responses for inbox or
message detail. Those structures cannot be inferred from endpoint names.
AMGratis v1 request fields and success responses have now been documented and
are built into the backend (see below). There are no guessed production defaults
or production mock data. Generate and save mailboxes works independently of the
remaining adapters. Missing mappings return explicit setup errors, never an empty
inbox or fake success. Live endpoint access was unavailable in the implementation
environment; the integration tests use explicitly labeled test fixtures only.

### TMAIL_RESPONSE_MAP (Worker variable, JSON)

Configure this using captured, redacted provider responses. Paths are RFC 6901
JSON Pointers: `""` means the whole response/row, `/a/b` means nested fields,
`~1` escapes `/`, and `~0` escapes `~` in a field name.

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
npx wrangler secret put AM_AUTHORIZATION_GRANT
```

`AM_WORKFLOW_SECRET` must contain at least 32 high-entropy characters. Provider
receipts are encrypted at rest with AES-GCM and bound to their workflow ID. Full
email bodies, login links and OTPs are fetched on demand rather than persisted.
Previews redact URLs and numeric code candidates. No provider body, credential,
authentication link or receipt is written to activity logs.

An API key, user checkbox, administrative boolean or a third-party service name
is **not** proof of authority to authenticate accounts or grant Alight licenses.
To enable account verification and license activation, obtain a verifiable authorization from Alight Creative or
its independently verified authorized licensing authority. Configure:

- `AM_AUTHORIZATION_ISSUER`: exact trusted issuer URL.
- `AM_AUTHORIZATION_PUBLIC_KEY`: that authority's independently verified RSA
  public JWK (`kty`, `n`, `e`), obtained through its official channel.
- `AM_AUTHORIZATION_GRANT`: an RS256-signed JWT from that authority.

Do not self-sign a grant, use this project's test keys, or trust an unverified
key supplied with a token. Configuring a trust anchor is an operator responsibility;
this repository cannot establish legal licensing rights on the operator's behalf.
There is no built-in key or enabled bypass.

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
and activation stay locked. Do not bypass
this guard to make a third-party activation endpoint appear functional.

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

Each workflow mutation requires `consent:true, owns_account:true`. Verify also
requires `message_id` (local UUID) and `link_sha256`. The backend re-fetches that
owned message, matches the exact reviewed URL hash, checks its sender and host
against the signed grant, and only then submits it to the verification API. It
never follows, clicks or redeems authentication URLs directly.

Only a confirmed verification unlocks activation; only a confirmed activation
response marks the workflow `completed`. Authorization is rechecked at each
authentication or licensing step. Sending a sign-in email requires an owned
mailbox, a valid configured API key/send contract and explicit consent, but no
license grant. If the documented send response includes a receipt, the workflow
encryption secret is required before sending. Sending an email never unlocks
verification or activation. A database compare-and-swap and unique running-workflow index prevent
concurrent operations. A timeout/rejection after a provider write is conservatively
marked `uncertain`, without automatic retries or claims of success. Uncertain verification or licensing outcomes require operator reconciliation.
For an uncertain email-send step only, the user may check their inbox and approve
a new email after a one-minute cooldown, explicitly acknowledging that the prior
request may have succeeded. This never resets verification or licensing state.
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
