import { Link } from "react-router";
import { cx } from "@/utils/format";

export function LogoMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" aria-hidden focusable="false" className="logo-mark">
      <rect width="26" height="26" rx="7" style={{ fill: "var(--text)" }} />
      <path d="M8 19 12.2 7h1.6L18 19h-2.1l-1-3h-3.8l-1 3Zm3.7-4.8h2.6L13 10.3Z" style={{ fill: "var(--bg)" }} />
      <circle cx="20.5" cy="5.5" r="2.5" style={{ fill: "var(--live)" }} />
    </svg>
  );
}

export function Logo({ to = "/", className }: { to?: string; className?: string }) {
  return (
    <Link to={to} viewTransition className={cx("logo", className)} aria-label="Avonera48 home">
      <LogoMark />
      <span className="logo__word" aria-hidden>
        Avonera<span className="muted">48</span>
      </span>
    </Link>
  );
}
