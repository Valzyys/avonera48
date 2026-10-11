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

Video in the room comes from the partner API (`worker/partner.ts`). Every call is signed on the server, so the credentials never reach the browser. Set them as secrets (Pages: Settings → Variables and Secrets):

```sh
npx wrangler secret put PARTNER_KEY_ID
npx wrangler secret put PARTNER_SECRET
npx wrangler secret put PARTNER_SERVER_IP   # the server IP registered with the partner
```

The partner checks that signed calls come from the registered IP. Cloudflare Workers and Pages have no fixed outbound IP. If the partner rejects calls with `SIGNATURE_REJECTED`, run the signed calls through a relay that has the registered IP, and point `PARTNER_API_BASE` at that relay.

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

Payments go through MYPG (QRIS), in `worker/payment.ts`. The server polls the gateway for the payment status while the pay page is open, so no webhook is needed. Set these as secrets or variables:

| Name | What it is |
| --- | --- |
| `MYPG_API_KEY` | MYPG API key (secret) |
| `ADMIN_EMAILS` | Comma-separated emails of accounts that may use `/dashboard/admin` |
| `MYPG_API_URL` | Optional. Overrides `https://yobasepay.net/api_my` |
| `SHOWS_API_URL` | Optional. Overrides the IDN Plus show listing URL |

Redeploy after adding bindings or secrets so the functions pick them up.

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
