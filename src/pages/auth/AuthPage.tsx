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
import { cx, formatTime, formatWeekday } from "@/utils/format";

type Mode = "login" | "register";

/** Only same-site paths are allowed as a post-login destination. */
const safeNext = (v: string | null) => (v && /^\/(?!\/)[\w\-/?=&%.]*$/.test(v) ? v : "/dashboard");

export function LoginPage() {
  return <AuthPage mode="login" />;
}

export function RegisterPage() {
  return <AuthPage mode="register" />;
}

function AuthPage({ mode }: { mode: Mode }) {
  useDocumentTitle(mode === "login" ? "Sign in" : "Create account");
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));

  // Already signed in: straight to where they were going.
  useEffect(() => {
    if (user) navigate(next, { replace: true });
  }, [user, next, navigate]);

  return (
    <div className="auth">
      <Stage mode={mode} />
      <main className="auth__panel" id="main">
        <div className="auth__panel-top">
          <Link to="/" className="auth__back">
            <Icon name="arrowLeft" size={16} />
            Back to site
          </Link>
        </div>
        <AuthForm key={mode} mode={mode} next={next} />
        <p className="auth__legal">Avonera48 is an unofficial fan project and is not affiliated with JKT48.</p>
      </main>
    </div>
  );
}

/* ---------- the stage (left panel) ---------- */

function Stage({ mode }: { mode: Mode }) {
  const ref = useRef<HTMLElement>(null);
  const members = useResource(() => api.listMembers({ sort: "generation" }), []);
  const shows = useResource(() => api.listShows("upcoming"), []);
  const faces = useMemo(() => (members.data ?? []).filter((m) => m.status !== "graduated"), [members.data]);
  const columns = useMemo(() => [0, 1, 2].map((c) => faces.filter((_, k) => k % 3 === c)), [faces]);
  const show = shows.data?.[0];

  useGSAP(
    () => {
      // Portrait columns drift in opposite directions, like a slow curtain of faces.
      gsap.utils.toArray<HTMLElement>(".stage__col-track").forEach((track, k) => {
        const dir = k % 2 ? 1 : -1;
        gsap.fromTo(track, { yPercent: dir > 0 ? -50 : 0 }, { yPercent: dir > 0 ? 0 : -50, duration: 60 + k * 12, ease: "none", repeat: -1 });
      });
      gsap.to(".stage__beam", { rotate: (k) => (k % 2 ? -14 : 14), duration: (k) => 6 + k * 1.7, ease: "sine.inOut", yoyo: true, repeat: -1 });
    },
    { scope: ref, dependencies: [faces.length] },
  );

  useGSAP(
    () => {
      enter(".stage__line-inner", { yPercent: 110, duration: 1, ease: "power4.out", stagger: 0.08 });
      enter(".stage__kicker, .stage__foot", { autoAlpha: 0, y: 10, duration: 0.7, stagger: 0.1, delay: 0.3 });
    },
    { scope: ref, dependencies: [mode], revertOnUpdate: true },
  );

  const lines = mode === "login" ? ["Your seat", "is waiting."] : ["Take your", "seat."];

  return (
    <aside className="stage" ref={ref} aria-label="Avonera48">
      <div className="stage__wall" aria-hidden>
        {columns.map((col, k) => (
          <div className="stage__col" key={k}>
            <div className="stage__col-track">
              {[...col, ...col].map((m, j) => (
                <MemberPhoto key={`${m.slug}-${j}`} member={m} className="stage__face" />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="stage__shade" aria-hidden />
      <span className="stage__beam stage__beam--a" aria-hidden />
      <span className="stage__beam stage__beam--b" aria-hidden />
      <span className="stage__beam stage__beam--c" aria-hidden />

      <Link to="/" className="stage__logo" aria-label="Avonera48 home">
        <LogoMark size={30} />
        <span>
          Avonera<span className="stage__logo-48">48</span>
        </span>
      </Link>

      <div className="stage__copy">
        <p className="stage__kicker">Members’ theater room</p>
        <h2 className="stage__title">
          {lines.map((l, k) => (
            <span className="stage__line" key={l}>
              <span className={cx("stage__line-inner", k === lines.length - 1 && "stage__line-inner--outline")}>{l}</span>
            </span>
          ))}
        </h2>
      </div>

      <div className="stage__foot">
        {show ? (
          <div className="stage__show">
            <span className="stage__show-dot" aria-hidden />
            <span>
              <span className="stage__show-label">Next on stage</span>
              <span className="stage__show-title">{show.title}</span>
              <span className="stage__show-time">
                {formatWeekday(show.startsAt)} · {formatTime(show.startsAt)} WIB
              </span>
            </span>
          </div>
        ) : (
          <span />
        )}
        <span className="stage__bar" aria-hidden>
          <i />
          <i />
          <i />
          <i />
        </span>
      </div>
    </aside>
  );
}

/* ---------- the form (right panel) ---------- */

function AuthForm({ mode, next }: { mode: Mode; next: string }) {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const ref = useRef<HTMLDivElement>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AuthError | null>(null);
  const [touched, setTouched] = useState(false);

  useGSAP(
    () => {
      enter(".auth-form > *", { autoAlpha: 0, y: 16, duration: 0.65, stagger: 0.06, clearProps: "transform,opacity,visibility" });
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
      navigate(next, { replace: true });
    } catch (err) {
      const e2 = err instanceof AuthError ? err : new AuthError("Something went wrong. Try again.");
      setError(e2);
      gsap.fromTo(".auth-form__alert, .auth-form [aria-invalid='true']", { x: -6 }, { x: 0, duration: 0.5, ease: "elastic.out(1, 0.3)" });
    } finally {
      setBusy(false);
    }
  };

  const keepNext = location.search;

  return (
    <div className="auth-form-wrap" ref={ref}>
      <form className="auth-form" onSubmit={onSubmit} noValidate>
        <nav className="auth-switch" aria-label="Account">
          <span className={cx("auth-switch__pill", mode === "register" && "is-right")} aria-hidden />
          <Link to={`/login${keepNext}`} replace className={cx(mode === "login" && "is-active")} aria-current={mode === "login" ? "page" : undefined}>
            Sign in
          </Link>
          <Link to={`/register${keepNext}`} replace className={cx(mode === "register" && "is-active")} aria-current={mode === "register" ? "page" : undefined}>
            Create account
          </Link>
        </nav>

        <header className="auth-form__head">
          <h1>{mode === "login" ? "Welcome back" : "Create your account"}</h1>
          <p>{mode === "login" ? "Sign in to enter the theater room." : "One free account opens the theater room on every device."}</p>
        </header>

        {error && !error.field && (
          <p className="auth-form__alert" role="alert">
            <Icon name="alert" size={16} />
            {error.message}
          </p>
        )}

        {mode === "register" && (
          <AuthField label="Name" icon="user" autoComplete="nickname" value={name} onChange={(e) => setName(e.target.value)} error={fieldError("name") ?? local.name} maxLength={40} />
        )}
        <AuthField label="Email" icon="mail" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={fieldError("email") ?? local.email} />
        <PasswordField mode={mode} value={password} onChange={setPassword} error={fieldError("password") ?? local.password} />

        <button type="submit" className="auth-submit" disabled={busy} aria-busy={busy || undefined}>
          <span className="auth-submit__label">{busy ? (mode === "login" ? "Signing in…" : "Creating account…") : mode === "login" ? "Sign in" : "Create account"}</span>
          {busy ? <span className="btn__spinner" aria-hidden /> : <Icon name="arrowRight" size={18} />}
        </button>

        <p className="auth-form__alt">
          {mode === "login" ? "New here? " : "Already have an account? "}
          <Link to={`/${mode === "login" ? "register" : "login"}${keepNext}`} replace>
            {mode === "login" ? "Create an account" : "Sign in"}
          </Link>
        </p>

        <p className="auth-form__note">
          <Icon name="shield" size={14} />
          We keep only your name, email and a salted hash of your password.
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
