# Android application

The Flutter app `app.avonera48.mobile` uses this site's existing APIs. No second
user database, payment catalogue, entitlement store or partner credential is
embedded in the app.

- `/api/v1/*`: the same member, birthday, live, recent/detail, theater and news
  data the website reads. Relative media paths resolve on this site's origin.
- `/api/auth/*`: native sign-in, registration, profile, avatar, password and logout.
  The opaque `avn_session` cookie is held in Android Keystore-backed encrypted
  storage; passwords are not persisted.
- `/api/shop/*`: catalogue, shows, voucher checks, explicit checkout, order
  status and cancellation. The server calculates all prices and grants access.
- `/api/room/session` and `/api/room/media`: entitled native HLS playback. The
  player sends the viewer's session only to this exact HTTPS origin.
- `/api/room/:show/comments`: native chat with existing membership/ticket checks.
- `/api/link/jkt48connect/*`: authorization in the provider's browser, followed by
  native account preview and explicit confirmation. Pending codes are bound to
  the viewer by the existing backend.
- `/api/admin/*`: native administration, gated by the same server-side roles.

The native client supplies the exact site's `Origin` for JSON mutations and
does not follow API redirects with credentials. Existing browser CSRF, session,
role, ownership and entitlement checks stay in place.

`public/.well-known/assetlinks.json` associates the signed Android package with
the site. Android opens the `/dashboard/connect/jkt48connect` callback in the app
after provider approval. Its certificate fingerprint is public metadata, not a
signing key. Keep this association current when intentionally rotating signing
certificates. Existing web account-linking URLs remain valid.
