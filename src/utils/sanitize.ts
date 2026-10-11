import { media } from "./media";

/**
 * Allow-list HTML sanitiser for article bodies from the official site.
 * Keeps structure (paragraphs, lists, headings, tables), links and images in
 * their original positions; drops scripts, styles, inline styling and every
 * attribute that is not explicitly allowed.
 */
const KEEP = new Set(["P", "BR", "STRONG", "B", "EM", "I", "U", "A", "IMG", "UL", "OL", "LI", "H2", "H3", "H4", "BLOCKQUOTE", "TABLE", "THEAD", "TBODY", "TR", "TD", "TH", "FIGURE", "FIGCAPTION", "HR"]);
const DROP = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "FORM", "INPUT", "BUTTON", "SVG", "MATH", "LINK", "META", "NOSCRIPT", "TEMPLATE"]);
const RENAME: Record<string, string> = { H1: "h2", DIV: "p" };

const safeUrl = (v: string | null, img = false) => {
  if (!v) return null;
  try {
    const u = new URL(v, "https://jkt48.com/");
    if (u.protocol === "https:" || (!img && (u.protocol === "http:" || u.protocol === "mailto:"))) return u.toString();
  } catch {
    /* invalid URL */
  }
  return null;
};

function clean(node: Node, doc: Document): Node[] {
  if (node.nodeType === Node.TEXT_NODE) return [doc.createTextNode(node.textContent ?? "")];
  if (node.nodeType !== Node.ELEMENT_NODE) return [];
  const el = node as Element;
  const tag = el.tagName;
  if (DROP.has(tag)) return [];
  const children = [...el.childNodes].flatMap((c) => clean(c, doc));
  const name = RENAME[tag] ?? (KEEP.has(tag) ? tag.toLowerCase() : null);
  if (!name) return children; // unwrap (e.g. <span>, <font>)
  const out = doc.createElement(name);
  if (name === "a") {
    const href = safeUrl(el.getAttribute("href"));
    if (!href) return children;
    out.setAttribute("href", href);
    out.setAttribute("target", "_blank");
    out.setAttribute("rel", "noreferrer noopener");
  }
  if (name === "img") {
    const src = safeUrl(el.getAttribute("src"), true);
    if (!src) return [];
    out.setAttribute("src", media(src) ?? src);
    out.setAttribute("alt", el.getAttribute("alt") ?? "");
    out.setAttribute("loading", "lazy");
    out.setAttribute("decoding", "async");
    out.setAttribute("referrerpolicy", "no-referrer");
  }
  if ((name === "td" || name === "th") && el.getAttribute("colspan")) out.setAttribute("colspan", String(Number(el.getAttribute("colspan")) || 1));
  children.forEach((c) => out.appendChild(c));
  // Paragraphs that only held &nbsp; spacers add nothing.
  if (name === "p" && !out.querySelector("img") && !(out.textContent ?? "").replace(/\u00a0/g, "").trim()) return [];
  return [out];
}

export function sanitizeHtml(html: string): string {
  if (typeof DOMParser === "undefined") return "";
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  const out = doc.createElement("div");
  [...doc.body.childNodes].flatMap((c) => clean(c, doc)).forEach((n) => out.appendChild(n));
  return out.innerHTML;
}
