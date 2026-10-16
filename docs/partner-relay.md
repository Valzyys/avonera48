# Same-origin playback proxy

The browser receives only `/api/room/media?t=...&r=...`. The `r` reference is
AES-GCM encrypted and authenticated for the viewer, rather than URL-encoding the
partner address in a readable `u` parameter. The server opens playback, retains
cookies and the play header, and rewrites playlist, key, initialization and
segment URIs into encrypted references. Resume also stays server side. A stale
player using `u` must reopen the room after updating.

This hides the partner address even when the Worker calls the partner directly.
A fixed-IP relay is additionally needed when the partner enforces a registered
source IP; hiding the address alone does not provide a stable outbound IP.

## Playback HTTP 404

A successful signed session call only confirms `/api/public/partner/v1/session`
works. Opening that session uses a separate route: `/api/partner/p/...`.
Playlists, keys and segments use `/api/partner/s/...`, and resume uses
`/api/partner/resume`. The relay must forward all of `/api/partner/` too.

The application's `playback_route_missing` currently means HTTP 404 while opening
playback. That can be the relay's own 404, an incorrectly constructed path, or a
404 returned by the partner. It does not by itself prove which server is missing
the route.

## Nginx relay

For a relay forwarding to `https://jkt48connect.com`, include
[`deploy/nginx/partner-media.conf`](../deploy/nginx/partner-media.conf) inside its
existing HTTPS `server {}`. Preserve the server's existing access restrictions.
If playback is hosted on another partner origin, use that verified origin in
`proxy_pass`, `Host`, and `proxy_ssl_name` instead. This configuration targets a
Debian/Ubuntu CA bundle path; adjust that path for other distributions.

The media location complements the existing signed API location; it does not
replace the relay's server configuration. On the relay host, validate and reload:

```sh
sudo nginx -t && sudo systemctl reload nginx
```

For this configuration, Worker variables use the relay origin:

```text
PARTNER_API_BASE=https://relay.example.com
PARTNER_MEDIA_BASE=https://relay.example.com
```

Replace the example host with the real relay host. Do not append
`/api/public/partner/v1`, `/api/partner`, `/session` or a playback token. The Worker
appends the complete partner path. For example:

```text
https://relay.example.com + /api/partner/p/<token>
```

If the existing API relay uses a prefix such as `/forward`, preserve
`PARTNER_API_BASE` and set `PARTNER_MEDIA_BASE` to the origin serving the new media
location. Both must exit through the partner's registered IP.

## Verify the result

Create a fresh room session after reloading the relay. One-time playback URLs
must not be reused. The provided media location passes through redirects,
`Set-Cookie`, range responses and query strings without rewriting the media path.
It adds `X-Avonera-Upstream-Status` so Worker logs can distinguish an upstream 404
from an unhandled relay route. No response header or log needs the playback token.

If it still fails, inspect the relay's actual media origin, the two Worker base
settings, and its route configuration. A forwarded partner 404 requires checking
the fresh playback URL's origin/path against the partner contract.
