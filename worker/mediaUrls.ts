/** Keep upstream addresses opaque to the browser and bind them to the viewer. */
export async function mediaUrls(secret: string, viewer: string) {
  const enc = new TextEncoder();
  const raw = await crypto.subtle.digest("SHA-256", enc.encode(`${secret}|room-media-url-v1`));
  const key = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
  const additionalData = enc.encode(viewer);
  return {
    async seal(url: string) {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData }, key, enc.encode(url)));
      const bytes = new Uint8Array(iv.length + ciphertext.length);
      bytes.set(iv);
      bytes.set(ciphertext, iv.length);
      return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    },
    async open(value: string) {
      if (!/^[A-Za-z0-9_-]{39,16384}$/.test(value)) throw new Error("Invalid media reference");
      const bytes = Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
      const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.slice(0, 12), additionalData }, key, bytes.slice(12));
      return new TextDecoder().decode(plaintext);
    },
  };
}
