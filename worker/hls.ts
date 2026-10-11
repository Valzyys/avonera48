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
