import DOMPurify from "dompurify";

/** Email is inert: no forms, navigation, scripts, CSS URLs or tracking pixels. */
export function emailDocument(html: string, images: boolean) {
  const safe = DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: [
      "style",
      "script",
      "form",
      "input",
      "button",
      "textarea",
      "select",
      "iframe",
      "object",
      "embed",
      "video",
      "audio",
      "source",
      "link",
      "meta",
      "base",
      ...(images ? [] : ["img"]),
    ],
    FORBID_ATTR: [
      "style",
      "href",
      "srcset",
      "action",
      "formaction",
      "background",
      "ping",
      "target",
      "id",
      "name",
    ],
    ALLOW_DATA_ATTR: false,
  });
  const doc = new DOMParser().parseFromString(safe, "text/html");
  for (const img of doc.querySelectorAll("img")) {
    try {
      const url = new URL(img.getAttribute("src") ?? "");
      if (url.protocol !== "https:") {
        img.remove();
        continue;
      }
    } catch {
      img.remove();
      continue;
    }
    img.setAttribute("referrerpolicy", "no-referrer");
    img.setAttribute("loading", "lazy");
  }
  const csp = `default-src 'none'; img-src ${images ? "https:" : "'none'"}; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'`;
  return `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="${csp}"><meta name="referrer" content="no-referrer"><style>body{font:14px/1.65 system-ui,sans-serif;color:#e5e7eb;background:#131619;margin:20px;overflow-wrap:anywhere}table{max-width:100%}img{max-width:100%;height:auto}pre{white-space:pre-wrap}a{color:#9ce5c8}</style></head><body>${doc.body.innerHTML}</body></html>`;
}
