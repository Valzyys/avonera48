import photos from "@/data/photos.json";

const LOCAL = photos as Record<string, string>;

/**
 * Image URL to use in the page. jkt48connect.com images go through the
 * Worker's /media proxy (same origin, cached for a year at the edge); in the
 * Vite dev server there is no Worker, so the original URL is kept.
 */
export function media(url: string | undefined | null): string | undefined {
  if (!url) return undefined;
  if (import.meta.env.DEV) return url;
  const m = /^https:\/\/jkt48connect\.com\/((?:api\/)?img\/.+)$/.exec(url);
  return m ? `/media/${m[1]}` : url;
}

/** A member photo bundled with the site (see scripts/fetch-photos.mjs), if any. */
export const localPhoto = (slug: string): string | undefined => LOCAL[slug];
