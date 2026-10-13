import { useEffect, useState } from "react";
import { Button, Icon } from "@/components/ui";
import { useDash } from "@/layouts/DashboardLayout";
import { formatDate, formatDateTime } from "@/utils/format";
import { ApiError, link, type AccountLink, type LinkedAccount } from "./api";

/** The JKT48Connect side of a link: its photo (or initial) on the brand tile. */
export function JktAvatar({ account, size = 44 }: { account: Pick<LinkedAccount, "name" | "avatar"> | null; size?: number }) {
  const [broken, setBroken] = useState(false);
  return (
    <span className="jkt-avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }} aria-hidden>
      {account?.avatar && !broken ? <img src={account.avatar} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} /> : (account?.name[0] ?? "J").toUpperCase()}
      <i className="jkt-avatar__mark">J</i>
    </span>
  );
}

/** Profile panel: the linked JKT48Connect account, with sync and unlink; or a button to link one. */
export function LinkedAccountPanel() {
  const { reloadCatalog } = useDash();
  const [state, setState] = useState<{ available: boolean; syncable: boolean; link: AccountLink | null } | null>(null);
  const [busy, setBusy] = useState<"start" | "sync" | "unlink" | null>(null);
  const [confirmUnlink, setConfirmUnlink] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    link.get().then(setState, () => setState({ available: false, syncable: false, link: null }));
  }, []);

  const run = async (kind: "start" | "sync" | "unlink") => {
    setBusy(kind);
    setMsg(null);
    try {
      if (kind === "start") {
        window.location.assign(await link.start());
        return;
      }
      if (kind === "sync") {
        const l = await link.sync();
        setState((s) => s && { ...s, link: l });
        setMsg({ ok: true, text: l ? "Synced with JKT48Connect." : "JKT48Connect no longer has this link, so it was removed." });
      } else {
        await link.unlink();
        setState((s) => s && { ...s, link: null });
        setConfirmUnlink(false);
        setMsg({ ok: true, text: "Unlinked. A membership bought here stays as it is." });
      }
      reloadCatalog();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof ApiError ? err.message : "Something went wrong. Try again." });
    }
    setBusy(null);
  };

  const l = state?.link;
  return (
    <section className="dash-panel link-panel" aria-label="Linked accounts">
      <div className="link-panel__head">
        <div>
          <h2 className="dash-panel__title">Linked accounts</h2>
          <p className="meta">Link your JKT48Connect account and its membership opens every show here too, kept in sync automatically.</p>
        </div>
      </div>

      <div className={`link-row${l ? " is-linked" : ""}`}>
        <JktAvatar account={l?.account ?? null} />
        <div className="link-row__body">
          <span className="link-row__name">
            JKT48Connect
            {l && (
              <span className="chip chip--ok">
                <Icon name="check" size={12} /> Linked
              </span>
            )}
          </span>
          {!state ? (
            <span className="meta">Checking…</span>
          ) : l ? (
            <>
              <span className="meta">
                {l.account.name}
                {l.account.email ? ` · ${l.account.email}` : ""}
              </span>
              <span className="link-row__pass">
                {l.membership ? (
                  <>
                    <Icon name="ticket" size={13} /> {l.membership.plan_name} · until {formatDate(l.membership.expires_at)}
                  </>
                ) : (
                  "No active membership on that account"
                )}
              </span>
              <span className="meta link-row__sync">Last synced {formatDateTime(l.synced_at)}</span>
            </>
          ) : (
            <span className="meta">{state.available ? "Not linked" : "Linking isn’t available yet."}</span>
          )}
        </div>
        <div className="link-row__actions">
          {l ? (
            <>
              {state?.syncable && (
                <Button size="sm" variant="secondary" icon="refresh" loading={busy === "sync"} onClick={() => run("sync")}>
                  Sync now
                </Button>
              )}
              {confirmUnlink ? (
                <>
                  <Button size="sm" variant="danger" loading={busy === "unlink"} onClick={() => run("unlink")}>
                    Unlink
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmUnlink(false)}>
                    Keep
                  </Button>
                </>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => setConfirmUnlink(true)}>
                  Unlink
                </Button>
              )}
            </>
          ) : (
            <Button size="sm" variant="primary" icon="link" loading={busy === "start"} disabled={!state?.available} onClick={() => run("start")}>
              Link account
            </Button>
          )}
        </div>
      </div>
      {confirmUnlink && <p className="meta">Unlinking stops the JKT48Connect membership from counting here. Shows bought with tickets stay yours.</p>}
      {msg && <p className={`form-msg ${msg.ok ? "is-ok" : "is-bad"}`}>{msg.text}</p>}
    </section>
  );
}
