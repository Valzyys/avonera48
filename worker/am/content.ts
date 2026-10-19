import { Parser } from "htmlparser2";

export function extractContent(
  html: string | null,
  text: string | null,
  sender: string,
) {
  let plain = text ?? "";
  const urls = new Set<string>();
  let ignored = 0;
  let anchor: { url: string; text: string } | null = null;
  const authTextLinks = new Set<string>();
  const add = (raw: string) => {
    try {
      const u = new URL(raw);
      if (
        u.protocol === "https:" &&
        !u.username &&
        !u.password &&
        u.href.length <= 8000 &&
        urls.size < 30
      )
        urls.add(u.href);
    } catch {
      /* malformed URL */
    }
  };
  const parser = new Parser(
    {
      onopentag(name, attrs) {
        if (["script", "style"].includes(name)) ignored++;
        if (name === "a" && attrs.href) {
          add(attrs.href);
          anchor = { url: attrs.href, text: "" };
        }
      },
      onclosetag(name) {
        if (name === "a" && anchor) {
          if (
            /(?:sign[ -]?in|log[ -]?in|verify|verification|authenticate|magic link|masuk|verifikasi)/i.test(
              anchor.text,
            )
          ) {
            try {
              authTextLinks.add(new URL(anchor.url).href);
            } catch {
              /* not an absolute HTTPS link */
            }
          }
          anchor = null;
        }
        if (["script", "style"].includes(name))
          ignored = Math.max(0, ignored - 1);
        if (["p", "div", "br", "td"].includes(name)) plain += " ";
      },
      ontext(value) {
        if (!ignored) {
          plain += ` ${value}`;
          if (anchor) anchor.text += value;
        }
      },
    },
    { decodeEntities: true },
  );
  parser.write(html ?? "");
  parser.end();
  for (const match of plain.matchAll(/https:\/\/[^\s<>"']+/gi))
    add(match[0].replace(/[).,;]+$/, ""));
  const otps = new Set<string>();
  for (const match of plain.matchAll(
    /(?:\bOTP\b|verification\s+code|security\s+code|kode\s+(?:verifikasi|akses)|one[- ]time\s+(?:code|password))[\s\S]{0,45}?\b(\d{4,8})\b/gi,
  ))
    otps.add(match[1]);
  return {
    otps: [...otps],
    links: [...urls].map((url) => ({
      url,
      authentication:
        authTextLinks.has(url) ||
        /(?:auth|login|signin|sign-in|magic|verify|oobCode|token|mode=signIn)/i.test(
          url,
        ),
    })),
    alight_candidate:
      /alight\s*(?:creative|motion)|@(?:[a-z0-9-]+\.)?alightcreative\.com\b/i.test(
        sender,
      ),
  };
}
/** Persist previews, never bearer links or OTP values. Full content stays at the provider. */
export function metadataPreview(value: string) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/https?:\/\/[^\s<>]+/gi, "[link]")
    .replace(/\b\d{4,8}\b/g, "[code]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
}
