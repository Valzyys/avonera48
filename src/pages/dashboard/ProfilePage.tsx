import { useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { Button, Icon } from "@/components/ui";
import { useAuth } from "@/features/auth/AuthContext";
import { ApiError, prepareAvatar, profile } from "@/features/members/api";
import { LinkedAccountPanel } from "@/features/members/LinkedAccount";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { DashHead, useDash, UserAvatar } from "@/layouts/DashboardLayout";
import { formatDate } from "@/utils/format";

export default function ProfilePage() {
  useDocumentTitle("Profile");
  const { user, catalog } = useDash();
  const { setAccount, logout } = useAuth();
  const navigate = useNavigate();
  const file = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(user.name);
  const [saving, setSaving] = useState(false);
  const [nameMsg, setNameMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoMsg, setPhotoMsg] = useState<string | null>(null);
  const [pw, setPw] = useState({ current: "", next: "" });
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const saveName = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setNameMsg(null);
    try {
      setAccount(await profile.rename(name));
      setNameMsg({ ok: true, text: "Saved." });
    } catch (err) {
      setNameMsg({ ok: false, text: err instanceof ApiError ? err.message : "Couldn’t save." });
    } finally {
      setSaving(false);
    }
  };

  const pick = async (f: File | undefined) => {
    if (!f) return;
    setPhotoBusy(true);
    setPhotoMsg(null);
    try {
      setAccount(await profile.avatar(await prepareAvatar(f)));
    } catch (err) {
      setPhotoMsg(err instanceof ApiError ? err.message : "That image couldn’t be used. Try a JPEG or PNG.");
    } finally {
      setPhotoBusy(false);
      if (file.current) file.current.value = "";
    }
  };

  const changePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPwBusy(true);
    setPwMsg(null);
    try {
      setAccount(await profile.password(pw.current, pw.next));
      setPw({ current: "", next: "" });
      setPwMsg({ ok: true, text: "Password changed." });
    } catch (err) {
      setPwMsg({ ok: false, text: err instanceof ApiError ? err.message : "Couldn’t change the password." });
    } finally {
      setPwBusy(false);
    }
  };

  return (
    <div className="dash-page">
      <DashHead kicker="Account" title="Profile" />

      <section className="prof-card">
        <div className="prof-photo">
          <UserAvatar user={user} size={112} className="prof-photo__img" />
          <div className="prof-photo__actions">
            <input ref={file} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
            <Button variant="primary" size="sm" icon="edit" loading={photoBusy} onClick={() => file.current?.click()}>
              {user.avatar ? "Change photo" : "Upload photo"}
            </Button>
            {user.avatar && (
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  setPhotoBusy(true);
                  try {
                    setAccount(await profile.removeAvatar());
                  } finally {
                    setPhotoBusy(false);
                  }
                }}
              >
                Remove
              </Button>
            )}
          </div>
          <p className="meta">Square crop, shown in the chat and your account menu.</p>
          {photoMsg && <p className="form-msg is-bad">{photoMsg}</p>}
        </div>

        <div className="prof-info">
          <span className="prof-info__name">{user.name}</span>
          <span className="meta">{user.email}</span>
          <div className="prof-badges">
            <span className="chip chip--mute">Member since {formatDate(user.createdAt)}</span>
            {catalog?.membership && (
              <span className="chip chip--ok">
                {catalog.membership.plan_name}
                {catalog.membership.source === "jkt48connect" ? " · via JKT48Connect" : ""}
              </span>
            )}
            {user.isAdmin && <span className="chip chip--warn">Admin</span>}
          </div>
        </div>
      </section>

      <div className="prof-grid">
        <form className="dash-panel" onSubmit={saveName}>
          <h2 className="dash-panel__title">Display name</h2>
          <p className="meta">Shown on your ticket and next to your chat messages.</p>
          <label className="dash-field">
            <span>Name</span>
            <input className="dash-input" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required minLength={2} />
          </label>
          <label className="dash-field">
            <span>Email</span>
            <input className="dash-input" value={user.email} disabled />
          </label>
          <div className="dash-panel__foot">
            {nameMsg && <span className={`form-msg ${nameMsg.ok ? "is-ok" : "is-bad"}`}>{nameMsg.text}</span>}
            <Button type="submit" variant="primary" loading={saving} disabled={name.trim() === user.name}>
              Save
            </Button>
          </div>
        </form>

        <form className="dash-panel" onSubmit={changePassword}>
          <h2 className="dash-panel__title">Password</h2>
          <p className="meta">Use 8 characters or more.</p>
          <label className="dash-field">
            <span>Current password</span>
            <input className="dash-input" type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} required />
          </label>
          <label className="dash-field">
            <span>New password</span>
            <input className="dash-input" type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} minLength={8} required />
          </label>
          <div className="dash-panel__foot">
            {pwMsg && <span className={`form-msg ${pwMsg.ok ? "is-ok" : "is-bad"}`}>{pwMsg.text}</span>}
            <Button type="submit" variant="primary" loading={pwBusy} disabled={!pw.current || pw.next.length < 8}>
              Change password
            </Button>
          </div>
        </form>
      </div>

      <LinkedAccountPanel />

      <div className="dash-panel dash-panel--row">
        <div>
          <h2 className="dash-panel__title">Sign out</h2>
          <p className="meta">Sign out of this device.</p>
        </div>
        <Button
          variant="secondary"
          icon="logout"
          onClick={async () => {
            await logout();
            navigate("/", { replace: true });
          }}
        >
          Sign out
        </Button>
      </div>
      <p className="meta prof-foot">
        <Icon name="shield" size={13} /> We store your name, email, photo and a salted hash of your password.
      </p>
    </div>
  );
}
