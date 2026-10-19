import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, Navigate, NavLink, Outlet, useLocation } from "react-router";
import { LogoMark } from "@/components/layout/Logo";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { Icon, Verified, type IconName } from "@/components/ui";
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

const NAV: { to: string; label: string; icon: IconName; end?: boolean; admin?: boolean }[] = [
  { to: "/dashboard", label: "Overview", icon: "grid", end: true },
  { to: "/dashboard/schedule", label: "Shows", icon: "ticket" },
  { to: "/dashboard/membership", label: "Membership", icon: "bolt" },
  { to: "/dashboard/transactions", label: "Transactions", icon: "list" },
  { to: "/am", label: "AM Dashboard", icon: "mail" },
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
      reloadShows: reloadStage,
      shows,
      showsError: stage.status === "error" && !stage.data ? stage.error : null,
      onAir,
    }),
    [user, catalog.data, catalog.status, catalog.error, catalog.reload, reloadStage, shows, stage.status, stage.data, stage.error, onAir],
  );
  const nav = NAV.filter((n) => !n.admin || user.isAdmin);
  const tabs = nav.filter((n) => !n.admin);
  const watching = pathname.startsWith("/dashboard/watch/");
  const title = pageTitle(pathname);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  const membership = catalog.data?.membership;
  const daysLeft = membership ? Math.max(0, Math.ceil((Date.parse(membership.expires_at) - Date.now()) / 86400000)) : 0;

  const root = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const pill = useRef<HTMLSpanElement>(null);
  const tabsRef = useRef<HTMLElement>(null);
  const blob = useRef<HTMLSpanElement>(null);
  const pageName = useRef<HTMLSpanElement>(null);
  const content = useRef<HTMLElement>(null);
  const [scrolled, setScrolled] = useState(false);

  // First paint: the sidebar and header come in, items one after another.
  useGSAP(
    () => {
      const tl = gsap.timeline({ defaults: { duration: 0.7, ease: "power3.out", clearProps: "transform,opacity,visibility" } });
      enter(".dash-side__panel", { x: shift(-24), autoAlpha: 0, duration: 0.8 }, tl);
      enter(".dash-side__logo, .dash-nav__link, .dash-side__foot > *", { x: shift(-14), autoAlpha: 0, stagger: 0.045 }, tl, "-=0.55");
      enter(".dash-top", { y: shift(-14), autoAlpha: 0 }, tl, 0.1);
      enter(".dash-tabs", { y: shift(40), autoAlpha: 0, duration: 0.8 }, tl, 0.2);
    },
    { scope: root },
  );

  // The active marker glides to the current page (sidebar pill, phone blob).
  useLayoutEffect(() => {
    const place = (instant: boolean) => {
      const d = instant ? 0 : 0.55;
      const link = navRef.current?.querySelector<HTMLElement>(".dash-nav__link.is-active");
      if (pill.current) {
        if (link) gsap.to(pill.current, { y: link.offsetTop, height: link.offsetHeight, autoAlpha: 1, duration: d, ease: "expo.out" });
        else gsap.to(pill.current, { autoAlpha: 0, duration: d * 0.6 });
      }
      const tab = tabsRef.current?.querySelector<HTMLElement>(".dash-tabs__link.is-active");
      if (blob.current) {
        if (tab) gsap.to(blob.current, { x: tab.offsetLeft, width: tab.offsetWidth, autoAlpha: 1, duration: d, ease: "expo.out" });
        else gsap.to(blob.current, { autoAlpha: 0, duration: d * 0.6 });
      }
      if (!instant && tab) gsap.fromTo(tab.querySelector(".dash-tabs__icon"), { scale: 0.55, y: 5 }, { scale: 1, y: 0, duration: 0.7, ease: "back.out(3)" });
    };
    place(!pill.current?.dataset.ready);
    if (pill.current) pill.current.dataset.ready = "1";
    const onResize = () => place(true);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [pathname, user.isAdmin, onAir]);

  // Page name in the header rolls over; the page itself rises in.
  useLayoutEffect(() => {
    if (pageName.current) gsap.fromTo(pageName.current, { yPercent: 110, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.6, ease: "expo.out" });
    if (content.current && !watching) gsap.fromTo(content.current, { y: shift(14), autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.55, ease: "power3.out", clearProps: "transform,opacity,visibility" });
  }, [title, pathname, watching]);

  // Header tightens once the page scrolls; the phone dock steps aside while
  // reading down and comes back on the way up.
  useEffect(() => {
    let last = window.scrollY;
    let hidden = false;
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 8);
      const dock = tabsRef.current;
      if (dock && Math.abs(y - last) > 6) {
        const hide = y > last && y > 120;
        if (hide !== hidden) {
          hidden = hide;
          gsap.to(dock, { yPercent: hide ? 150 : 0, duration: hide ? 0.4 : 0.6, ease: hide ? "power2.in" : "expo.out" });
        }
        last = y;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <Ctx.Provider value={value}>
      <div className={cx("dash", watching && "dash--watch")} ref={root}>
        <aside className="dash-side" aria-label="Dashboard">
          <div className="dash-side__panel">
            <Link to="/" className="dash-side__logo" aria-label="Avonera48 home">
              <LogoMark size={32} />
              <span className="dash-side__brand">
                <b>
                  Avonera<span className="muted">48</span>
                </b>
                <small>Dashboard</small>
              </span>
            </Link>

            <nav className="dash-nav" ref={navRef}>
              <span className="dash-nav__pill" ref={pill} aria-hidden />
              {nav.map((n) => (
                <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => cx("dash-nav__link", isActive && "is-active", n.admin && "dash-nav__link--admin")}>
                  <span className="dash-nav__icon">
                    <Icon name={n.icon} size={17} />
                  </span>
                  <span className="dash-nav__label">{n.label}</span>
                  {n.to === "/dashboard/schedule" && onAir && <span className="dash-nav__live">Live</span>}
                </NavLink>
              ))}
            </nav>

            <div className="dash-side__foot">
              <Link to="/dashboard/membership" className={cx("dash-pass", membership && "is-active")}>
                <span className="dash-pass__label">{membership ? "Membership" : "No membership"}</span>
                <span className="dash-pass__name">{membership ? membership.plan_name : "Watch every show"}</span>
                <span className="dash-pass__meta">{membership ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} left` : "See plans →"}</span>
                {membership && (
                  <span className="dash-pass__bar" aria-hidden>
                    <i style={{ width: `${Math.min(100, (daysLeft / Math.max(1, Math.ceil((Date.parse(membership.expires_at) - Date.parse(membership.started_at)) / 86400000))) * 100)}%` }} />
                  </span>
                )}
              </Link>
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
              <Link to="/" className="dash-side__back">
                <Icon name="arrowLeft" size={14} />
                Back to site
              </Link>
            </div>
          </div>
        </aside>

        <div className="dash-main">
          <header className={cx("dash-top", scrolled && "is-scrolled", onAir && "has-onair")}>
            <Link to="/" className="dash-top__logo" aria-label="Avonera48 home">
              <LogoMark size={28} />
            </Link>
            <div className="dash-top__title">
              <span className="dash-top__crumb">Dashboard</span>
              <span className="dash-top__sep" aria-hidden>
                /
              </span>
              <span className="dash-top__mask">
                <span className="dash-top__page" ref={pageName}>
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
          </header>
          <main className="dash-content" id="main" ref={content}>
            <Outlet />
          </main>
        </div>

        <nav className="dash-tabs" aria-label="Dashboard" ref={tabsRef}>
          <span className="dash-tabs__blob" ref={blob} aria-hidden />
          {tabs.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => cx("dash-tabs__link", isActive && "is-active")}>
              <span className="dash-tabs__icon">
                <Icon name={n.icon} size={20} />
                {n.to === "/dashboard/schedule" && onAir && <i className="dash-tabs__dot" aria-label="A show is live" />}
              </span>
              <span className="dash-tabs__label">{n.label}</span>
            </NavLink>
          ))}
        </nav>
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
