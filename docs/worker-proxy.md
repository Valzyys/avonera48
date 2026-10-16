# Worker playback proxy

The existing site Worker handles the entire theater playback flow:

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

Cloudflare Workers do not guarantee a fixed outbound IP. This implementation
keeps all requests inside the site's Worker, but the partner must permit Worker
requests for its registered-IP and viewer-network checks. `PARTNER_SERVER_IP`
is a signing input; setting it does not change the Worker's source IP. If the
partner enforces a fixed source IP, that policy needs support for Worker access
on the partner side. Browser fallback would expose the partner address and use a
different network, so playback stays in the Worker.
