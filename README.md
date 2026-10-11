# avonera48
Unofficial JKT48 fan site — live streams, recent lives, theater schedule, members and news. React + Vite, served by a Cloudflare Worker.

## Data

The site reads its upstream data API through the Worker / Pages Functions (`worker/handlers.ts`), which adds the API key server-side, rewrites upstream image URLs to the same-origin `/media/*` proxy and caches responses at the edge. Set the key as a secret (the older name `JKT48CONNECT_API_KEY` still works):

```sh
npx wrangler secret put DATA_API_KEY
```

Without the key (or if the API can't be reached) the app falls back to a bundled snapshot in `src/data/snapshot/` and labels every page as sample data. Add `?source=snapshot` to any URL to force the snapshot.

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
