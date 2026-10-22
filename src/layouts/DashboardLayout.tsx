import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, Navigate, Outlet, useLocation } from "react-router";
import { LogoMark } from "@/components/layout/Logo";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { Icon, Verified } from "@/components/ui";
import { Dock, isActive, PenlightMenu, SetlistRail, setlistCodes, type NavItem } from "./DashNav";
import { useAuth, type Account } from "@/features/auth/AuthContext";
import { shop, type Catalog } from "@/features/members/api";
import { toDashShows, type DashShow } from "@/features/members/stage";
import { useResource } from "@/hooks/useResource";
import { enter, gsap, shift, useGSAP } from "@/motion/gsap";
import { api } from "@/services";
import { cx } from "@/utils/format";

interface DashValue {
  user: Account;
  catalog: Catalog | undefined;
  catalogError: Error | null;
  reloadCatalog: () => void;
  /** Re-reads the show listing (whether a show is live) now. */
  reloadShows: () => void;
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

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Overview", icon: "grid", end: true, dock: true },
  { to: "/dashboard/schedule", label: "Shows", icon: "ticket", dock: true },
  { to: "/dashboard/membership", label: "Membership", icon: "bolt", dock: true },
  { to: "/dashboard/transactions", label: "Transactions", icon: "list" },
  { to: "/am", label: "AM Dashboard", icon: "mail" },
  { to: "/dashboard/profile", label: "Profile", icon: "user", dock: true },
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

/** The members' area: a setlist rail on wide screens; a dock and a penlight menu on phones. */
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
      reloadShows: reloadStage,
      shows,
      showsError: stage.status === "error" && !stage.data ? stage.error : null,
      onAir,
    }),
    [user, catalog.data, catalog.status, catalog.error, catalog.reload, reloadStage, shows, stage.status, stage.data, stage.error, onAir],
  );
  const nav = NAV.filter((n) => !n.admin || user.isAdmin);
  const codes = setlistCodes(nav);
  const current = nav.findIndex((n) => isActive(n, pathname));
  const watching = pathname.startsWith("/dashboard/watch/");
  const title = pageTitle(pathname);
  const liveTo = onAir ? "/dashboard/schedule" : null;
  const [menu, setMenu] = useState(false);
  const openMenu = useCallback(() => setMenu(true), []);
  const closeMenu = useCallback(() => setMenu(false), []);

  useEffect(() => {
    window.scrollTo(0, 0);
    setMenu(false);
  }, [pathname]);

  const membership = catalog.data?.membership;
  const daysLeft = membership ? Math.max(0, Math.ceil((Date.parse(membership.expires_at) - Date.now()) / 86400000)) : 0;
  const totalDays = membership ? Math.max(1, Math.ceil((Date.parse(membership.expires_at) - Date.parse(membership.started_at)) / 86400000)) : 1;

  const root = useRef<HTMLDivElement>(null);
  const pageName = useRef<HTMLSpanElement>(null);
  const content = useRef<HTMLElement>(null);
  const [scrolled, setScrolled] = useState(false);

  useGSAP(() => enter(".dash-top", { y: shift(-14), autoAlpha: 0, duration: 0.7, delay: 0.1, clearProps: "transform,opacity,visibility" }), { scope: root });

  // Page name in the header rolls over; the page itself rises in.
  useLayoutEffect(() => {
    if (pageName.current) gsap.fromTo(pageName.current, { yPercent: 110, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.6, ease: "expo.out" });
    if (content.current && !watching) gsap.fromTo(content.current, { y: shift(14), autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.55, ease: "power3.out", clearProps: "transform,opacity,visibility" });
  }, [title, pathname, watching]);

  // Header tightens once the page scrolls.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const pass = (
    <Link to="/dashboard/membership" className={cx("dash-pass", membership && "is-active")}>
      <span className="dash-pass__label">{membership ? "Membership pass" : "No membership"}</span>
      <span className="dash-pass__name">{membership ? membership.plan_name : "Watch every show"}</span>
      <span className="dash-pass__meta">{membership ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} left` : "See plans →"}</span>
      {membership && (
        <span className="dash-pass__bar" aria-hidden>
          <i style={{ width: `${Math.min(100, (daysLeft / totalDays) * 100)}%` }} />
        </span>
      )}
    </Link>
  );
  const me = (
    <Link to="/dashboard/profile" className="dash-me">
      <UserAvatar user={user} size={36} />
      <span className="dash-me__text">
        <b>
          {user.name}
          {user.verified && <Verified size={13} />}
        </b>
        <small>{user.email}</small>
      </span>
    </Link>
  );

  return (
    <Ctx.Provider value={value}>
      <div className={cx("dash", watching && "dash--watch")} ref={root}>
        <SetlistRail
          items={nav}
          liveTo={liveTo}
          footer={
            <>
              {pass}
              {me}
              <Link to="/" className="dash-side__back">
                <Icon name="arrowLeft" size={14} />
                Back to site
              </Link>
            </>
          }
        />

        <div className="dash-main">
          <header className={cx("dash-top", scrolled && "is-scrolled", onAir && "has-onair")}>
            <Link to="/" className="dash-top__logo" aria-label="Avonera48 home">
              <LogoMark size={28} />
            </Link>
            <div className="dash-top__title">
              <span className="dash-top__mask">
                <span className="dash-top__page" ref={pageName}>
                  {current >= 0 && <span className="dash-top__code">{codes[current]}</span>}
                  {title}
                </span>
              </span>
            </div>
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
              <Link to="/dashboard/admin" className="dash-top__admin" aria-label="Admin">
                <Icon name="shield" size={15} />
              </Link>
            )}
            <ThemeToggle />
            <Link to="/dashboard/profile" className="dash-top__me" aria-label={`Profile: ${user.name}`}>
              <UserAvatar user={user} size={34} />
            </Link>
            <button type="button" className="dash-top__menu" onClick={openMenu} aria-haspopup="dialog" aria-expanded={menu} aria-label="Open the setlist">
              <Icon name="menu" size={18} />
            </button>
          </header>
          <main className="dash-content" id="main" ref={content}>
            <Outlet />
          </main>
        </div>

        <Dock items={nav} liveTo={liveTo} open={menu} onOpen={openMenu} />
        <PenlightMenu
          items={nav}
          liveTo={liveTo}
          open={menu}
          onClose={closeMenu}
          footer={
            <>
              {pass}
              {me}
            </>
          }
        />
      </div>
    </Ctx.Provider>
  );
}

const TITLES: Record<string, string> = {
  schedule: "Shows",
  membership: "Membership",
  transactions: "Transactions",
  profile: "Profile",
  admin: "Admin",
  watch: "Watch",
  pay: "Payment",
  connect: "Linked accounts",
};
const pageTitle = (path: string) => {
  const seg = path.split("/")[2];
  return seg ? (TITLES[seg] ?? "Dashboard") : "Overview";
};

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
