import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Navigate } from "react-router";
import { Button, Dialog, ErrorState, Icon, SkeletonRows, Verified } from "@/components/ui";
import { admin, ApiError, rupiah, type AdminAccount, type AdminPlan, type AdminUser, type AdminVoucher, type Order, type PlanDraft } from "@/features/members/api";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useResource } from "@/hooks/useResource";
import { DashHead, useDash } from "@/layouts/DashboardLayout";
import { cx, formatDate, formatDateTime } from "@/utils/format";
import { StatusChip } from "./parts";

type Tab = "overview" | "orders" | "plans" | "pricing" | "vouchers" | "members" | "community" | "accounts";

const TABS: [Tab, string][] = [
  ["overview", "Overview"],
  ["orders", "Transactions"],
  ["plans", "Memberships"],
  ["pricing", "Products"],
  ["vouchers", "Vouchers"],
  ["members", "Members"],
  ["accounts", "Accounts"],
  ["community", "Community"],
];

export default function AdminPage() {
  useDocumentTitle("Admin");
  const { user } = useDash();
  const [tab, setTab] = useState<Tab>("overview");
  if (!user.isAdmin) return <Navigate to="/dashboard" replace />;
  return (
    <div className="dash-page admin">
      <DashHead kicker="Admin" title="Control room" />
      <div className="admin-tabs" role="tablist" aria-label="Admin sections">
        {TABS.map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={cx(tab === k && "is-active")} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </div>
      {tab === "overview" && <Overview onOpen={() => setTab("orders")} />}
      {tab === "orders" && <Orders />}
      {tab === "plans" && <Plans />}
      {tab === "pricing" && <Pricing />}
      {tab === "vouchers" && <Vouchers />}
      {tab === "members" && <Members />}
      {tab === "accounts" && <Accounts />}
      {tab === "community" && <Community />}
    </div>
  );
}

const errText = (e: unknown) => (e instanceof ApiError ? e.message : "Something went wrong.");

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="dash-field">
      <span>{label}</span>
      {children}
      {hint && <small className="meta">{hint}</small>}
    </label>
  );
}

/* ---------- accounts: admins and verified ---------- */

function AccountRow({ a, onChange }: { a: AdminAccount; onChange: (a: AdminAccount) => void }) {
  const [busy, setBusy] = useState<"admin" | "verified" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const flip = async (key: "admin" | "verified") => {
    setBusy(key);
    setMsg(null);
    try {
      onChange(await admin.setAccount(a.email, { [key]: !a[key] }));
    } catch (e) {
      setMsg(errText(e));
    }
    setBusy(null);
  };
  return (
    <li className="acct-row">
      <span className="acct-row__who">
        <b>
          {a.name}
          {a.verified && <Verified size={14} />}
        </b>
        <span className="meta">{a.email}</span>
      </span>
      <span className="acct-row__tags">
        {a.owner && <span className="chip chip--warn">Owner</span>}
        {a.admin && !a.owner && <span className="chip chip--ok">Admin</span>}
      </span>
      <span className="acct-row__actions">
        <Button size="sm" variant={a.verified ? "secondary" : "primary"} loading={busy === "verified"} onClick={() => flip("verified")}>
          {a.verified ? "Remove check" : "Verify"}
        </Button>
        {!a.owner && (
          <Button size="sm" variant={a.admin ? "ghost" : "secondary"} loading={busy === "admin"} onClick={() => flip("admin")}>
            {a.admin ? "Remove admin" : "Make admin"}
          </Button>
        )}
      </span>
      {msg && <span className="form-msg is-bad acct-row__msg">{msg}</span>}
    </li>
  );
}

function Accounts() {
  const res = useResource(() => admin.accounts(), []);
  const [list, setList] = useState<AdminAccount[] | null>(null);
  const [form, setForm] = useState({ name: "", email: "", password: "", admin: true, verified: false });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [find, setFind] = useState("");
  const [found, setFound] = useState<AdminAccount | null>(null);
  const [findMsg, setFindMsg] = useState<string | null>(null);

  useEffect(() => {
    if (res.data) setList(res.data);
  }, [res.data]);

  const upsert = (a: AdminAccount) => {
    setList((l) => {
      const rest = (l ?? []).filter((x) => x.id !== a.id);
      return a.admin || a.verified || a.owner ? [a, ...rest] : rest;
    });
    setFound((f) => (f?.id === a.id ? a : f));
  };

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const a = await admin.createAccount(form);
      upsert(a);
      setForm({ name: "", email: "", password: "", admin: true, verified: false });
      setMsg({ ok: true, text: `Created ${a.email}. Share the password with them privately.` });
    } catch (err) {
      setMsg({ ok: false, text: errText(err) });
    }
    setBusy(false);
  };

  const lookup = async (e: FormEvent) => {
    e.preventDefault();
    setFindMsg(null);
    setFound(null);
    try {
      setFound(await admin.account(find.trim()));
    } catch (err) {
      setFindMsg(errText(err));
    }
  };

  if (res.status === "error") return <ErrorState error={res.error} onRetry={res.reload} />;

  return (
    <div className="acct">
      <form className="dash-panel" onSubmit={create}>
        <h2 className="dash-panel__title">Create an account</h2>
        <p className="meta">For a new admin or a verified account. They can change the password later on their profile.</p>
        <div className="admin-form__row">
          <Field label="Name">
            <input className="dash-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={2} maxLength={40} />
          </Field>
          <Field label="Email">
            <input className="dash-input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </Field>
        </div>
        <Field label="Password" hint="8 characters or more.">
          <input className="dash-input" type="text" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} />
        </Field>
        <div className="acct__checks">
          <label className="admin-check">
            <input type="checkbox" checked={form.admin} onChange={(e) => setForm({ ...form, admin: e.target.checked })} /> Admin
          </label>
          <label className="admin-check">
            <input type="checkbox" checked={form.verified} onChange={(e) => setForm({ ...form, verified: e.target.checked })} /> Verified <Verified size={14} />
          </label>
        </div>
        <div className="dash-panel__foot">
          {msg && <span className={`form-msg ${msg.ok ? "is-ok" : "is-bad"}`}>{msg.text}</span>}
          <Button type="submit" variant="primary" loading={busy}>
            Create account
          </Button>
        </div>
      </form>

      <form className="dash-panel" onSubmit={lookup}>
        <h2 className="dash-panel__title">Find an account</h2>
        <p className="meta">Verify any member or make them an admin.</p>
        <div className="admin-inline">
          <input className="dash-input" type="email" placeholder="member@email.com" value={find} onChange={(e) => setFind(e.target.value)} required />
          <Button type="submit" variant="secondary" icon="search">
            Find
          </Button>
        </div>
        {findMsg && <p className="form-msg is-bad">{findMsg}</p>}
        {found && (
          <ul className="acct-list">
            <AccountRow a={found} onChange={upsert} />
          </ul>
        )}
      </form>

      <section className="dash-panel">
        <h2 className="dash-panel__title">Admins and verified accounts</h2>
        {!list ? (
          <SkeletonRows rows={3} />
        ) : list.length ? (
          <ul className="acct-list">
            {list.map((a) => (
              <AccountRow key={a.id} a={a} onChange={upsert} />
            ))}
          </ul>
        ) : (
          <p className="meta">Nobody yet.</p>
        )}
      </section>
    </div>
  );
}

/* ---------- community (WhatsApp links) ---------- */

function Community() {
  const res = useResource(() => admin.community(), []);
  const [links, setLinks] = useState({ channel: "", group: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (res.data) setLinks({ channel: res.data.channel ?? "", group: res.data.group ?? "" });
  }, [res.data]);

  if (res.status === "error") return <ErrorState error={res.error} onRetry={res.reload} />;
  if (!res.data) return <SkeletonRows rows={2} />;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await admin.saveCommunity({ channel: links.channel.trim(), group: links.group.trim() });
      setMsg({ ok: true, text: "Saved. Members see it on their dashboard." });
    } catch (err) {
      setMsg({ ok: false, text: errText(err) });
    }
    setBusy(false);
  };

  return (
    <form className="dash-panel" onSubmit={save}>
      <h2 className="dash-panel__title">WhatsApp</h2>
      <p className="meta">Shown on every dashboard. The group link is only sent to accounts with an active membership; others see it locked. Leave a field empty to hide it.</p>
      <Field label="Channel link" hint="Everyone signed in sees this, e.g. https://whatsapp.com/channel/…">
        <input className="dash-input" type="url" inputMode="url" placeholder="https://whatsapp.com/channel/…" value={links.channel} onChange={(e) => setLinks({ ...links, channel: e.target.value })} />
      </Field>
      <Field label="Members’ group link" hint="Active members only, e.g. https://chat.whatsapp.com/…">
        <input className="dash-input" type="url" inputMode="url" placeholder="https://chat.whatsapp.com/…" value={links.group} onChange={(e) => setLinks({ ...links, group: e.target.value })} />
      </Field>
      <div className="dash-panel__foot">
        {msg && <span className={`form-msg ${msg.ok ? "is-ok" : "is-bad"}`}>{msg.text}</span>}
        <Button type="submit" variant="primary" loading={busy}>
          Save
        </Button>
      </div>
    </form>
  );
}

/* ---------- overview ---------- */

function Overview({ onOpen }: { onOpen: () => void }) {
  const s = useResource(() => admin.summary(), []);
  if (s.status === "error") return <ErrorState error={s.error} onRetry={s.reload} />;
  if (!s.data) return <SkeletonRows rows={4} />;
  const d = s.data;
  return (
    <>
      <div className="admin-kpis">
        <Kpi label="Revenue" value={rupiah(d.revenue)} note={`${d.paid} paid orders`} accent />
        <Kpi label="Last 24 hours" value={rupiah(d.revenue_24h)} note={`${d.paid_24h} paid`} />
        <Kpi label="Waiting" value={String(d.by_status.PENDING ?? 0)} note="pending payments" />
        <Kpi label="Members" value={String(d.active_members)} note="active memberships" />
      </div>
      <section className="dash-panel">
        <div className="admin-panel-head">
          <h2 className="dash-panel__title">Latest transactions</h2>
          <button type="button" className="dash-link" onClick={onOpen}>
            All <Icon name="arrowRight" size={14} />
          </button>
        </div>
        <OrderTable orders={d.recent} />
      </section>
    </>
  );
}

function Kpi({ label, value, note, accent }: { label: string; value: string; note: string; accent?: boolean }) {
  return (
    <div className={cx("admin-kpi", accent && "is-accent")}>
      <span className="admin-kpi__label">{label}</span>
      <span className="admin-kpi__value">{value}</span>
      <span className="meta">{note}</span>
    </div>
  );
}

/* ---------- transactions ---------- */

function OrderTable({ orders, onPick }: { orders: Order[]; onPick?: (o: Order) => void }) {
  if (!orders.length) return <p className="meta">No transactions.</p>;
  return (
    <div className="tx-table tx-table--admin" role="table">
      <div className="tx-row tx-row--head" role="row">
        <span role="columnheader">Buyer</span>
        <span role="columnheader">Item</span>
        <span role="columnheader">Date</span>
        <span role="columnheader">Amount</span>
        <span role="columnheader">Status</span>
      </div>
      {orders.map((o) => (
        <button key={o.id} type="button" className="tx-row" role="row" onClick={() => onPick?.(o)} disabled={!onPick}>
          <span className="tx-buyer" role="cell">
            <b>{o.user_name}</b>
            <span className="meta">{o.user_email}</span>
          </span>
          <span role="cell">
            <span className="tx-item__title">{o.item_title}</span>
            <span className="meta">{o.kind === "membership" ? "Membership" : "Ticket"}</span>
          </span>
          <span className="meta" role="cell">
            {formatDateTime(o.created_at)}
          </span>
          <span className="tx-amount" role="cell">
            {rupiah(o.pay_amount ?? o.amount)}
            {o.voucher && <span className="meta">{o.voucher}</span>}
          </span>
          <span role="cell">
            <StatusChip status={o.status} />
          </span>
        </button>
      ))}
    </div>
  );
}

function Orders() {
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [extra, setExtra] = useState<Order[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [pick, setPick] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);
  const res = useResource(() => admin.orders({ status, q: query }), [status, query]);
  useEffect(() => {
    setExtra([]);
    setNext(res.data?.next ?? null);
  }, [res.data]);

  const more = async () => {
    if (!next) return;
    const r = await admin.orders({ status, q: query, before: next });
    setExtra((x) => [...x, ...r.orders]);
    setNext(r.next);
  };

  const recheck = async () => {
    if (!pick) return;
    setBusy(true);
    try {
      setPick(await admin.recheck(pick.id));
      res.reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="dash-panel">
      <form
        className="admin-filters"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(q.trim());
        }}
      >
        <input className="dash-input" placeholder="Search email, name, order or transaction id" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="dash-input" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="">All statuses</option>
          <option value="PENDING">Waiting</option>
          <option value="SUCCESS">Paid</option>
          <option value="EXPIRED">Expired</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="FAILED">Failed</option>
        </select>
        <Button type="submit" variant="primary" icon="search">
          Search
        </Button>
      </form>
      {res.status === "error" ? <ErrorState error={res.error} onRetry={res.reload} /> : !res.data ? <SkeletonRows rows={6} /> : <OrderTable orders={[...res.data.orders, ...extra]} onPick={setPick} />}
      {next && (
        <div className="admin-more">
          <Button variant="secondary" onClick={more}>
            Load more
          </Button>
        </div>
      )}

      <Dialog
        open={!!pick}
        onClose={() => setPick(null)}
        title="Transaction"
        description={pick ? `${pick.user_name} · ${pick.user_email}` : ""}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPick(null)}>
              Close
            </Button>
            {pick && pick.status !== "SUCCESS" && pick.status !== "FAILED" && (
              <Button variant="primary" icon="refresh" loading={busy} onClick={recheck}>
                Re-check with gateway
              </Button>
            )}
          </>
        }
      >
        {pick && (
          <dl className="def-list">
            {(
              [
                ["Status", <StatusChip key="s" status={pick.status} />],
                ["Item", `${pick.item_title} (${pick.kind})`],
                ["Price", rupiah(pick.base_amount)],
                ["Voucher", pick.voucher ? `${pick.voucher} (−${rupiah(pick.discount)})` : "—"],
                ["Charged", rupiah(pick.pay_amount ?? pick.amount)],
                ["Order id", pick.id],
                ["Gateway id", pick.trx_id ?? "—"],
                ["Created", `${formatDateTime(pick.created_at)} WIB`],
                ["Paid", pick.paid_at ? `${formatDateTime(pick.paid_at)} WIB` : "—"],
              ] as [string, ReactNode][]
            ).map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        )}
      </Dialog>
    </section>
  );
}

/* ---------- membership plans ---------- */

const emptyPlan: PlanDraft = { name: "", description: "", price: 0, duration_days: 30, stock: "", active: 1, sort: 0 };

function Plans() {
  const res = useResource(() => admin.plans(), []);
  const [edit, setEdit] = useState<PlanDraft | null>(null);
  const [stockFor, setStockFor] = useState<AdminPlan | null>(null);
  const [add, setAdd] = useState("10");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!edit) return;
    setBusy(true);
    setMsg(null);
    try {
      await admin.savePlan({ ...edit, stock: edit.stock === "" ? null : edit.stock });
      setEdit(null);
      res.reload();
    } catch (err) {
      setMsg(errText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="dash-panel">
      <div className="admin-panel-head">
        <h2 className="dash-panel__title">Membership plans</h2>
        <Button variant="primary" icon="plus" onClick={() => setEdit({ ...emptyPlan })}>
          New plan
        </Button>
      </div>
      {!res.data ? (
        <SkeletonRows rows={3} />
      ) : res.data.length ? (
        <div className="admin-cards">
          {res.data.map((p) => (
            <article key={p.id} className={cx("admin-card", !p.active && "is-off")}>
              <div className="admin-card__top">
                <h3>{p.name}</h3>
                <span className={`chip ${p.active ? "chip--ok" : "chip--mute"}`}>{p.active ? "On sale" : "Off"}</span>
              </div>
              <p className="admin-card__price">{rupiah(p.price)}</p>
              <p className="meta">{p.duration_days} days active</p>
              <dl className="admin-card__stats">
                <div>
                  <dt>Sold</dt>
                  <dd>{p.sold}</dd>
                </div>
                <div>
                  <dt>Stock</dt>
                  <dd>{p.stock == null ? "∞" : p.stock}</dd>
                </div>
                <div>
                  <dt>Left</dt>
                  <dd>{p.stock == null ? "∞" : Math.max(0, p.stock - p.sold)}</dd>
                </div>
              </dl>
              <div className="admin-card__actions">
                <Button size="sm" variant="secondary" icon="edit" onClick={() => setEdit({ ...p, stock: p.stock ?? "" })}>
                  Edit
                </Button>
                <Button size="sm" variant="secondary" icon="plus" onClick={() => setStockFor(p)}>
                  Stock
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    await admin.savePlan({ ...p, active: p.active ? 0 : 1 });
                    res.reload();
                  }}
                >
                  {p.active ? "Switch off" : "Switch on"}
                </Button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="meta">No plans yet. Create one to start selling memberships.</p>
      )}

      <Dialog
        open={!!edit}
        onClose={() => setEdit(null)}
        title={edit?.id ? "Edit plan" : "New plan"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEdit(null)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" form="plan-form" loading={busy}>
              Save
            </Button>
          </>
        }
      >
        {edit && (
          <form id="plan-form" className="admin-form" onSubmit={save}>
            <Field label="Name">
              <input className="dash-input" value={edit.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} required maxLength={60} />
            </Field>
            <Field label="Description">
              <input className="dash-input" value={edit.description ?? ""} onChange={(e) => setEdit({ ...edit, description: e.target.value })} maxLength={280} />
            </Field>
            <div className="admin-form__row">
              <Field label="Price (Rp)">
                <input className="dash-input" type="number" min={0} value={edit.price ?? 0} onChange={(e) => setEdit({ ...edit, price: Number(e.target.value) })} required />
              </Field>
              <Field label="Active for (days)">
                <input className="dash-input" type="number" min={1} max={3650} value={edit.duration_days ?? 30} onChange={(e) => setEdit({ ...edit, duration_days: Number(e.target.value) })} required />
              </Field>
            </div>
            <div className="admin-form__row">
              <Field label="Stock" hint="Empty = unlimited">
                <input className="dash-input" type="number" min={0} value={edit.stock ?? ""} onChange={(e) => setEdit({ ...edit, stock: e.target.value === "" ? "" : Number(e.target.value) })} />
              </Field>
              <Field label="Order" hint="Lower shows first">
                <input className="dash-input" type="number" value={edit.sort ?? 0} onChange={(e) => setEdit({ ...edit, sort: Number(e.target.value) })} />
              </Field>
            </div>
            <label className="admin-check">
              <input type="checkbox" checked={edit.active !== 0} onChange={(e) => setEdit({ ...edit, active: e.target.checked ? 1 : 0 })} /> On sale
            </label>
            {msg && <p className="checkout__error">{msg}</p>}
          </form>
        )}
      </Dialog>

      <Dialog
        open={!!stockFor}
        onClose={() => setStockFor(null)}
        size="sm"
        title="Add stock"
        description={stockFor ? `${stockFor.name}: ${stockFor.stock == null ? "unlimited" : `${Math.max(0, stockFor.stock - stockFor.sold)} left`}` : ""}
        footer={
          <>
            <Button variant="ghost" onClick={() => setStockFor(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={async () => {
                if (!stockFor) return;
                await admin.addStock(stockFor.id, Number(add));
                setStockFor(null);
                res.reload();
              }}
            >
              Add
            </Button>
          </>
        }
      >
        <Field label="How many to add" hint="Use a negative number to remove.">
          <input className="dash-input" type="number" value={add} onChange={(e) => setAdd(e.target.value)} />
        </Field>
      </Dialog>
    </section>
  );
}

/* ---------- products (ticket pricing) ---------- */

function Pricing() {
  const res = useResource(() => admin.pricing(), []);
  const [global, setGlobal] = useState("");
  const [rows, setRows] = useState<Record<string, { price: string; on_sale: boolean; stream_slug: string }>>({});
  const [saved, setSaved] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!res.data) return;
    setGlobal(res.data.ticket_price == null ? "" : String(res.data.ticket_price));
    setRows(Object.fromEntries(res.data.products.map((p) => [p.show_slug, { price: p.price == null ? "" : String(p.price), on_sale: !!p.on_sale, stream_slug: p.stream_slug ?? "" }])));
  }, [res.data]);

  if (res.status === "error") return <ErrorState error={res.error} onRetry={res.reload} />;
  if (!res.data) return <SkeletonRows rows={5} />;

  const row = (slug: string) => rows[slug] ?? { price: "", on_sale: true, stream_slug: "" };
  const saveRow = async (slug: string) => {
    const r = row(slug);
    setMsg(null);
    try {
      await admin.saveProduct({ show_slug: slug, price: r.price === "" ? null : Number(r.price), on_sale: r.on_sale, stream_slug: r.stream_slug || null });
      setSaved(slug);
      window.setTimeout(() => setSaved(null), 1500);
    } catch (e) {
      setMsg(errText(e));
    }
  };

  return (
    <>
      <section className="dash-panel">
        <h2 className="dash-panel__title">Global ticket price</h2>
        <p className="meta">Used for every show without its own price. Leave empty to stop selling shows that have no price of their own.</p>
        <form
          className="admin-inline"
          onSubmit={async (e) => {
            e.preventDefault();
            setMsg(null);
            try {
              await admin.setGlobalPrice(global === "" ? null : Number(global));
              setSaved("global");
              window.setTimeout(() => setSaved(null), 1500);
            } catch (err) {
              setMsg(errText(err));
            }
          }}
        >
          <span className="admin-prefix">Rp</span>
          <input className="dash-input" type="number" min={0} value={global} onChange={(e) => setGlobal(e.target.value)} placeholder="Not set" />
          <Button type="submit" variant="primary">
            {saved === "global" ? "Saved" : "Save"}
          </Button>
        </form>
      </section>

      <section className="dash-panel">
        <h2 className="dash-panel__title">Per show</h2>
        <p className="meta">Override the price, take a show off sale, or pin the stream it plays (partner show slug).</p>
        {msg && <p className="checkout__error">{msg}</p>}
        <div className="price-table">
          {res.data.shows.map((s) => {
            const r = row(s.slug);
            return (
              <div key={s.slug} className="price-row">
                <span className="price-row__show">
                  <b>{s.title}</b>
                  <span className="meta">
                    {formatDateTime(s.startsAt)} · {s.slug}
                  </span>
                </span>
                <label className="price-row__field">
                  <span className="sr-only">Price</span>
                  <input
                    className="dash-input"
                    type="number"
                    min={0}
                    placeholder={res.data!.ticket_price == null ? "No price" : `Global ${res.data!.ticket_price}`}
                    value={r.price}
                    onChange={(e) => setRows({ ...rows, [s.slug]: { ...r, price: e.target.value } })}
                  />
                </label>
                <label className="price-row__field">
                  <span className="sr-only">Stream slug</span>
                  <input className="dash-input" placeholder="Stream (auto)" value={r.stream_slug} onChange={(e) => setRows({ ...rows, [s.slug]: { ...r, stream_slug: e.target.value } })} />
                </label>
                <label className="admin-check">
                  <input type="checkbox" checked={r.on_sale} onChange={(e) => setRows({ ...rows, [s.slug]: { ...r, on_sale: e.target.checked } })} /> On sale
                </label>
                <Button size="sm" variant="secondary" onClick={() => saveRow(s.slug)}>
                  {saved === s.slug ? "Saved" : "Save"}
                </Button>
              </div>
            );
          })}
          {!res.data.shows.length && <p className="meta">The schedule couldn’t be loaded from the data API.</p>}
        </div>
      </section>
    </>
  );
}

/* ---------- vouchers ---------- */

const emptyVoucher: Omit<Partial<AdminVoucher>, "active"> & { active?: boolean } = { code: "", kind: "percent", value: 10, applies_to: "all", max_uses: null, expires_at: null, active: true };

function Vouchers() {
  const res = useResource(() => admin.vouchers(), []);
  const [edit, setEdit] = useState<typeof emptyVoucher | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!edit) return;
    setBusy(true);
    setMsg(null);
    try {
      await admin.saveVoucher(edit);
      setEdit(null);
      res.reload();
    } catch (err) {
      setMsg(errText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="dash-panel">
      <div className="admin-panel-head">
        <h2 className="dash-panel__title">Voucher codes</h2>
        <Button variant="primary" icon="plus" onClick={() => setEdit({ ...emptyVoucher })}>
          New voucher
        </Button>
      </div>
      {!res.data ? (
        <SkeletonRows rows={3} />
      ) : res.data.length ? (
        <div className="voucher-list">
          {res.data.map((v) => (
            <article key={v.code} className={cx("voucher", !v.active && "is-off")}>
              <span className="voucher__code mono">{v.code}</span>
              <span className="voucher__value">{v.kind === "percent" ? `${v.value}% off` : `${rupiah(v.value)} off`}</span>
              <span className="meta">
                {v.applies_to === "all" ? "Everything" : v.applies_to === "ticket" ? "Tickets" : "Memberships"} · used {v.used}
                {v.max_uses != null ? `/${v.max_uses}` : ""}
                {v.expires_at ? ` · until ${formatDate(v.expires_at)}` : ""}
              </span>
              <span className="voucher__actions">
                <Button size="sm" variant="secondary" icon="edit" onClick={() => setEdit({ ...v, active: !!v.active })}>
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  icon="trash"
                  onClick={async () => {
                    if (!window.confirm(`Delete voucher ${v.code}?`)) return;
                    await admin.deleteVoucher(v.code);
                    res.reload();
                  }}
                >
                  Delete
                </Button>
              </span>
            </article>
          ))}
        </div>
      ) : (
        <p className="meta">No vouchers yet.</p>
      )}

      <Dialog
        open={!!edit}
        onClose={() => setEdit(null)}
        title={res.data?.some((v) => v.code === edit?.code) ? "Edit voucher" : "New voucher"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEdit(null)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" form="voucher-form" loading={busy}>
              Save
            </Button>
          </>
        }
      >
        {edit && (
          <form id="voucher-form" className="admin-form" onSubmit={save}>
            <Field label="Code">
              <input className="dash-input mono" value={edit.code ?? ""} onChange={(e) => setEdit({ ...edit, code: e.target.value.toUpperCase() })} required maxLength={40} />
            </Field>
            <div className="admin-form__row">
              <Field label="Type">
                <select className="dash-input" value={edit.kind} onChange={(e) => setEdit({ ...edit, kind: e.target.value as "percent" | "fixed" })}>
                  <option value="percent">Percent off</option>
                  <option value="fixed">Fixed amount off</option>
                </select>
              </Field>
              <Field label={edit.kind === "percent" ? "Percent" : "Amount (Rp)"}>
                <input className="dash-input" type="number" min={1} max={edit.kind === "percent" ? 100 : undefined} value={edit.value ?? 0} onChange={(e) => setEdit({ ...edit, value: Number(e.target.value) })} required />
              </Field>
            </div>
            <div className="admin-form__row">
              <Field label="Works for">
                <select className="dash-input" value={edit.applies_to} onChange={(e) => setEdit({ ...edit, applies_to: e.target.value as AdminVoucher["applies_to"] })}>
                  <option value="all">Everything</option>
                  <option value="ticket">Show tickets</option>
                  <option value="membership">Memberships</option>
                </select>
              </Field>
              <Field label="Max uses" hint="Empty = unlimited">
                <input className="dash-input" type="number" min={1} value={edit.max_uses ?? ""} onChange={(e) => setEdit({ ...edit, max_uses: e.target.value === "" ? null : Number(e.target.value) })} />
              </Field>
            </div>
            <Field label="Expires" hint="Empty = never">
              <input className="dash-input" type="datetime-local" value={edit.expires_at ? edit.expires_at.slice(0, 16) : ""} onChange={(e) => setEdit({ ...edit, expires_at: e.target.value || null })} />
            </Field>
            <label className="admin-check">
              <input type="checkbox" checked={edit.active !== false} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} /> Active
            </label>
            {msg && <p className="checkout__error">{msg}</p>}
          </form>
        )}
      </Dialog>
    </section>
  );
}

/* ---------- members ---------- */

function Members() {
  const res = useResource(() => admin.members(), []);
  const plans = useResource(() => admin.plans(), []);
  const [email, setEmail] = useState("");
  const [plan, setPlan] = useState("");
  const [days, setDays] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [filter, setFilter] = useState<"active" | "all">("active");

  const grant = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(null);
    try {
      const r = await admin.grant(email.trim(), plan, days ? Number(days) : undefined);
      setMsg({ ok: true, text: `Active until ${formatDateTime(r.expires_at)} WIB.` });
      setEmail("");
      res.reload();
    } catch (err) {
      setMsg({ ok: false, text: errText(err) });
    }
  };

  const rows = (res.data ?? []).filter((m) => filter === "all" || Date.parse(m.expires_at) > Date.now());

  return (
    <>
      <MemberLookup onChange={res.reload} />

      <section className="dash-panel">
        <h2 className="dash-panel__title">Give a membership</h2>
        <p className="meta">Adds days to a member’s pass without a payment (giveaways, refunds, staff).</p>
        <form className="admin-form admin-form--inline" onSubmit={grant}>
          <input className="dash-input" type="email" placeholder="Member email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <select className="dash-input" value={plan} onChange={(e) => setPlan(e.target.value)} aria-label="Plan">
            <option value="">Custom</option>
            {(plans.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.duration_days} days)
              </option>
            ))}
          </select>
          <input className="dash-input" type="number" min={1} placeholder="Days" value={days} onChange={(e) => setDays(e.target.value)} />
          <Button type="submit" variant="primary">
            Give
          </Button>
        </form>
        {msg && <p className={`form-msg ${msg.ok ? "is-ok" : "is-bad"}`}>{msg.text}</p>}
      </section>

      <section className="dash-panel">
        <div className="dash-panel__row">
          <h2 className="dash-panel__title">Memberships</h2>
          <div className="seg" role="tablist" aria-label="Filter memberships">
            {(
              [
                ["active", "Active"],
                ["all", "All"],
              ] as const
            ).map(([k, label]) => (
              <button key={k} type="button" role="tab" aria-selected={filter === k} className={cx(filter === k && "is-active")} onClick={() => setFilter(k)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        {!res.data ? (
          <SkeletonRows rows={4} />
        ) : rows.length ? (
          <ul className="mem-list">
            {rows.map((m) => (
              <li key={m.user_id} className="mem-item">
                <span className="mem-item__who">
                  <b>{m.name ?? "Member"}</b>
                  <span className="meta">{m.email ?? m.user_id}</span>
                </span>
                <PassControls uid={m.user_id} membership={m} onChange={res.reload} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="meta">{filter === "active" ? "No active memberships." : "No memberships yet."}</p>
        )}
      </section>
    </>
  );
}

/** Find one account by email: its pass and its show tickets. */
function MemberLookup({ onChange }: { onChange: () => void }) {
  const [email, setEmail] = useState("");
  const [found, setFound] = useState<AdminUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async (address = email) => {
    setBusy(true);
    setError(null);
    try {
      setFound(await admin.user(address.trim()));
    } catch (err) {
      setFound(null);
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  };
  const refresh = () => {
    if (found) load(found.user.email);
    onChange();
  };

  const dropTicket = async (show: string) => {
    if (!found || !window.confirm("Take this ticket away? The member loses access to that show.")) return;
    try {
      await admin.revokeTicket(found.user.id, show);
      refresh();
    } catch (err) {
      setError(errText(err));
    }
  };

  return (
    <section className="dash-panel">
      <h2 className="dash-panel__title">Find a member</h2>
      <p className="meta">Look up an account to change or take away its membership and tickets.</p>
      <form
        className="admin-form admin-form--inline"
        onSubmit={(e) => {
          e.preventDefault();
          load();
        }}
      >
        <input className="dash-input" type="email" placeholder="Member email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Button type="submit" variant="secondary" icon="search" disabled={busy}>
          {busy ? "Looking…" : "Look up"}
        </Button>
      </form>
      {error && <p className="form-msg is-bad">{error}</p>}
      {found && (
        <div className="mem-card">
          <div className="mem-card__head">
            <span className="mem-item__who">
              <b>{found.user.name}</b>
              <span className="meta">
                {found.user.email}
                {found.user.createdAt ? ` · joined ${formatDate(found.user.createdAt)}` : ""}
              </span>
            </span>
          </div>
          <div className="mem-card__block">
            <span className="mem-card__label">Membership</span>
            {found.membership ? (
              <PassControls uid={found.user.id} membership={found.membership} onChange={refresh} />
            ) : (
              <p className="meta">No membership. Use “Give a membership” below.</p>
            )}
          </div>
          <div className="mem-card__block">
            <span className="mem-card__label">Show tickets · {found.tickets.length}</span>
            {found.tickets.length ? (
              <ul className="mem-tickets">
                {found.tickets.map((t) => (
                  <li key={t.show_slug}>
                    <span>
                      <b>{t.title ?? t.show_slug}</b>
                      <span className="meta"> · since {formatDate(t.created_at)}</span>
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => dropTicket(t.show_slug)}>
                      Revoke
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="meta">No tickets.</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

/** Status of one pass with the controls to lengthen, shorten, end-date or revoke it. */
function PassControls({ uid, membership, onChange }: { uid: string; membership: { plan_name: string; started_at: string; expires_at: string }; onChange: () => void }) {
  const [until, setUntil] = useState(membership.expires_at.slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = Date.parse(membership.expires_at) > Date.now();
  const left = Math.max(0, Math.ceil((Date.parse(membership.expires_at) - Date.now()) / 86400000));

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onChange();
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pass-ctl">
      <span className="pass-ctl__status">
        <span className={`chip ${active ? "chip--ok" : "chip--mute"}`}>{active ? `${left} day${left === 1 ? "" : "s"} left` : "Ended"}</span>
        <span className="meta">
          {membership.plan_name} · until {formatDate(membership.expires_at)}
        </span>
      </span>
      <span className="pass-ctl__actions">
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => admin.adjust(uid, { add_days: -7 }))}>
          −7d
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => admin.adjust(uid, { add_days: 7 }))}>
          +7d
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => admin.adjust(uid, { add_days: 30 }))}>
          +30d
        </Button>
        <span className="pass-ctl__date">
          <input className="dash-input" type="date" value={until} onChange={(e) => setUntil(e.target.value)} aria-label="Last day" />
          <Button size="sm" variant="secondary" disabled={busy || !until} onClick={() => run(() => admin.adjust(uid, { until }))}>
            Set
          </Button>
        </span>
        <Button
          size="sm"
          variant="danger"
          disabled={busy}
          onClick={() => window.confirm("Revoke this membership now? The member loses access to every show it covered.") && run(() => admin.revoke(uid))}
        >
          Revoke
        </Button>
      </span>
      {error && <span className="form-msg is-bad">{error}</span>}
    </div>
  );
}
