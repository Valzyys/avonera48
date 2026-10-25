/** Keep upstream addresses opaque to the browser and bind them to the viewer. */
export async function mediaUrls(secret: string, viewer: string) {
  const enc = new TextEncoder();
  const raw = await crypto.subtle.digest("SHA-256", enc.encode(`${secret}|room-media-url-v1`));
  const key = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
  const additionalData = enc.encode(viewer);
  // Reuse the *randomly encrypted* reference while it is hot. Generating a new
  // IV on every playlist refresh changes HLS key URLs and defeats URI-based
  // key/segment caches even though the upstream resource has not changed.
  const sealed = new Map<string, Promise<string>>();
  async function encrypt(url: string) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData }, key, enc.encode(url)));
    const bytes = new Uint8Array(iv.length + ciphertext.length);
    bytes.set(iv);
    bytes.set(ciphertext, iv.length);
    return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  return {
    async seal(url: string) {
      let pending = sealed.get(url);
      if (pending) sealed.delete(url); // LRU, including frequently reused keys
      else {
        pending = encrypt(url);
        void pending.catch(() => { if (sealed.get(url) === pending) sealed.delete(url); });
      }
      sealed.set(url, pending);
      if (sealed.size > 256) sealed.delete(sealed.keys().next().value!);
      return pending;
    },
    async open(value: string) {
      if (!/^[A-Za-z0-9_-]{39,16384}$/.test(value)) throw new Error("Invalid media reference");
      const bytes = Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
      const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.slice(0, 12), additionalData }, key, bytes.slice(12));
      return new TextDecoder().decode(plaintext);
    },
  };
}
