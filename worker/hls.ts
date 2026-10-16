/* Pure HLS helpers (no Worker APIs), shared with the app's tests. */

/** Points every URI in an HLS playlist (lines and URI="…" attributes) back at the proxy. */
export function rewritePlaylist(text: string, base: string, wrap: (abs: string) => string) {
  return text
    .split("\n")
    .map((line) => {
      const t = line.trim();
      if (!t) return line;
      if (t.startsWith("#")) return line.replace(/URI="([^"]+)"/g, (_m, u: string) => `URI="${wrap(new URL(u, base).toString())}"`);
      return wrap(new URL(t, base).toString());
    })
    .join("\n");
}

/** Encrypt each distinct URI before serializing the rewritten playlist. */
export async function rewritePlaylistAsync(text: string, base: string, wrap: (abs: string) => Promise<string>) {
  const urls = new Map<string, string>();
  rewritePlaylist(text, base, (url) => { urls.set(url, ""); return url; });
  await Promise.all([...urls.keys()].map(async (url) => { urls.set(url, await wrap(url)); }));
  return rewritePlaylist(text, base, (url) => urls.get(url)!);
}
