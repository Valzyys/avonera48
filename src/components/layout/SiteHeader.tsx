import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router";
import { Dialog, IconButton } from "@/components/ui";
import { useResource } from "@/hooks/useResource";
import { api } from "@/services";
import { cx } from "@/utils/format";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

export const primaryNav = [
  { to: "/live", label: "Live" },
  { to: "/recent-live", label: "Recent" },
  { to: "/theater", label: "Theater" },
  { to: "/members", label: "Members" },
  { to: "/news", label: "News" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const live = useResource(() => api.listLiveNow(), []);
  const liveCount = live.data?.length ?? 0;

  useEffect(() => setOpen(false), [location.pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={cx("site-header", scrolled && "is-scrolled")}>
      <div className="container site-header__inner">
        <Logo />
        <nav aria-label="Primary" className="site-nav">
          <ul>
            {primaryNav.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} viewTransition className={({ isActive }) => cx("site-nav__link", isActive && "is-active")}>
                  {item.label}
                  {item.to === "/live" && liveCount > 0 && <span className="site-nav__count num">{liveCount}</span>}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="site-header__actions">
          {liveCount > 0 && (
            <Link to="/live" viewTransition className="live-chip" aria-label={`${liveCount} members live (sample data)`}>
              <span className="live-tile__dot" aria-hidden />
              <span className="num">{liveCount}</span> live
            </Link>
          )}
          <ThemeToggle />
          <IconButton icon="menu" label="Open menu" className="site-header__menu" onClick={() => setOpen(true)} aria-expanded={open} />
        </div>
      </div>

      <Dialog open={open} onClose={() => setOpen(false)} title="Menu" variant="drawer">
        <nav aria-label="Mobile" className="drawer-nav">
          <ul>
            {[{ to: "/", label: "Home" }, ...primaryNav, { to: "/about", label: "About" }].map((item, i) => (
              <li key={item.to} className="enter" style={{ ["--i" as string]: i + 2 }}>
                <NavLink to={item.to} end={item.to === "/"} viewTransition className={({ isActive }) => cx("drawer-nav__link", isActive && "is-active")}>
                  {item.label === "Recent" ? "Recent live" : item.label}
                  {item.to === "/live" && liveCount > 0 && <span className="site-nav__count num">{liveCount}</span>}
                </NavLink>
              </li>
            ))}
          </ul>
          <div className="drawer-nav__foot">
            <span className="small">Theme</span>
            <ThemeToggle />
          </div>
        </nav>
      </Dialog>
    </header>
  );
}
