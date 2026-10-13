import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Button, Icon, Skeleton } from "@/components/ui";
import { ApiError, link, type AccountLink, type LinkedAccount, type LinkedMembership } from "@/features/members/api";
import { JktAvatar } from "@/features/members/LinkedAccount";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { DashHead, useDash, UserAvatar } from "@/layouts/DashboardLayout";
import { enter, gsap, useGSAP } from "@/motion/gsap";
import { formatDate } from "@/utils/format";
import { PayBadge, playOutcome } from "./PayBadge";

interface Pending {
  account: LinkedAccount;
  membership: LinkedMembership | null;
  taken: boolean;
}

type View =
  | { kind: "loading" }
  | { kind: "intro"; available: boolean; link: AccountLink | null }
  | { kind: "confirm"; pending: Pending }
  | { kind: "done"; link: AccountLink }
  | { kind: "error"; text: string };

/**
 * /dashboard/connect/jkt48connect: start a link, and the page JKT48Connect
 * sends the user back to (?code=…) to confirm what gets linked and synced.
 */
export default function ConnectPage() {
  useDocumentTitle("Link JKT48Connect");
  const { user, reloadCatalog } = useDash();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const code = params.get("code") ?? "";
  const denied = params.get("error");
  const ref = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>({ kind: "loading" });
  const [busy, setBusy] = useState<"start" | "confirm" | "cancel" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    const load = async () => {
      if (denied) return setView({ kind: "error", text: "The link was cancelled on JKT48Connect. Nothing changed." });
      if (code) {
        try {
          const pending = await link.pending(code);
          if (live) setView({ kind: "confirm", pending });
        } catch (err) {
          if (live) setView({ kind: "error", text: err instanceof ApiError ? err.message : "This link request couldn’t be loaded." });
        }
        return;
      }
      try {
        const s = await link.get();
        if (live) setView({ kind: "intro", available: s.available, link: s.link });
      } catch {
        if (live) setView({ kind: "intro", available: false, link: null });
      }
    };
    load();
    return () => {
      live = false;
    };
  }, [code, denied]);

  useGSAP(
    () => {
      if (view.kind === "confirm" || view.kind === "intro") {
        enter(".conn-card, .conn-wire, .conn-pass, .conn-actions, .conn-note", { autoAlpha: 0, y: 16, stagger: 0.08, duration: 0.6, clearProps: "transform,opacity,visibility" });
        gsap.fromTo(".conn-wire__pulse", { xPercent: -100 }, { xPercent: 400, duration: 1.6, ease: "power2.inOut", repeat: -1, repeatDelay: 0.4 });
      }
      if (view.kind === "done" && ref.current) playOutcome(ref.current, "paid");
    },
    { scope: ref, dependencies: [view.kind] },
  );

  const start = async () => {
    setBusy("start");
    setMsg(null);
    try {
      window.location.assign(await link.start());
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : "Couldn’t start. Try again.");
      setBusy(null);
    }
  };

  const confirm = async () => {
    setBusy("confirm");
    setMsg(null);
    try {
      const l = await link.confirm(code);
      reloadCatalog();
      setView({ kind: "done", link: l });
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : "Couldn’t link the accounts. Try again.");
    }
    setBusy(null);
  };

  const cancel = async () => {
    setBusy("cancel");
    await link.cancel(code).catch(() => undefined);
    navigate("/dashboard/profile", { replace: true });
  };

  const wire = (account: Pick<LinkedAccount, "name" | "avatar" | "email"> | null) => (
    <div className="conn-pair">
      <div className="conn-card">
        <UserAvatar user={user} size={56} />
        <span className="conn-card__app">Avonera48</span>
        <span className="conn-card__name">{user.name}</span>
        <span className="meta">{user.email}</span>
      </div>
      <div className="conn-wire" aria-hidden>
        <span className="conn-wire__line">
          <i className="conn-wire__pulse" />
        </span>
        <span className="conn-wire__knot">
          <Icon name="link" size={16} />
        </span>
      </div>
      <div className="conn-card">
        <JktAvatar account={account} size={56} />
        <span className="conn-card__app">JKT48Connect</span>
        <span className="conn-card__name">{account?.name ?? "Your account"}</span>
        <span className="meta">{account?.email || "Sign in on JKT48Connect"}</span>
      </div>
    </div>
  );

  return (
    <div className="dash-page conn" ref={ref}>
      <DashHead kicker="Linked accounts" title="JKT48Connect" />

      {view.kind === "loading" && <Skeleton height={320} />}

      {view.kind === "error" && (
        <div className="dash-panel conn-panel">
          <p className="form-msg is-bad">{view.text}</p>
          <div className="conn-actions">
            <Link to="/dashboard/connect/jkt48connect" className="dash-btn dash-btn--outline">
              Start again
            </Link>
            <Link to="/dashboard/profile" className="dash-link">
              Back to profile
            </Link>
          </div>
        </div>
      )}

      {view.kind === "intro" && (
        <div className="dash-panel conn-panel">
          {wire(view.link?.account ?? null)}
          {view.link ? (
            <p className="conn-note meta">
              Already linked to <b>{view.link.account.name}</b>. Manage it on your <Link to="/dashboard/profile">profile</Link>.
            </p>
          ) : (
            <>
              <ul className="conn-pass conn-steps">
                <li>
                  <b>1</b> Sign in on JKT48Connect and allow Avonera48.
                </li>
                <li>
                  <b>2</b> Come back here and confirm what gets linked.
                </li>
                <li>
                  <b>3</b> Its membership opens every show here, and stays in sync.
                </li>
              </ul>
              <div className="conn-actions">
                <Button variant="primary" size="lg" icon="link" loading={busy === "start"} disabled={!view.available} onClick={start}>
                  Continue to JKT48Connect
                </Button>
                <Link to="/dashboard/profile" className="dash-link">
                  Not now
                </Link>
              </div>
              {!view.available && <p className="conn-note meta">Linking isn’t available yet. Check back soon.</p>}
            </>
          )}
          {msg && <p className="form-msg is-bad">{msg}</p>}
        </div>
      )}

      {view.kind === "confirm" && (
        <div className="dash-panel conn-panel">
          <h2 className="conn-title">Link these accounts?</h2>
          {wire(view.pending.account)}
          <div className={`conn-pass${view.pending.membership ? " is-on" : ""}`}>
            <span className="conn-pass__label">Membership to sync</span>
            {view.pending.membership ? (
              <>
                <span className="conn-pass__name">
                  <Icon name="ticket" size={16} /> {view.pending.membership.plan_name}
                </span>
                <span className="meta">
                  Until {formatDate(view.pending.membership.expires_at)}. While linked it opens every show here; renewals and changes on JKT48Connect follow automatically.
                </span>
              </>
            ) : (
              <span className="meta">That account has no active membership right now. Link anyway, and one bought there later shows up here automatically.</span>
            )}
          </div>
          {view.pending.taken ? (
            <p className="form-msg is-bad">That JKT48Connect account is already linked to another Avonera48 account. Unlink it there first.</p>
          ) : (
            <p className="conn-note meta">
              <Icon name="shield" size={13} /> Avonera48 receives your JKT48Connect name, email, photo and membership. Nothing goes back except whether the link exists. You can unlink anytime from your profile.
            </p>
          )}
          {msg && <p className="form-msg is-bad">{msg}</p>}
          <div className="conn-actions">
            <Button variant="primary" size="lg" icon="check" loading={busy === "confirm"} disabled={view.pending.taken || !!busy} onClick={confirm}>
              Confirm and sync
            </Button>
            <Button variant="ghost" size="lg" loading={busy === "cancel"} disabled={!!busy} onClick={cancel}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {view.kind === "done" && (
        <div className="dash-panel conn-panel">
          <div className="pay-done">
            <PayBadge kind="paid" />
            <h2 className="pay-done__title">Accounts linked</h2>
            <p className="meta">
              {view.link.membership
                ? `Your ${view.link.membership.plan_name} membership from JKT48Connect now opens every show, until ${formatDate(view.link.membership.expires_at)}.`
                : "When your JKT48Connect account gets a membership, it will show up here automatically."}
            </p>
            <div className="pay-actions">
              <Link to="/dashboard/schedule" className="dash-btn dash-btn--primary dash-btn--lg">
                See the shows
              </Link>
              <Link to="/dashboard/profile" className="dash-btn dash-btn--outline dash-btn--lg">
                Back to profile
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
