#!/usr/bin/env node
/**
 * Downloads every member photo from the upstream data API into
 * public/photos/ and writes src/data/photos.json, so the site serves the
 * photos as its own static assets (no third-party request, instant load).
 *
 *   DATA_API_KEY=... npm run photos     (JKT48CONNECT_API_KEY also works)
 *
 * The key is read from the environment or from .dev.vars; it is never
 * written anywhere. Commit public/photos/ and src/data/photos.json after.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const outDir = path.join(root, "public", "photos");
const manifestPath = path.join(root, "src", "data", "photos.json");

async function apiKey() {
  const env = process.env.DATA_API_KEY || process.env.JKT48CONNECT_API_KEY;
  if (env) return env;
  const vars = path.join(root, ".dev.vars");
  if (existsSync(vars)) {
    const m = /^(?:DATA_API_KEY|JKT48CONNECT_API_KEY)\s*=\s*"?([^"\n]+)"?/m.exec(await readFile(vars, "utf8"));
    if (m) return m[1].trim();
  }
  throw new Error("Set DATA_API_KEY (environment or .dev.vars).");
}

const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" };

async function download(url, file, tries = 3) {
  for (let k = 1; k <= tries; k++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const type = (res.headers.get("content-type") ?? "").split(";")[0];
      const ext = EXT[type];
      if (!ext) throw new Error(`not an image (${type || "no type"})`);
      const name = `${file}.${ext}`;
      await writeFile(path.join(outDir, name), Buffer.from(await res.arrayBuffer()));
      return name;
    } catch (e) {
      if (k === tries) throw e;
      await new Promise((r) => setTimeout(r, 500 * k));
    }
  }
}

const key = await apiKey();
const res = await fetch("https://jkt48connect.com/api/v1/members", { headers: { "x-api-key": key, accept: "application/json" } });
if (!res.ok) throw new Error(`/api/v1/members → HTTP ${res.status}`);
const members = (await res.json()).data ?? [];
await mkdir(outDir, { recursive: true });

const manifest = {};
let ok = 0;
const queue = members.filter((m) => m.img && m.url_key);
const worker = async () => {
  for (let m = queue.shift(); m; m = queue.shift()) {
    const slug = String(m.url_key).toLowerCase().replace(/[^a-z0-9-]/g, "-");
    try {
      const file = await download(m.img, slug);
      manifest[m.url_key] = `/photos/${file}`;
      ok++;
      process.stdout.write(`✓ ${m.url_key}\n`);
    } catch (e) {
      process.stdout.write(`✗ ${m.url_key}: ${e.message}\n`);
    }
  }
};
await Promise.all(Array.from({ length: 6 }, worker));

const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
await writeFile(manifestPath, `${JSON.stringify(sorted, null, 2)}\n`);
console.log(`\n${ok}/${members.length} photos saved to public/photos/, manifest written to src/data/photos.json`);
