# Worker playback proxy

## Current direct proxy path

When `STREAM_PROXY_BASE` is configured, `worker/streamProxy.ts` handles theater playback. The old partner flow below is disabled for new sessions. The upstream's static `/stream.m3u8` resolves the current live internally; the site's product slug remains the viewer's entitlement, not a replacement for that upstream static slug.

`POST /api/room/session` authorizes the login and ticket/membership, then returns an encrypted same-origin capability without making a partner request, exchanging playback credentials, or writing playback context to KV. `STREAM_MEDIA_SECRET` (or a domain-separated derivation of the existing private `PARTNER_SECRET`) encrypts references. Cookie and user-agent binding prevents replay in a different login/browser. The root lasts up to six hours, with fresh authentication and entitlement checks amortized over 15 seconds. Child resource references expire within 10–15 minutes. URLs for identical resources remain stable within five-minute buckets to preserve HLS key/init caching.

Playlists, keys and segments are fetched only from the configured HTTPS origin and approved `/stream`, `/stream.m3u8`, `/s/*` routes. Redirects stay on that origin. Upstream credentials, cookies, error bodies, server IP/session metadata and source URLs are not returned to the browser. Shared root-playlist cache entries are server-only and revalidated after three seconds when an execution context is available; they expire after 30 seconds. Browser responses remain `private, no-store`. Video/range bodies stream directly and never wait for the whole segment to download.

The player starts on the lowest rendition and lets ABR rise, retains a larger forward buffer, caps quality to player size, and reduces Auto quality on decoder/FPS pressure. HLS is downloaded in parallel with local room authorization. These controls reduce avoidable loading/rebuffering; they cannot fix a slow upstream, insufficient viewer bandwidth or every decoder limitation.

This is session-bound access control, not DRM. An authorized viewer necessarily receives playable media and may record it or export their session cookies. A public upstream must enforce its own server authentication to prevent direct access outside this website. No changes to the upstream server or other VPS services are made by this migration.

## Legacy partner flow (only without STREAM_PROXY_BASE)

The existing site Worker handles the entire theater playback flow. Playback,
media and resume forward the site origin and origin-only Referer, derived from
the authenticated room request URL, for the partner's registered-domain checks.
They never substitute the partner's own domain as the caller.

The flow:

1. Sign calls to `https://jkt48connect.com/api/public/partner/v1/*` using the
   configured partner key, secret and registered server IP.
2. Open the exact one-time `playback_url` from the signed session response.
3. Keep the returned cookies and `X-Play-Key` server side in the playback context.
4. Return only `/api/room/media?t=...&r=...` URLs to the browser. Media references
   are AES-GCM encrypted and authenticated for the viewer.
5. Fetch playlists, keys, initialization files and segments directly from the
   partner, rewriting playlist URIs into encrypted same-origin references.
6. On media HTTP 401/403, resume once server side, retain updated cookies and
   rotate the play header before retrying. HTTP 404 does not trigger resume.

No additional server is needed. The former `PARTNER_API_BASE` and
`PARTNER_MEDIA_BASE` variables are ignored, including in existing deployments.
Saved playback contexts from older versions cannot reroute requests through an
external relay. No partner credentials or source URL are returned to the player.

## Deployment

Use the existing `AUTH` KV binding and these Worker secrets:

- `PARTNER_KEY_ID`
- `PARTNER_SECRET`
- `PARTNER_SERVER_IP`: the value registered with the partner for request signing

Deploy the Worker and reopen the room to obtain fresh media references. Old
player URLs using a readable `u` parameter are rejected.

## Partner responses

`playback_not_found` means the exact partner playback URL returned HTTP 404.
`playback_invalid_response` means the partner returned HTML or incomplete JSON.
`playback_refused` means another HTTP rejection, and `playback_unreachable`
means a network or redirect failure. Logs record statuses without playback URLs,
cookies or signing secrets.

When an authenticated admin opens a room, playback failures include a
`diagnostic` object with `stage`, `upstream_status`, `response_kind` and
`partner_code` (only documented partner codes). Normal viewers receive no
diagnostic object. Response bodies, upstream URLs, tokens, cookies and raw partner
messages are never included. `playback_origin_not_allowed` identifies a partner
`ORIGIN_NOT_ALLOWED` rejection; `playback_binding_mismatch` identifies
`SESSION_BINDING_MISMATCH`. An HTML 404 is different from a JSON rejection and
needs the partner's route/deployment checked against its documentation.

Cloudflare Workers do not guarantee a fixed outbound IP. This implementation
keeps all requests inside the site's Worker, but the partner must permit Worker
requests for its registered-IP and viewer-network checks. `PARTNER_SERVER_IP`
is a signing input; setting it does not change the Worker's source IP. If the
partner enforces a fixed source IP, that policy needs support for Worker access
on the partner side. Browser fallback would expose the partner address and use a
different network, so playback stays in the Worker.
