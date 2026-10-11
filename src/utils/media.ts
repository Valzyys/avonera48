import photos from "@/data/photos.json";

const LOCAL = photos as Record<string, string>;

/**
 * Image URL to use in the page. Upstream API images already arrive as
 * same-origin /media/… paths (the Worker rewrites them). Official-site
 * images (news bodies) go through the proxy too, which requests them with
 * jkt48.com as Origin/Referer.
 */
export function media(url: string | undefined | null): string | undefined {
  if (!url) return undefined;
  const o = /^https?:\/\/((?:[a-z0-9-]+\.)*jkt48\.com)\/(.+)$/i.exec(url);
  return o ? `/media/x/${o[1]}/${o[2]}` : url;
}

/** A member photo bundled with the site (see scripts/fetch-photos.mjs), if any. */
export const localPhoto = (slug: string): string | undefined => LOCAL[slug];

/** The original URL of an official-site image behind /media/x/… (when the proxy is unavailable). */
export function mediaOrigin(src: string): string | null {
  const x = /\/media\/x\/([^/]+)\/(.+)$/.exec(src);
  return x ? `https://${x[1]}/${x[2]}` : null;
}

/**
 * onError for <img>: first retry the original URL if the /media proxy
 * failed, then run `giveUp` (hide the image, show a fallback…).
 */
export function retryOrigin(img: HTMLImageElement, giveUp?: () => void) {
  const origin = !img.dataset.retried && mediaOrigin(img.src);
  if (origin) {
    img.dataset.retried = "1";
    img.src = origin;
  } else giveUp?.();
}
