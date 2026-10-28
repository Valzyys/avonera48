# avonera48
Unofficial JKT48 fan site — live streams, recent lives, theater schedule, members and news. React + Vite, served by a Cloudflare Worker.

## Data

The site reads its upstream data API through the Worker / Pages Functions (`worker/handlers.ts`), which adds the API key server-side, rewrites upstream image URLs to the same-origin `/media/*` proxy and caches responses at the edge. Set the key as a secret (the older name `JKT48CONNECT_API_KEY` still works):

```sh
npx wrangler secret put DATA_API_KEY
```

Without the key (or if the API can't be reached) the app falls back to a bundled snapshot in `src/data/snapshot/` and labels every page as sample data. Add `?source=snapshot` to any URL to force the snapshot.

## Accounts and the theater room

`/login` and `/register` create accounts. `/dashboard` is the members' theater room. Accounts live in a KV namespace bound as `AUTH`:

- Passwords are stored as salted PBKDF2-SHA256 hashes.
- Sessions use an HttpOnly, Secure cookie.

Create the namespace:

```sh
npx wrangler kv namespace create AUTH
```

Then bind it:

- **Worker:** already bound in `wrangler.jsonc` (`kv_namespaces`).
- **Pages:** Settings → Bindings → KV namespace, variable name `AUTH`. Pages does not read `wrangler.jsonc` (it is the Worker's config), so Pages bindings are set in the dashboard.

Video now uses the server-side stream proxy (`worker/streamProxy.ts`). `STREAM_PROXY_BASE` points to the upstream; the browser receives only encrypted `/api/room/media?r=…` references on this site's domain. Ticket/membership checks remain mandatory. There is no upstream partner session or playback exchange on this path.

Set `STREAM_MEDIA_SECRET` as a Worker secret for AES-GCM references. Existing deployments can reuse their private `PARTNER_SECRET` with separate cryptographic domain separation. `STREAM_PROXY_KEY` is optional if the upstream requires an API key; it is forwarded only server-to-server.

The legacy partner path remains available only when `STREAM_PROXY_BASE` is not configured. Its secrets are:

```sh
npx wrangler secret put PARTNER_KEY_ID
npx wrangler secret put PARTNER_SECRET
npx wrangler secret put PARTNER_SERVER_IP   # the server IP registered with the partner
```

Media references are authenticated AES-GCM ciphertext bound to the exact HttpOnly login cookie and user agent. Resource references expire after 10–15 minutes; the root capability lasts up to six hours and still needs valid authentication/entitlement. Logout/browser changes reject copied URLs. Every playlist URI is rewritten, and upstream session metadata is removed. Shared upstream playlist caching happens only on the server, after authorization; client responses remain private and uncached. Binary bodies stream without buffering the complete segment.

The playback URL must be visible to a browser that plays it. These controls stop a copied URL from working without its original authorized session; they do not prevent an authorized viewer from copying their cookies or recording the video. The upstream itself must restrict direct access if it should accept only server traffic. See [Worker playback proxy](docs/worker-proxy.md) for details.

## Tickets, memberships and payments

Shows are sold. A viewer can watch a show with a ticket for that show or with an active membership. Admins can always watch.

The shows on sale, and whether one is live, come from the IDN Plus listing (`worker/stage.ts`, cached for a minute). Only the title, schedule, image, team, birthday and live status are used. The listing's playback URL is dropped on the server; the picture always comes from the partner room above. The team and lineup are filled in from the site's theater schedule when a show there starts at the same time.

Orders, tickets, memberships, prices, vouchers and the room's chat live in a D1 database bound as `DB`. The tables are created on first use, so there is no migration step. A fresh database starts with these prices, which admins can change at `/dashboard/admin`:

- Rp 5.000 per show.
- Memberships: Weekly Rp 10.000, Monthly Rp 20.000, Yearly Rp 120.000.

Create the database:

```sh
npx wrangler d1 create avonera48
```

Then bind it:

- **Worker:** already bound in `wrangler.jsonc` (`d1_databases`).
- **Pages:** Settings → Bindings → D1 database, variable name `DB`.

Payments are QRIS, in `worker/payment.ts`, through Gateway V2 (dynamic QRIS: the amount to pay includes a unique code). The server polls the gateway for the status while the pay page is open, so no webhook is needed. Orders made earlier through MYPG are still checked and cancelled on MYPG (V2 references start with `GIV2-`). Set these as secrets or variables:

| Name | |
| --- | --- |
| `PAYMENT_V2_API_KEY` | Gateway V2 API key, `GIV2-…` (secret). New payments use V2 when it is set |
| `PAYMENT_V2_URL` | Optional. Overrides `https://v5.jkt48connect.com` |
| `MYPG_API_KEY` | Optional. The older MYPG key (secret): needed only for MYPG orders still pending, or as the gateway when no V2 key is set |
| `MYPG_API_URL` | Optional. Overrides `https://yobasepay.net/api_my` |

## Linking a JKT48Connect account

Members can link their JKT48Connect account (Profile → Linked accounts). While linked, its membership opens every show here too; a membership bought here is never changed, and the one that runs longer counts. The flow, the endpoints and the request signing are in `worker/link.ts`; the prompt for building the JKT48Connect (Lovable) side is in `docs/lovable-jkt48connect-link.md`.

| Name | |
| --- | --- |
| `JKT48CONNECT_LINK_SECRET` | Shared HMAC secret (secret). The same value goes into JKT48Connect as `AVONERA_LINK_SECRET` |
| `JKT48CONNECT_APP_URL` | JKT48Connect's address, e.g. `https://jkt48connect.com` (its `/connect/avonera` page) |
| `JKT48CONNECT_SYNC_URL` | Optional. JKT48Connect's `avonera-sync` function, for "Sync now" and unlink notices |

## Scripts

- `npm run dev` — Vite dev server (no Worker, so it uses the snapshot)
- `npm run preview` — build and run with `wrangler dev` (put the key in `.dev.vars` as `DATA_API_KEY=...`)
- `npm run deploy` — build and deploy
- `npm run typecheck`, `npm run lint`, `npm test`

## Member photos as local assets

Photos load fastest when they ship with the site. Download them once (and again whenever members change), then commit the result:

```sh
DATA_API_KEY=... npm run photos
git add public/photos src/data/photos.json
```

Members without a local photo fall back to the API image, served through the Worker's `/media/*` proxy and cached for a year.

## AM account dashboard

`/am` adds private generated mailboxes, saved account history, an inbox reader and
explicitly approved provider workflows using the existing auth and D1 bindings.
AM tables are initialized automatically on first authenticated access; an additive migration is also provided. See [AM setup, response adapters,
authorization and deployment](docs/am-dashboard.md). Account verification and license activation stay
locked without verified authorization; undocumented response formats produce
configuration errors instead of mock inboxes or fake success.

## Workers Builds deployment

Use `npm run deploy` as the **Deploy command** in Cloudflare Workers → avonera48
→ Settings → Build. The **Build command** can be left empty: Wrangler's existing
`build.command` already runs `npm run build`. With both configured, the same Vite
build runs twice. A dashboard deploy command of `npx wrangler deploy` bypasses the
repository's deployment wrapper and must be changed to use it.

The wrapper uses the installed, lockfile-pinned Wrangler and retries at most twice
(after 15 and 30 seconds) for the specific `assets-upload-session` unknown API error
`10013` seen before Worker upload. It preserves failures after the final attempt;
other build, authentication, configuration and Worker validation errors are not
retried. There is no claim that every `10013` is transient. If this particular
asset initialization failure persists, inspect Cloudflare service status and
contact support with the failed build log. It is a server/API failure, not the
Vite large-chunk warning. No tokens, bindings or routes need to change for this
wrapper. Successful live deployment still requires Cloudflare credentials in CI.

Local deployment packaging check (without upload):

```sh
npm run deploy -- --dry-run --outdir /tmp/avonera48-worker-dry-run
```
