# Prompt Lovable: hubungkan akun JKT48Connect ↔ Avonera48

Salin seluruh blok **PROMPT** di bawah ke Lovable (project JKT48Connect). Sebelum itu siapkan dua hal:

1. Buat satu secret acak yang panjang, misalnya dengan `openssl rand -hex 32`. Nilai yang **sama** dipasang di dua tempat:
   - Avonera48 (Cloudflare Pages → Settings → Variables and Secrets, tipe *Secret*): `JKT48CONNECT_LINK_SECRET`
   - Lovable / Supabase (Project → Edge Functions → Secrets): `AVONERA_LINK_SECRET`
2. Variabel lain di Avonera48 (Pages):
   - `JKT48CONNECT_APP_URL`: alamat app JKT48Connect, misalnya `https://jkt48connect.com`. Avonera mengirim user ke `<APP_URL>/connect/avonera`.
   - `JKT48CONNECT_SYNC_URL` (opsional, untuk tombol "Sync now" dan kabar unlink): URL edge function `avonera-sync` setelah dideploy, misalnya `https://<project>.supabase.co/functions/v1/avonera-sync`.

Jangan pernah menaruh secret di kode, di repo, atau di kode frontend.

---

## PROMPT

```
Add an "Avonera48" account-link integration to this app (JKT48Connect). Avonera48 (https://avonera48.id) is a partner site that sells JKT48 theater show streams. When a JKT48Connect user links their Avonera48 account, their JKT48Connect membership must count as an Avonera48 membership, kept in sync. Avonera48 already has the API; build only the JKT48Connect side described here. Keep the app's existing look, language and auth.

## Secrets / config (Supabase Edge Function secrets, never in client code)
- AVONERA_LINK_SECRET: shared HMAC secret (already set by me).
- AVONERA_BASE_URL: https://avonera48.id (allow overriding to https://test.avonera48.id).

## Signing (every server-to-server call, both directions)
Headers:
  x-avonera-timestamp: <unix seconds, string>
  x-avonera-signature: sha256=<lowercase hex HMAC-SHA256(AVONERA_LINK_SECRET, `${timestamp}.${rawBody}`)>
Body is JSON (content-type: application/json). Sign the exact raw string you send. Requests more than 5 minutes off are refused. Put this in a shared Deno helper `supabase/functions/_shared/avonera.ts`:

  const enc = new TextEncoder();
  async function key() {
    return crypto.subtle.importKey("raw", enc.encode(Deno.env.get("AVONERA_LINK_SECRET")!), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
  }
  export async function avoneraCall(path: string, payload: unknown) {
    const raw = JSON.stringify(payload);
    const ts = String(Math.floor(Date.now() / 1000));
    const sig = [...new Uint8Array(await crypto.subtle.sign("HMAC", await key(), enc.encode(`${ts}.${raw}`)))].map((b) => b.toString(16).padStart(2, "0")).join("");
    const base = Deno.env.get("AVONERA_BASE_URL") ?? "https://avonera48.id";
    const res = await fetch(`${base}/api/integrations/jkt48connect/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-avonera-timestamp": ts, "x-avonera-signature": `sha256=${sig}` },
      body: raw,
    });
    return { status: res.status, data: await res.json().catch(() => null) };
  }
  // For requests Avonera48 sends to us: returns the parsed body or null.
  export async function verifyAvonera(req: Request) {
    const ts = req.headers.get("x-avonera-timestamp") ?? "";
    const m = /^sha256=([a-f0-9]{64})$/.exec(req.headers.get("x-avonera-signature") ?? "");
    if (!m || !/^\d+$/.test(ts) || Math.abs(Date.now() / 1000 - Number(ts)) > 300) return null;
    const raw = await req.text();
    const sig = new Uint8Array(m[1].match(/../g)!.map((h) => parseInt(h, 16)));
    if (!(await crypto.subtle.verify("HMAC", await key(), sig, enc.encode(`${ts}.${raw}`)))) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }

## Data sent to Avonera48
account:    { id: <our user id, stable, string>, email, name: <display name>, avatar_url: <https URL or null> }
membership: { plan_id, plan_name, expires_at: <ISO 8601> } for the user's CURRENT ACTIVE membership, or null when there is none / it ended.
Read the membership from this app's existing membership/subscription data (find the table that stores the user's plan and its end date; use the latest active one). If a membership has no end date, send the end of the current billing period.

## Avonera48 endpoints (all POST, all signed)
- /grant       { state, account, membership } → { ok, code, redirect_url }   (404 "expired" if the state is old)
- /membership  { account_id, membership, account? } → { ok, linked, membership }   (linked:false if that user isn't linked)
- /status      { account_id } → { ok, linked, linked_at, synced_at, membership }
- /unlink      { account_id } → { ok, linked:false }

## Database (migration)
Table public.avonera_links:
  user_id uuid primary key references auth.users on delete cascade,
  linked boolean not null default false,
  linked_at timestamptz, last_synced_at timestamptz, last_error text,
  updated_at timestamptz not null default now()
RLS: a user can SELECT only their own row; only edge functions (service role) write.

## Edge functions
1. avonera-grant (verify_jwt = true). Input { state }. Validate state is 48 hex chars. Load the caller's profile and active membership server-side (never trust the client for these). Call avoneraCall("grant", { state, account, membership }). On ok, upsert avonera_links (linked=true, linked_at=now, last_synced_at=now) and return { redirect_url } exactly as Avonera48 gave it. Otherwise return the error message.
2. avonera-status (verify_jwt = true). Calls /status with the caller's id, updates avonera_links.linked to match, returns { linked, linked_at, membership }.
3. avonera-unlink (verify_jwt = true). Calls /unlink with the caller's id, sets linked=false.
4. avonera-push (verify_jwt = false, but require header `authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>` or call it only from SQL/cron). Input { user_id } or { all: true }. For each linked user, send /membership with their current membership (and account, so name/photo stay fresh). If Avonera replies linked:false, set linked=false. Store errors in last_error. Call it:
   - right after any membership is created, renewed, upgraded, cancelled, revoked or expires (from the code paths that change memberships, or a Postgres trigger on the membership table using pg_net → this function),
   - and from a daily pg_cron job with { all: true } as a safety net (memberships that simply run out).
5. avonera-sync (verify_jwt = false, PUBLIC, called by Avonera48). Verify with verifyAvonera(req); 401 if null. Body { action, account_id }.
   - action "membership": if avonera_links for account_id is linked, return { ok: true, linked: true, membership } (current active membership or null); else { ok: true, linked: false }.
   - action "unlinked": set linked=false for that user; return { ok: true }.
   Give me this function's URL when deployed (I put it into Avonera48 as JKT48CONNECT_SYNC_URL).

## Pages / UI
A. Route /connect/avonera (query: state, redirect_uri, app=avonera48).
   - If not signed in: send to login and come back to this exact URL afterwards.
   - Consent card: Avonera48 logo/name and our user's avatar+name with a link icon between; text "Avonera48 wants to link to your JKT48Connect account"; list what is shared: name, email, photo, membership status and end date; show the user's current membership (or "No active membership – it will sync automatically when you get one").
   - Buttons "Allow and continue" and "Cancel".
   - Allow → call avonera-grant with { state } → on success window.location.href = redirect_url (the one returned by the function; NEVER the redirect_uri from the query string). If it fails with "expired", show "This request expired. Go back to Avonera48 and start again." with a button to https://avonera48.id/dashboard/profile.
   - Cancel → go to `${redirect_uri}?error=access_denied` ONLY if redirect_uri starts with https://avonera48.id/ or https://test.avonera48.id/; otherwise go home.
   - Loading and error states; works on mobile.
B. Settings / Account page: a "Connected apps" card for Avonera48.
   - Uses avonera-status. Not linked: short explanation + button "Link Avonera48" that opens https://avonera48.id/dashboard/connect/jkt48connect (the user signs in there and the flow starts from Avonera48).
   - Linked: "Linked" badge, linked date, membership shown on Avonera48, "Sync now" (calls avonera-push for the current user, then refreshes status) and "Unlink" with a confirm dialog (calls avonera-unlink).
C. Optionally on the membership page: a small note "Also active on Avonera48" when linked.

## Rules
- AVONERA_LINK_SECRET and the service-role key stay in edge functions only. No signing in the browser.
- All membership data sent to Avonera48 comes from the database, server-side.
- Show friendly messages for network errors; log details server-side only.

## Test it
1. On avonera48.id → Profile → "Link account" → lands on /connect/avonera with a state → Allow → back on Avonera48's confirm page showing both accounts and the membership → Confirm.
2. Change/renew the membership here → within seconds Avonera48 shows the new end date.
3. Unlink here → Avonera48 profile shows "Not linked". Unlink on Avonera48 → our card shows not linked after the next status check.
```

---

## Ringkasan alur (untuk referensi)

```
Avonera48 Profile ──"Link account"──► POST /api/link/jkt48connect/start  (state, 10 menit)
        │
        ▼
JKT48Connect /connect/avonera?state=…  (user klik Allow)
        │  edge function avonera-grant ──signed──► POST /api/integrations/jkt48connect/grant
        │                                         ◄── { code, redirect_url }
        ▼
Avonera48 /dashboard/connect/jkt48connect?code=…  (UI konfirmasi sync)
        │  "Confirm and sync" ──► POST /api/link/jkt48connect/confirm
        ▼
Terhubung. Setiap perubahan membership:
JKT48Connect avonera-push ──signed──► POST /api/integrations/jkt48connect/membership
Avonera "Sync now" ──signed──► JKT48Connect avonera-sync { action: "membership" }
```

Membership dari JKT48Connect **tidak menimpa** membership yang dibeli di Avonera48. Avonera memakai yang berakhir paling lama. Saat unlink, hanya membership JKT48Connect yang hilang; tiket dan membership yang dibeli tetap.
