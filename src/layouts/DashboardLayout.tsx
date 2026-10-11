import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, Navigate, NavLink, Outlet, useLocation } from "react-router";
import { LogoMark } from "@/components/layout/Logo";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { Icon, type IconName } from "@/components/ui";
import { useAuth, type Account } from "@/features/auth/AuthContext";
import { shop, type Catalog } from "@/features/members/api";
import { toDashShows, type DashShow } from "@/features/members/stage";
import { useResource } from "@/hooks/useResource";
import { api } from "@/services";
import { cx } from "@/utils/format";

interface DashValue {
  user: Account;
  catalog: Catalog | undefined;
  catalogError: Error | null;
  reloadCatalog: () => void;
  /** Shows on sale (IDN Plus listing), refreshed every minute; null when the list can't be read. */
  shows: DashShow[] | undefined;
  showsError: Error | null;
  /** The show on air right now, if any. */
  onAir: DashShow | undefined;
}

const Ctx = createContext<DashValue | null>(null);

export function useDash() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useDash outside DashboardLayout");
  return v;
}

const NAV: { to: string; label: string; icon: IconName; end?: boolean; admin?: boolean }[] = [
  { to: "/dashboard", label: "Overview", icon: "grid", end: true },
  { to: "/dashboard/schedule", label: "Shows", icon: "ticket" },
  { to: "/dashboard/membership", label: "Membership", icon: "bolt" },
  { to: "/dashboard/transactions", label: "Transactions", icon: "list" },
  { to: "/dashboard/profile", label: "Profile", icon: "user" },
  { to: "/dashboard/admin", label: "Admin", icon: "shield", admin: true },
];

export function UserAvatar({ user, size = 36, className }: { user: Pick<Account, "name" | "avatar">; size?: number; className?: string }) {
  const [broken, setBroken] = useState(false);
  return (
    <span className={cx("u-avatar", className)} style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }} aria-hidden>
      {user.avatar && !broken ? <img src={user.avatar} alt="" onError={() => setBroken(true)} /> : (user.name[0] ?? "?").toUpperCase()}
    </span>
  );
}

/** The members' area: sidebar on wide screens, tab bar on phones. */
export function DashboardLayout() {
  const { user } = useAuth();
  const { pathname, search } = useLocation();
  if (user === null) return <Navigate to={`/login?next=${encodeURIComponent(pathname + search)}`} replace />;
  if (!user) {
    return (
      <div className="dash-boot" aria-busy="true">
        <LogoMark size={40} />
      </div>
    );
  }
  return <Shell user={user} />;
}

function Shell({ user }: { user: Account }) {
  const { pathname } = useLocation();
  const catalog = useResource(() => shop.catalog(), []);
  const stage = useResource(() => shop.shows(), []);
  // The site schedule only adds team and lineup; the dashboard works without it.
  const schedule = useResource(() => api.listShows().catch(() => []), []);
  const reloadStage = stage.reload;
  useEffect(() => {
    const t = window.setInterval(() => document.visibilityState === "visible" && reloadStage(), 60_000);
    return () => window.clearInterval(t);
  }, [reloadStage]);
  const shows = useMemo(() => (stage.data ? toDashShows(stage.data, schedule.data) : undefined), [stage.data, schedule.data]);
  const onAir = shows?.find((s) => s.onAir);
  const value = useMemo<DashValue>(
    () => ({
      user,
      catalog: catalog.data,
      catalogError: catalog.status === "error" ? catalog.error : null,
      reloadCatalog: catalog.reload,
      shows,
      showsError: stage.status === "error" && !stage.data ? stage.error : null,
      onAir,
    }),
    [user, catalog.data, catalog.status, catalog.error, catalog.reload, shows, stage.status, stage.data, stage.error, onAir],
  );
  const nav = NAV.filter((n) => !n.admin || user.isAdmin);
  const watching = pathname.startsWith("/dashboard/watch/");

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  const membership = catalog.data?.membership;
  const daysLeft = membership ? Math.max(0, Math.ceil((Date.parse(membership.expires_at) - Date.now()) / 86400000)) : 0;

  return (
    <Ctx.Provider value={value}>
      <div className={cx("dash", watching && "dash--watch")}>
        <aside className="dash-side" aria-label="Dashboard">
          <Link to="/" className="dash-side__logo" aria-label="Avonera48 home">
            <LogoMark size={30} />
            <span>
              Avonera<span className="muted">48</span>
            </span>
          </Link>
          <p className="dash-side__label">Dashboard</p>
          <nav className="dash-nav">
            {nav.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => cx("dash-nav__link", isActive && "is-active", n.admin && "dash-nav__link--admin")}>
                <Icon name={n.icon} size={18} />
                <span>{n.label}</span>
                {n.to === "/dashboard/schedule" && onAir && <span className="dash-nav__live">Live</span>}
              </NavLink>
            ))}
          </nav>
          <div className="dash-side__foot">
            <Link to="/dashboard/membership" className={cx("dash-pass", membership && "is-active")}>
              <span className="dash-pass__label">{membership ? "Membership" : "No membership"}</span>
              <span className="dash-pass__name">{membership ? membership.plan_name : "Watch every show"}</span>
              <span className="dash-pass__meta">{membership ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} left` : "See plans →"}</span>
            </Link>
            <Link to="/" className="dash-side__back">
              <Icon name="arrowLeft" size={15} />
              Back to site
            </Link>
          </div>
        </aside>

        <div className="dash-main">
          <header className="dash-top">
            <Link to="/" className="dash-top__logo" aria-label="Avonera48 home">
              <LogoMark size={28} />
            </Link>
            {onAir && (
              <Link to={`/dashboard/watch/${onAir.slug}`} className="dash-onair" aria-label={`On air now: ${onAir.title}`}>
                <span className="dash-onair__badge">
                  <i aria-hidden /> Live
                </span>
                <span className="dash-onair__title">{onAir.title}</span>
                <Icon name="arrowRight" size={14} />
              </Link>
            )}
            <span className="dash-top__spacer" />
            {user.isAdmin && (
              <Link to="/dashboard/admin" className="dash-top__admin">
                <Icon name="shield" size={14} /> Admin
              </Link>
            )}
            <ThemeToggle />
            <Link to="/dashboard/profile" className="dash-top__me" aria-label={`Profile: ${user.name}`}>
              <UserAvatar user={user} size={34} />
              <span className="dash-top__name">{user.name}</span>
            </Link>
          </header>
          <main className="dash-content" id="main">
            <Outlet />
          </main>
        </div>

        <nav className="dash-tabs" aria-label="Dashboard">
          {nav
            .filter((n) => !n.admin)
            .map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => cx("dash-tabs__link", isActive && "is-active")}>
                <span className="dash-tabs__icon">
                  <Icon name={n.icon} size={20} />
                  {n.to === "/dashboard/schedule" && onAir && <i className="dash-tabs__dot" aria-label="A show is live" />}
                </span>
                <span>{n.label}</span>
              </NavLink>
            ))}
        </nav>
      </div>
    </Ctx.Provider>
  );
}

/** Page heading used across the dashboard. */
export function DashHead({ kicker, title, children }: { kicker?: string; title: ReactNode; children?: ReactNode }) {
  return (
    <header className="dash-head">
      <div>
        {kicker && <p className="dash-head__kicker">{kicker}</p>}
        <h1 className="dash-head__title">{title}</h1>
      </div>
      {children && <div className="dash-head__aside">{children}</div>}
    </header>
  );
}
