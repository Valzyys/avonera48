import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate } from "react-router";
import { toast } from "sonner";
import { LogoMark } from "@/components/layout/Logo";
import { Button, ButtonLink, Dialog, Icon, IconButton } from "@/components/ui";
import { useAuth } from "@/features/auth/AuthContext";
import { am, digest } from "@/features/am/api";
import { emailDocument } from "@/features/am/sanitize";
import { useInbox } from "@/features/am/useInbox";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import type {
  AmAccount,
  AmDomain,
  AmMessageDetail,
  AmService,
} from "../../../shared/am";
import "./am.css";

const date = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Jakarta",
      }).format(new Date(value))
    : "Time unavailable";
const readable = (value: string) => value.replace(/_/g, " ");
const errorText = (e: unknown) =>
  e instanceof Error ? e.message : "Something went wrong. Please try again.";
async function copy(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  } catch {
    toast.error("Clipboard is unavailable. Select and copy the text manually.");
  }
}
function Empty({
  icon = "mail",
  title,
  children,
}: {
  icon?: "mail" | "history" | "shield";
  title: string;
  children: string;
}) {
  return (
    <div className="am-empty">
      <span>
        <Icon name={icon} size={23} />
      </span>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export default function AmPage() {
  const { user } = useAuth();
  useDocumentTitle("AM Dashboard · Avonera48");
  if (user === null) return <Navigate to="/login?next=%2Fam" replace />;
  if (!user)
    return (
      <div className="am-page am-boot" aria-busy="true">
        <LogoMark size={42} />
        <p>Opening your workspace…</p>
      </div>
    );
  return <Workspace name={user.name} />;
}
function Workspace({ name }: { name: string }) {
  const [service, setService] = useState<AmService | null>(null);
  const [domainList, setDomainList] = useState<AmDomain[]>([]);
  const [domain, setDomain] = useState("");
  const [accounts, setAccounts] = useState<AmAccount[]>([]);
  const [historyCursor, setHistoryCursor] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [domainError, setDomainError] = useState<string | null>(null);
  const [messageId, setMessageId] = useState<string | null>(null);
  const [message, setMessage] = useState<AmMessageDetail | null>(null);
  const [messageLoading, setMessageLoading] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [view, setView] = useState<"html" | "text" | "raw">("text");
  const [images, setImages] = useState(false);
  const [deleting, setDeleting] = useState<AmAccount | null>(null);
  const [approval, setApproval] = useState<{
    kind: "send" | "verify" | "apply";
    url?: string;
  } | null>(null);
  const [owns, setOwns] = useState(false);
  const [consent, setConsent] = useState(false);
  const [operating, setOperating] = useState(false);
  const active = accounts.find((a) => a.id === selected) ?? null;
  const inbox = useInbox(
    selected,
    !!service?.inbox_adapter && active?.status === "ready",
  );
  const current = inbox.detail?.account ?? active;
  const workflow = inbox.detail?.workflows[0];
  const frame = useMemo(
    () => (message?.html ? emailDocument(message.html, images) : ""),
    [message?.html, images],
  );
  const loaded = useRef(false);
  const load = useCallback(async () => {
    setLoading(true);
    setPageError(null);
    setDomainError(null);
    const [status, domains, history] = await Promise.allSettled([
      am.status(),
      am.domains(),
      am.accounts(),
    ]);
    if (status.status === "fulfilled") setService(status.value);
    else setPageError(errorText(status.reason));
    if (domains.status === "fulfilled") {
      setDomainList(domains.value.domains);
      setDomain((old) =>
        domains.value.domains.some((d) => d.name === old)
          ? old
          : (domains.value.domains.find((d) => d.name === "bussiness.biz.id")
              ?.name ?? ""),
      );
    } else {
      setDomainList([]);
      setDomain("");
      setDomainError(errorText(domains.reason));
    }
    if (history.status === "fulfilled") {
      setAccounts(history.value.items);
      setHistoryCursor(history.value.next_cursor);
      setSelected((old) =>
        history.value.items.some((a) => a.id === old)
          ? old
          : (history.value.items[0]?.id ?? null),
      );
    } else setPageError(errorText(history.reason));
    setLoading(false);
  }, []);
  useEffect(() => {
    if (!loaded.current) {
      loaded.current = true;
      void load();
    }
  }, [load]);
  useEffect(() => {
    setMessageId(null);
    setMessage(null);
    setMessageError(null);
    setImages(false);
    setApproval(null);
  }, [selected]);
  useEffect(() => {
    if (!selected || !messageId) return;
    const controller = new AbortController();
    let live = true;
    setMessageLoading(true);
    setMessageError(null);
    setMessage(null);
    setImages(false);
    am.message(selected, messageId, controller.signal)
      .then(
        (d) => {
          if (live) {
            setMessage(d.message);
            setView(d.message.text ? "text" : "html");
          }
        },
        (e: unknown) => {
          if (live) setMessageError(errorText(e));
        },
      )
      .finally(() => {
        if (live) setMessageLoading(false);
      });
    return () => {
      live = false;
      controller.abort();
    };
  }, [selected, messageId]);
  const generate = async () => {
    setGenerating(true);
    setPageError(null);
    try {
      const result = await am.create(domain || undefined);
      setAccounts((old) => [
        result.account,
        ...old.filter((a) => a.id !== result.account.id),
      ]);
      setSelected(result.account.id);
      toast.success("Your mailbox is ready");
    } catch (e) {
      setPageError(errorText(e));
    } finally {
      setGenerating(false);
    }
  };
  const moreAccounts = async () => {
    setLoadingHistory(true);
    try {
      const next = await am.accounts(historyCursor);
      setAccounts((old) => [
        ...new Map([...old, ...next.items].map((a) => [a.id, a])).values(),
      ]);
      setHistoryCursor(next.next_cursor);
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setLoadingHistory(false);
    }
  };
  const remove = async () => {
    if (!deleting) return;
    setOperating(true);
    try {
      await am.delete(deleting.id);
      setAccounts((old) => old.filter((a) => a.id !== deleting.id));
      if (selected === deleting.id) setSelected(null);
      setDeleting(null);
      toast.success("Removed from your history");
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setOperating(false);
    }
  };
  const approve = (kind: "send" | "verify" | "apply", url?: string) => {
    setOwns(false);
    setConsent(false);
    setApproval({ kind, url });
  };
  const run = async () => {
    if (!selected || !workflow || !approval || !owns || !consent) return;
    setOperating(true);
    try {
      const body: Record<string, unknown> = {
        consent: true,
        owns_account: true,
      };
      if (approval.kind === "verify") {
        if (!approval.url || !messageId)
          throw new Error("Select and review an authentication link first.");
        body.message_id = messageId;
        body.link_sha256 = await digest(approval.url);
      }
      await am.operation(selected, workflow.id, approval.kind, body);
      setApproval(null);
      await inbox.refresh();
      toast.success(
        approval.kind === "send"
          ? "Provider confirmed the magic link request"
          : approval.kind === "verify"
            ? "Provider confirmed verification"
            : "Provider confirmed activation",
      );
    } catch (e) {
      toast.error(errorText(e));
      await inbox.refresh();
    } finally {
      setOperating(false);
    }
  };
  const authorized = !!service?.authorization.valid;
  const can = (scope: string) => {
    const operation =
      scope === "magiclink:send"
        ? "send"
        : scope === "account:verify"
          ? "verify"
          : "apply";
    return service?.actions?.[operation]?.ready ?? false;
  };
  const approvalReady = approval
    ? can(
        approval.kind === "send"
          ? "magiclink:send"
          : approval.kind === "verify"
            ? "account:verify"
            : "license:apply",
      )
    : false;
  const steps = ["Mailbox", "Magic link", "Verification", "License"];
  const progress = !current
    ? -1
    : workflow?.status === "completed"
      ? 3
      : workflow?.status === "verified"
        ? 2
        : workflow?.status === "awaiting_approval"
          ? 1
          : 0;
  return (
    <div className="am-page">
      <header className="am-header">
        <Link className="am-brand" to="/dashboard">
          <LogoMark size={31} />
          <span>
            AVONERA<span>48</span>
            <small> / AM</small>
          </span>
        </Link>
        <div className="am-header-status">
          <i className={domainList.length ? "is-online" : ""} />
          {loading
            ? "Checking services"
            : domainList.length
              ? "Mail service connected"
              : "Mail service unavailable"}
        </div>
        <ButtonLink to="/dashboard" variant="ghost" size="sm" icon="arrowLeft">
          Back to dashboard
        </ButtonLink>
      </header>
      <main className="am-main">
        <section className="am-intro">
          <div>
            <p className="am-eyebrow">
              <span /> YOUR PRIVATE WORKSPACE
            </p>
            <h1>
              AM Dashboard<span>.</span>
            </h1>
            <p>One place for your accounts, inboxes, and approved workflows.</p>
          </div>
          <div className="am-user">
            <span>{name[0]?.toUpperCase()}</span>
            <div>
              <small>SIGNED IN AS</small>
              <strong>{name}</strong>
            </div>
          </div>
        </section>
        {pageError && (
          <div className="am-notice am-notice--error" role="alert">
            <Icon name="alert" size={18} />
            <p>{pageError}</p>
            <Button size="sm" variant="ghost" onClick={() => void load()}>
              Retry
            </Button>
          </div>
        )}
        <div className="am-workspace">
          <section className="am-card am-generator">
            <div className="am-card-heading">
              <span className="am-kicker">01 / ACCOUNT GENERATOR</span>
              <Icon name="layers" size={19} />
            </div>
            <h2>
              A fresh start.
              <br />
              Your own inbox.
            </h2>
            <p className="am-muted">
              Create a private mailbox and manage each step at your pace.
            </p>
            <label className="am-label" htmlFor="am-domain">
              EMAIL DOMAIN
            </label>
            <select
              id="am-domain"
              className="am-select"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              disabled={loading || generating || !domainList.length}
            >
              <option value="">
                {domainList.length
                  ? "Choose an active domain"
                  : domainError
                    ? "Could not load domains"
                    : "No active domains returned"}
              </option>
              {domainList.map((d) => (
                <option key={d.name} value={d.name}>
                  {d.name}
                  {d.name === "bussiness.biz.id" ? " · preferred" : ""}
                </option>
              ))}
            </select>
            {!domainList.some((d) => d.name === "bussiness.biz.id") &&
              domainList.length > 0 && (
                <p className="am-help">
                  bussiness.biz.id is not active. Choose an available
                  alternative above.
                </p>
              )}
            {domainError && (
              <p className="am-inline-error" role="alert">
                {domainError} <button onClick={() => void load()}>Retry</button>
              </p>
            )}
            <Button
              className="am-generate"
              variant="primary"
              icon="plus"
              size="lg"
              loading={generating}
              disabled={loading || !service?.database || !domain}
              onClick={() => void generate()}
            >
              Generate Account
            </Button>
            <p className="am-help">
              <Icon name="shield" size={13} /> Private to your Avonera48 account
              · up to {service?.max_accounts ?? "—"} saved accounts
            </p>
            <div className="am-mailbox">
              <span className="am-label">SELECTED MAILBOX</span>
              <div>
                <code>
                  {current?.email ??
                    (current?.status === "creating"
                      ? "Creating mailbox…"
                      : "No mailbox selected")}
                </code>
                <IconButton
                  icon="copy"
                  label="Copy email"
                  size="sm"
                  disabled={!current?.email}
                  onClick={() =>
                    current?.email && void copy(current.email, "Email")
                  }
                />
              </div>
              <span
                className={`am-badge ${current?.status === "ready" ? "am-badge--green" : ""}`}
              >
                <i />
                {current ? readable(current.status) : "Waiting for an account"}
              </span>
            </div>
            <p className="am-retention">
              Messages are retained by TmailCloud. A saved address does not
              guarantee permanent message storage.
            </p>
          </section>
          <section className="am-card am-workflow">
            <div className="am-card-heading">
              <span className="am-kicker">02 / CONTROLLED WORKFLOW</span>
              <span
                className={`am-badge ${authorized ? "am-badge--green" : "am-badge--amber"}`}
              >
                <Icon name="shield" size={12} />
                {authorized
                  ? "Authorization verified"
                  : "Authorization required"}
              </span>
            </div>
            <h2>You're in control.</h2>
            <p className="am-muted">
              Review your mail. Approve each action. Nothing authenticates
              automatically.
            </p>
            <ol className="am-steps">
              {steps.map((step, index) => (
                <li
                  key={step}
                  className={index <= progress ? "is-complete" : ""}
                >
                  <span>
                    {index < progress ? (
                      <Icon name="check" size={14} />
                    ) : (
                      `0${index + 1}`
                    )}
                  </span>
                  <strong>{step}</strong>
                  <small>
                    {index === progress
                      ? "Current step"
                      : index < progress
                        ? "Confirmed"
                        : "Awaiting approval"}
                  </small>
                </li>
              ))}
            </ol>
            <div className="am-workflow-status">
              <Icon name="pulse" size={17} />
              <div>
                <strong>
                  {workflow
                    ? readable(workflow.status)
                    : "Create or select an account"}
                </strong>
                <span>
                  {workflow?.error_message ??
                    (workflow
                      ? readable(workflow.current_step)
                      : "Your progress will appear here.")}
                </span>
              </div>
            </div>
            {!authorized && (
              <div className="am-permission">
                <Icon name="info" size={17} />
                <p>
                  Verification and license actions remain locked until provider
                  authorization and licensing rights are verified. Mailbox and
                  inbox access work independently. Requesting a sign-in email
                  does not verify or activate an account.
                </p>
              </div>
            )}
            <div className="am-actions">
              <Button
                size="sm"
                icon="mail"
                disabled={
                  !workflow ||
                  !can("magiclink:send") ||
                  !["awaiting_email", "awaiting_approval"].includes(
                    workflow.status,
                  )
                }
                onClick={() => approve("send")}
              >
                Request magic link
              </Button>
              <Button
                size="sm"
                icon="key"
                disabled={
                  !workflow ||
                  workflow.status !== "verified" ||
                  !can("license:apply")
                }
                onClick={() => approve("apply")}
              >
                Approve activation
              </Button>
            </div>
            {service?.actions && !service.actions.send.ready && (
              <p className="am-help" role="status">
                {service.actions.send.reason}
              </p>
            )}
            {service?.authorization.reference && (
              <p className="am-help">
                Authorization reference: {service.authorization.reference}
              </p>
            )}
          </section>
        </div>
        <section className="am-card am-history">
          <div className="am-section-heading">
            <div>
              <span className="am-kicker">YOUR WORKSPACE</span>
              <h2>
                Account history{" "}
                <span className="am-count">{accounts.length}</span>
              </h2>
            </div>
            <Button
              size="sm"
              variant="ghost"
              icon="refresh"
              loading={loading}
              onClick={() => void load()}
            >
              Refresh
            </Button>
          </div>
          {!accounts.length ? (
            <Empty
              icon="history"
              title={loading ? "Loading accounts…" : "Your history starts here"}
            >
              Every mailbox you create is saved to your account. Generate one to
              get started.
            </Empty>
          ) : (
            <div className="am-table-wrap">
              <table className="am-table">
                <thead>
                  <tr>
                    <th>Email address</th>
                    <th>Created · WIB</th>
                    <th>Inbox</th>
                    <th>Status</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((a) => (
                    <tr
                      key={a.id}
                      className={a.id === selected ? "is-selected" : ""}
                    >
                      <td>
                        <span className="am-email-cell">
                          <Icon name="mail" size={15} />
                          <code>{a.email ?? "Generation incomplete"}</code>
                        </span>
                      </td>
                      <td>{date(a.created_at)}</td>
                      <td>
                        {a.id === selected
                          ? (current?.inbox_count ?? a.inbox_count)
                          : a.inbox_count}
                      </td>
                      <td>
                        <span
                          className={`am-badge ${a.status === "ready" ? "am-badge--green" : ""}`}
                        >
                          {a.status}
                        </span>
                      </td>
                      <td>
                        <div className="am-row-actions">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelected(a.id)}
                          >
                            View Inbox
                          </Button>
                          <IconButton
                            icon="trash"
                            label={`Delete ${a.email ?? "account"} from history`}
                            size="sm"
                            disabled={a.status === "creating"}
                            onClick={() => setDeleting(a)}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {historyCursor && (
            <div className="am-more">
              <Button
                size="sm"
                loading={loadingHistory}
                onClick={() => void moreAccounts()}
              >
                Load more accounts
              </Button>
            </div>
          )}
        </section>
        <div className="am-reader-grid">
          <section className="am-card am-inbox">
            <div className="am-section-heading">
              <div>
                <span className="am-kicker">03 / LIVE INBOX</span>
                <h2>
                  Messages{" "}
                  <span className="am-count">{inbox.messages.length}</span>
                </h2>
              </div>
              <Button
                size="sm"
                variant="ghost"
                icon="refresh"
                loading={inbox.busy}
                disabled={!selected}
                onClick={() => void inbox.refresh()}
              >
                Refresh inbox
              </Button>
            </div>
            <div className="am-inbox-bar">
              <span>
                <i className={inbox.polling ? "is-online" : ""} />
                {inbox.polling
                  ? `Auto-sync · ${inbox.retryDelay / 1000}s${inbox.error ? " retry" : ""}`
                  : "Auto-sync paused"}
              </span>
              <span>
                {inbox.lastSync
                  ? `Last sync ${inbox.lastSync.toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta" })}`
                  : "Waiting to sync"}
              </span>
            </div>
            {selected && !service?.inbox_adapter && (
              <p className="am-reader-notice">
                The inbox connection is awaiting setup. Your saved account
                remains available.
              </p>
            )}
            {inbox.error && (
              <p className="am-reader-notice am-inline-error" role="alert">
                {inbox.error}
              </p>
            )}
            {!selected ? (
              <Empty title="Select a mailbox">
                Open an account from history to view its inbox.
              </Empty>
            ) : !inbox.messages.length ? (
              <Empty
                title={
                  inbox.busy ? "Checking your inbox…" : "No saved messages yet"
                }
              >
                New messages will appear here after a successful sync. Message
                availability depends on TmailCloud retention.
              </Empty>
            ) : (
              <div className="am-message-list">
                {inbox.messages.map((m) => (
                  <button
                    key={m.id}
                    className={`am-message ${m.id === messageId ? "is-selected" : ""}`}
                    onClick={() => setMessageId(m.id)}
                  >
                    <div>
                      <strong>{m.sender}</strong>
                      <time>{date(m.received_at)}</time>
                    </div>
                    <h3>{m.subject || "(No subject)"}</h3>
                    <p>{m.preview || "Open to read this message"}</p>
                  </button>
                ))}
              </div>
            )}
            {inbox.cursor && (
              <div className="am-more">
                <Button
                  size="sm"
                  loading={inbox.moreBusy}
                  onClick={() =>
                    void inbox
                      .loadMore()
                      .catch((e: unknown) => toast.error(errorText(e)))
                  }
                >
                  Older messages
                </Button>
              </div>
            )}
          </section>
          <section className="am-card am-message-detail">
            <div className="am-section-heading">
              <div>
                <span className="am-kicker">MESSAGE READER</span>
                <h2>{message?.subject || "A little room to read."}</h2>
              </div>
              {message?.alight_candidate && (
                <span className="am-badge am-badge--green">
                  Alight Creative candidate
                </span>
              )}
            </div>
            {messageLoading ? (
              <div className="am-loading" aria-busy="true">
                Opening message…
              </div>
            ) : messageError ? (
              <p className="am-reader-notice am-inline-error" role="alert">
                {messageError}
              </p>
            ) : !message ? (
              <Empty title="Open a message">
                Review its contents, copy a code, or inspect an authentication
                link here.
              </Empty>
            ) : (
              <>
                <div className="am-message-meta">
                  <span>{message.sender}</span>
                  <time>{date(message.received_at)}</time>
                </div>
                {message.otps.length > 0 && (
                  <div className="am-detections">
                    <span className="am-label">
                      POSSIBLE VERIFICATION CODES
                    </span>
                    {message.otps.map((otp) => (
                      <button
                        className="am-otp"
                        key={otp}
                        onClick={() => void copy(otp, "Code")}
                      >
                        <code>{otp}</code>
                        <Icon name="copy" size={15} />
                      </button>
                    ))}
                  </div>
                )}
                {message.links.length > 0 && (
                  <div className="am-link-review">
                    <span className="am-label">
                      DETECTED LINKS · REVIEW BEFORE USE
                    </span>
                    {message.links.map((link) => (
                      <div key={link.url}>
                        <span className="am-link-host">
                          {new URL(link.url).hostname}
                          {link.authentication
                            ? " · authentication candidate"
                            : ""}
                        </span>
                        <textarea
                          readOnly
                          aria-label="Detected URL"
                          value={link.url}
                          rows={2}
                        />
                        <div className="am-actions">
                          <Button
                            size="sm"
                            variant="ghost"
                            icon="copy"
                            onClick={() => void copy(link.url, "Link")}
                          >
                            Copy link
                          </Button>
                          {link.authentication && (
                            <Button
                              size="sm"
                              icon="shield"
                              disabled={
                                !workflow ||
                                !can("account:verify") ||
                                ![
                                  "awaiting_email",
                                  "awaiting_approval",
                                ].includes(workflow.status)
                              }
                              onClick={() => approve("verify", link.url)}
                            >
                              Review & approve
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div
                  className="am-reader-tabs"
                  role="tablist"
                  aria-label="Message format"
                >
                  {(["text", "html", "raw"] as const).map((v) => (
                    <button
                      key={v}
                      role="tab"
                      aria-selected={view === v}
                      disabled={
                        v === "html"
                          ? !message.html
                          : v === "raw"
                            ? !message.raw
                            : !message.text
                      }
                      onClick={() => setView(v)}
                    >
                      {v === "text"
                        ? "Plain text"
                        : v === "html"
                          ? "HTML"
                          : "Raw message"}
                    </button>
                  ))}
                </div>
                {view === "html" ? (
                  <>
                    <label className="am-check am-images">
                      <input
                        type="checkbox"
                        checked={images}
                        onChange={(e) => setImages(e.target.checked)}
                      />
                      Load remote images (may reveal your IP to the sender)
                    </label>
                    <iframe
                      className="am-email-frame"
                      title="Sanitized message HTML"
                      sandbox=""
                      referrerPolicy="no-referrer"
                      srcDoc={frame}
                    />
                  </>
                ) : (
                  <pre className="am-message-body">
                    {view === "raw"
                      ? message.raw
                      : (message.text ?? "No plain text body is available.")}
                  </pre>
                )}
              </>
            )}
          </section>
        </div>
        <section className="am-card am-timeline">
          <div className="am-section-heading">
            <div>
              <span className="am-kicker">THE AUDIT TRAIL</span>
              <h2>Activity timeline</h2>
            </div>
            <span className="am-muted">For the selected account</span>
          </div>
          {!inbox.detail?.activity.length ? (
            <Empty icon="shield" title="Every action has a record">
              Completed steps, provider errors, and your approvals appear here.
            </Empty>
          ) : (
            <ol>
              {inbox.detail.activity.map((event) => (
                <li key={event.id}>
                  <span
                    className={`am-event-dot ${event.status === "completed" ? "is-online" : ""}`}
                  />
                  <div>
                    <strong>{readable(event.action)}</strong>
                    <span>{readable(event.status)}</span>
                  </div>
                  <time>{date(event.created_at)}</time>
                </li>
              ))}
            </ol>
          )}
          {inbox.detail?.activity_next_cursor && (
            <div className="am-more">
              <Button
                size="sm"
                loading={inbox.moreBusy}
                onClick={() =>
                  void inbox
                    .moreActivity()
                    .catch((e: unknown) => toast.error(errorText(e)))
                }
              >
                Older activity
              </Button>
            </div>
          )}
        </section>
        <footer className="am-footer">
          <span>AVONERA48 / AM</span>
          <span>Private inboxes. Deliberate actions.</span>
          <span>All times in WIB</span>
        </footer>
      </main>
      <Dialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete from History"
        description="This removes the account and its saved message history from this workspace. It does not delete the mailbox at TmailCloud."
        dismissible={!operating}
        footer={
          <>
            <Button onClick={() => setDeleting(null)} disabled={operating}>
              Keep account
            </Button>
            <Button
              variant="danger"
              loading={operating}
              onClick={() => void remove()}
            >
              Delete from History
            </Button>
          </>
        }
      >
        <p className="am-break">{deleting?.email}</p>
      </Dialog>
      <Dialog
        open={!!approval}
        onClose={() => setApproval(null)}
        title={
          approval?.kind === "verify"
            ? "Approve this authentication link"
            : approval?.kind === "apply"
              ? "Approve license activation"
              : "Request a magic link"
        }
        description={
          approval?.kind === "send"
            ? "This requests a sign-in email for your own mailbox only. It does not open a login link, verify an account, or activate a license."
            : "This is a separate, explicit approval. The backend verifies provider authorization before continuing authentication or activation."
        }
        dismissible={!operating}
        footer={
          <>
            <Button disabled={operating} onClick={() => setApproval(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={operating}
              disabled={!owns || !consent || !approvalReady}
              onClick={() => void run()}
            >
              Approve this step
            </Button>
          </>
        }
      >
        <p className="am-break">
          <strong>{current?.email}</strong>
        </p>
        {approval?.url && (
          <textarea
            className="am-approved-link"
            value={approval.url}
            readOnly
            aria-label="Authentication link to approve"
            rows={5}
          />
        )}
        {approval?.kind !== "send" && (
          <p className="am-help">
            Verified authorization:{" "}
            {service?.authorization.reference ?? "Not available"}
          </p>
        )}
        <label className="am-check">
          <input
            type="checkbox"
            checked={owns}
            onChange={(e) => setOwns(e.target.checked)}
          />
          I own and control this mailbox and the associated account.
        </label>
        <label className="am-check">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          {approval?.kind === "verify"
            ? "I reviewed this exact link and approve submitting it for verification."
            : approval?.kind === "apply"
              ? "I approve activating only the license covered by the verified authorization."
              : "I approve sending a sign-in email to this mailbox."}
        </label>
      </Dialog>
    </div>
  );
}
