# avonera48
Unofficial JKT48 fan site — live streams, recent lives, theater schedule, members and news. React + Vite, served by a Cloudflare Worker.

## Data

The site reads the [jkt48connect.com](https://jkt48connect.com) API through the Worker (`worker/index.ts`), which adds the API key server-side and caches responses at the edge. Set the key as a secret:

```sh
npx wrangler secret put JKT48CONNECT_API_KEY
```

Without the key (or if the API can't be reached) the app falls back to a bundled snapshot in `src/data/snapshot/` and labels every page as sample data. Add `?source=snapshot` to any URL to force the snapshot.

## Scripts

- `npm run dev` — Vite dev server (no Worker, so it uses the snapshot)
- `npm run preview` — build and run with `wrangler dev` (put the key in `.dev.vars` as `JKT48CONNECT_API_KEY=...`)
- `npm run deploy` — build and deploy
- `npm run typecheck`, `npm run lint`, `npm test`

## Member photos as local assets

Photos load fastest when they ship with the site. Download them once (and again whenever members change), then commit the result:

```sh
JKT48CONNECT_API_KEY=jk48c_... npm run photos
git add public/photos src/data/photos.json
```

Members without a local photo fall back to the API image, served through the Worker's `/media/*` proxy and cached for a year.
