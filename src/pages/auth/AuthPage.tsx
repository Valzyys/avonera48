import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type InputHTMLAttributes } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router";
import { LogoMark } from "@/components/layout/Logo";
import { MemberPhoto } from "@/components/media/Media";
import { Icon, type IconName } from "@/components/ui";
import { AuthError, useAuth } from "@/features/auth/AuthContext";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useResource } from "@/hooks/useResource";
import { enter, gsap, useGSAP } from "@/motion/gsap";
import { api } from "@/services";
import { cx, formatDate, formatTime, formatWeekday } from "@/utils/format";

type Mode = "login" | "register";

/** Only same-site paths are allowed as a post-login destination. */
const safeNext = (v: string | null) => (v && /^\/(?!\/)[\w\-/?=&%.]*$/.test(v) ? v : "/dashboard");

export function LoginPage() {
  return <AuthPage mode="login" />;
}

export function RegisterPage() {
  return <AuthPage mode="register" />;
}

/** A small stable hash, for the ticket's seat and barcode (decoration only). */
function hash(s: string) {
  let h = 2166136261;
  for (let k = 0; k < s.length; k++) h = Math.imul(h ^ s.charCodeAt(k), 16777619);
  return h >>> 0;
}

/*
 * The sign-in page is a theater ticket: the form is printed on the ticket,
 * the stub on its left fills in as you type (name, seat, barcode), and a
 * successful sign-in tears the stub off before entering the room.
 */
function AuthPage({ mode }: { mode: Mode }) {
  useDocumentTitle(mode === "login" ? "Sign in" : "Create account");
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  const root = useRef<HTMLDivElement>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const tearing = useRef(false);

  // Already signed in (and not mid-animation): straight to where they were going.
  useEffect(() => {
    if (user && !tearing.current) navigate(next, { replace: true });
  }, [user, next, navigate]);

  useGSAP(
    () => {
      const tl = gsap.timeline();
      enter(".ticket", { autoAlpha: 0, y: 60, rotate: -3, duration: 1.1, ease: "power4.out" }, tl);
      enter(".stub__row", { autoAlpha: 0, x: -14, duration: 0.6, stagger: 0.06 }, tl, "-=0.6");
      enter(".auth-top > *", { autoAlpha: 0, y: -10, duration: 0.6, stagger: 0.08 }, tl, 0.1);
    },
    { scope: root },
  );

  /** Tear the stub off, then go in. */
  const onSuccess = () => {
    tearing.current = true;
    const tl = gsap.timeline({ onComplete: () => navigate(next, { replace: true }) });
    // Drop the notch mask so the stub can leave the ticket's outline.
    tl.set(".ticket", { maskImage: "none", webkitMaskImage: "none" })
      .to(".ticket__main", { autoAlpha: 0, y: 12, duration: 0.35, ease: "power2.in" })
      .to(".ticket__stub", { rotate: -9, x: -18, y: 10, duration: 0.35, ease: "power2.out" }, "<")
      .to(".ticket__stub", { y: "110vh", rotate: -24, duration: 0.8, ease: "power3.in" });
  };

  return (
    <div className="auth" ref={root}>
      <Marquee />
      <header className="auth-top">
        <Link to="/" className="auth-top__logo" aria-label="Avonera48 home">
          <LogoMark size={28} />
          <span>
            Avonera<span className="muted">48</span>
          </span>
        </Link>
        <Link to="/" className="auth-top__back">
          <Icon name="arrowLeft" size={16} />
          Back to site
        </Link>
      </header>

      <main className="auth__stage" id="main">
        <div className="ticket-shadow">
          <div className="ticket">
            <Stub mode={mode} name={name} email={email} />
            <div className="ticket__main">
              <AuthForm key={mode} mode={mode} name={name} email={email} setName={setName} setEmail={setEmail} onSuccess={onSuccess} />
            </div>
          </div>
        </div>
        <p className="auth__legal">Avonera48 is an unofficial fan project and is not affiliated with JKT48.</p>
      </main>
    </div>
  );
}

/* ---------- background: two slow rows of members ---------- */

function Marquee() {
  const ref = useRef<HTMLDivElement>(null);
  const members = useResource(() => api.listMembers({ sort: "generation" }), []);
  const faces = useMemo(() => (members.data ?? []).filter((m) => m.status !== "graduated"), [members.data]);
  const rows = useMemo(() => [faces.filter((_, k) => k % 2 === 0), faces.filter((_, k) => k % 2 === 1)], [faces]);

  useGSAP(
    () => {
      gsap.utils.toArray<HTMLElement>(".auth-marquee__track").forEach((t, k) => {
        gsap.fromTo(t, { xPercent: k ? -50 : 0 }, { xPercent: k ? 0 : -50, duration: 90, ease: "none", repeat: -1 });
      });
    },
    { scope: ref, dependencies: [faces.length] },
  );

  return (
    <div className="auth-marquee" ref={ref} aria-hidden>
      {rows.map((row, k) => (
        <div className={`auth-marquee__row auth-marquee__row--${k ? "b" : "a"}`} key={k}>
          <div className="auth-marquee__track">
            {[...row, ...row].map((m, j) => (
              <MemberPhoto key={`${m.slug}-${j}`} member={m} className="auth-marquee__face" />
            ))}
          </div>
        </div>
      ))}
      <span className="auth-marquee__word">AVONERA48</span>
    </div>
  );
}

/* ---------- the stub ---------- */

const ROWS = "ABCDEFGHJK";

function Stub({ mode, name, email }: { mode: Mode; name: string; email: string }) {
  const shows = useResource(() => api.listShows("upcoming"), []);
  const show = shows.data?.[0];
  const key = (email || name).trim().toLowerCase();
  const h = hash(key || "avonera48");
  const seat = key ? `${ROWS[h % ROWS.length]}–${String((h >>> 8) % 30 + 1).padStart(2, "0")}` : "— —";
  const serial = key ? String(h % 100000).padStart(5, "0") : "00048";
  // 46 bars whose widths come from the hash, so every viewer gets their own code.
  const bars = Array.from({ length: 46 }, (_, k) => 1 + ((h >>> (k % 27)) & 3));

  return (
    <aside className="ticket__stub" aria-label="Your ticket">
      <div className="stub__row stub__head">
        <span className="stub__admit">Admit one</span>
        <span className="stub__bars" aria-hidden>
          <i />
          <i />
          <i />
          <i />
        </span>
      </div>
      <div className="stub__row stub__title">
        <span>Theater</span>
        <span className="stub__title-outline">Room</span>
      </div>
      <dl className="stub__row stub__facts">
        <div className="stub__fact stub__fact--wide">
          <dt>Name on ticket</dt>
          <dd className={cx(!(mode === "register" ? name : email).trim() && "is-empty")}>{mode === "register" ? name.trim() || "Your name" : email.trim().split("@")[0] || "Your name"}</dd>
        </div>
        <div className="stub__fact">
          <dt>Seat</dt>
          <dd className="mono">{seat}</dd>
        </div>
        <div className="stub__fact">
          <dt>Gate</dt>
          <dd className="mono">48</dd>
        </div>
        <div className="stub__fact stub__fact--wide">
          <dt>Next on stage</dt>
          <dd>{show ? show.title : "—"}</dd>
          {show && (
            <span className="stub__when">
              {formatWeekday(show.startsAt)} {formatDate(show.startsAt, { year: undefined })} · {formatTime(show.startsAt)} WIB
            </span>
          )}
        </div>
      </dl>
      <div className="stub__row stub__code">
        <span className="stub__barcode" aria-hidden>
          {bars.map((w, k) => (
            <i key={k} style={{ width: w }} />
          ))}
        </span>
        <span className="stub__serial mono">AVN·{serial}</span>
      </div>
    </aside>
  );
}

/* ---------- the form ---------- */

function AuthForm({
  mode,
  name,
  email,
  setName,
  setEmail,
  onSuccess,
}: {
  mode: Mode;
  name: string;
  email: string;
  setName: (v: string) => void;
  setEmail: (v: string) => void;
  onSuccess: () => void;
}) {
  const { login, register } = useAuth();
  const location = useLocation();
  const ref = useRef<HTMLDivElement>(null);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AuthError | null>(null);
  const [touched, setTouched] = useState(false);

  useGSAP(
    () => {
      enter(".auth-form > *", { autoAlpha: 0, y: 14, duration: 0.6, stagger: 0.05, delay: 0.25, clearProps: "transform,opacity,visibility" });
    },
    { scope: ref },
  );

  const fieldError = (f: AuthError["field"]) => (error && error.field === f ? error.message : null);
  const local = {
    name: touched && mode === "register" && name.trim().length < 2 ? "Enter your name." : null,
    email: touched && !/^\S+@\S+\.\S+$/.test(email.trim()) ? "Enter a valid email address." : null,
    password: touched && mode === "register" && password.length < 8 ? "Use at least 8 characters." : touched && !password ? "Enter your password." : null,
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    setError(null);
    const invalid = (mode === "register" && name.trim().length < 2) || !/^\S+@\S+\.\S+$/.test(email.trim()) || (mode === "register" ? password.length < 8 : !password);
    if (invalid) {
      ref.current?.querySelector<HTMLInputElement>("[aria-invalid='true']")?.focus();
      return;
    }
    setBusy(true);
    try {
      if (mode === "login") await login(email.trim(), password);
      else await register(name.trim(), email.trim(), password);
      onSuccess();
    } catch (err) {
      setError(err instanceof AuthError ? err : new AuthError("Something went wrong. Try again."));
      setBusy(false);
      requestAnimationFrame(() => gsap.fromTo(".auth-form__alert, .auth-form [aria-invalid='true']", { x: -6 }, { x: 0, duration: 0.5, ease: "elastic.out(1, 0.3)" }));
    }
  };

  const keepNext = location.search;
  const setupProblem = error?.code === "not_configured";

  return (
    <div className="auth-form-wrap" ref={ref}>
      <form className="auth-form" onSubmit={onSubmit} noValidate>
        <nav className="auth-tabs" aria-label="Account">
          <Link to={`/login${keepNext}`} replace className={cx(mode === "login" && "is-active")} aria-current={mode === "login" ? "page" : undefined}>
            Sign in
          </Link>
          <Link to={`/register${keepNext}`} replace className={cx(mode === "register" && "is-active")} aria-current={mode === "register" ? "page" : undefined}>
            Create account
          </Link>
          <span className={cx("auth-tabs__line", mode === "register" && "is-right")} aria-hidden />
        </nav>

        <header className="auth-form__head">
          <h1>{mode === "login" ? "Welcome back." : "Get your ticket."}</h1>
          <p>{mode === "login" ? "Sign in and take your seat in the theater room." : "A free account opens the theater room on any device."}</p>
        </header>

        {error && !error.field && (
          <p className={cx("auth-form__alert", setupProblem && "is-setup")} role="alert">
            <Icon name={setupProblem ? "settings" : "alert"} size={16} />
            <span>{setupProblem ? "Sign-up is temporarily unavailable while accounts are being set up. Please try again later." : error.message}</span>
          </p>
        )}

        <div className="auth-form__fields">
          {mode === "register" && (
            <AuthField label="Name" icon="user" autoComplete="nickname" value={name} onChange={(e) => setName(e.target.value)} error={fieldError("name") ?? local.name} maxLength={40} />
          )}
          <AuthField label="Email" icon="mail" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={fieldError("email") ?? local.email} />
          <PasswordField mode={mode} value={password} onChange={setPassword} error={fieldError("password") ?? local.password} />
        </div>

        <button type="submit" className="auth-submit" disabled={busy} aria-busy={busy || undefined}>
          <span>{busy ? (mode === "login" ? "Checking your ticket…" : "Printing your ticket…") : mode === "login" ? "Enter the room" : "Get my ticket"}</span>
          <span className="auth-submit__icon" aria-hidden>
            {busy ? <span className="btn__spinner" /> : <Icon name="arrowRight" size={18} />}
          </span>
        </button>

        <p className="auth-form__alt">
          {mode === "login" ? "No ticket yet? " : "Already have one? "}
          <Link to={`/${mode === "login" ? "register" : "login"}${keepNext}`} replace>
            {mode === "login" ? "Create an account" : "Sign in"}
          </Link>
        </p>

        <p className="auth-form__note">
          <Icon name="shield" size={14} />
          <span>We keep only your name, email and a salted hash of your password.</span>
        </p>
      </form>
    </div>
  );
}

function AuthField({ label, icon, error, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: string; icon: IconName; error?: string | null }) {
  const id = useId();
  return (
    <div className={cx("auth-field", error && "is-invalid", className)}>
      <span className="auth-field__box">
        <Icon name={icon} size={17} className="auth-field__icon" />
        <input id={id} className="auth-field__input" placeholder=" " aria-invalid={!!error} aria-describedby={error ? `${id}-err` : undefined} {...rest} />
        <label htmlFor={id} className="auth-field__label">
          {label}
        </label>
      </span>
      {error && (
        <p id={`${id}-err`} className="auth-field__error">
          {error}
        </p>
      )}
    </div>
  );
}

const STRENGTH = ["Too short", "Weak", "Fair", "Good", "Strong"];

function strength(p: string) {
  if (p.length < 8) return 0;
  let s = 1;
  if (p.length >= 12) s++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++;
  if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) s++;
  return Math.min(4, s);
}

function PasswordField({ mode, value, onChange, error }: { mode: Mode; value: string; onChange: (v: string) => void; error?: string | null }) {
  const [shown, setShown] = useState(false);
  const score = strength(value);
  return (
    <div className="auth-pass">
      <AuthField
        label="Password"
        icon="lock"
        type={shown ? "text" : "password"}
        autoComplete={mode === "login" ? "current-password" : "new-password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        error={error}
        maxLength={128}
      />
      <button type="button" className="auth-pass__toggle" onClick={() => setShown((s) => !s)} aria-label={shown ? "Hide password" : "Show password"} aria-pressed={shown}>
        <Icon name={shown ? "eyeOff" : "eye"} size={17} />
      </button>
      {mode === "register" && (
        <div className="auth-meter" data-score={value ? score : undefined} aria-live="polite">
          <span className="auth-meter__bars" aria-hidden>
            {[1, 2, 3, 4].map((k) => (
              <i key={k} className={cx(value && score >= k && "is-on")} />
            ))}
          </span>
          <span className="auth-meter__label">{value ? STRENGTH[score] : "8 characters or more"}</span>
        </div>
      )}
    </div>
  );
}
