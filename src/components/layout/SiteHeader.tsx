import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router";
import { Avatar } from "@/components/media/Media";
import { Icon } from "@/components/ui";
import { useAuth } from "@/features/auth/AuthContext";
import { useResource } from "@/hooks/useResource";
import { gsap, useGSAP } from "@/motion/gsap";
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

const menuNav = [{ to: "/", label: "Home" }, ...primaryNav.map((n) => (n.label === "Recent" ? { ...n, label: "Recent live" } : n)), { to: "/about", label: "About" }, { to: "/dashboard", label: "Theater room" }];

/**
 * Floating capsule header. A soft "blob" slides under whichever link the
 * pointer is on and settles back on the current page; the capsule tucks
 * away while scrolling down and returns on the way up.
 */
export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const live = useResource(() => api.listLiveNow(), []);
  const liveItems = live.data ?? [];
  const liveCount = liveItems.length;
  const bar = useRef<HTMLDivElement>(null);
  const nav = useRef<HTMLUListElement>(null);
  const blob = useRef<HTMLSpanElement>(null);

  useEffect(() => setOpen(false), [location.pathname]);

  // Blob: move to an element, or to the active link (hidden if none).
  const moveBlob = useCallback((target?: HTMLElement | null, instant = false) => {
    const b = blob.current;
    const list = nav.current;
    if (!b || !list) return;
    const el = target ?? list.querySelector<HTMLElement>(".site-nav__link.is-active");
    if (!el) {
      gsap.to(b, { autoAlpha: 0, scale: 0.6, duration: 0.3 });
      return;
    }
    const r = el.getBoundingClientRect();
    const p = list.getBoundingClientRect();
    gsap.to(b, { x: r.left - p.left, width: r.width, autoAlpha: 1, scale: 1, duration: instant ? 0 : 0.45, ease: "elastic.out(1, 0.75)" });
  }, []);
  useLayoutEffect(() => moveBlob(null, true), [location.pathname, moveBlob]);
  // Re-measure whenever the links change size: fonts arriving, the live
  // count badge appearing, a resize.
  useEffect(() => {
    const list = nav.current;
    if (!list) return;
    const ro = new ResizeObserver(() => moveBlob(null, true));
    list.querySelectorAll(".site-nav__link").forEach((el) => ro.observe(el));
    ro.observe(list);
    document.fonts?.ready.then(() => moveBlob(null, true));
    return () => ro.disconnect();
  }, [moveBlob, liveCount]);

  // Tuck away on scroll down, return on scroll up; tighten once off the top.
  useGSAP(
    () => {
      const el = bar.current;
      if (!el) return;
      gsap.from(el, { yPercent: -160, duration: 0.9, ease: "power4.out", delay: 0.1 });
      let last = window.scrollY;
      let hidden = false;
      const onScroll = () => {
        const y = window.scrollY;
        el.classList.toggle("is-scrolled", y > 8);
        const down = y > last && y > 140;
        if (down !== hidden) {
          hidden = down;
          gsap.to(el, { yPercent: down ? -160 : 0, duration: down ? 0.35 : 0.6, ease: down ? "power2.in" : "power4.out", overwrite: true });
        }
        last = y;
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      return () => window.removeEventListener("scroll", onScroll);
    },
    { scope: bar },
  );

  return (
    <header className="site-header">
      <div className="site-header__bar" ref={bar}>
        <Logo />
        <nav aria-label="Primary" className="site-nav" onPointerLeave={() => moveBlob(null)}>
          <ul ref={nav}>
            <span className="site-nav__blob" ref={blob} aria-hidden />
            {primaryNav.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  viewTransition
                  className={({ isActive }) => cx("site-nav__link", isActive && "is-active")}
                  onPointerEnter={(e) => moveBlob(e.currentTarget)}
                  onFocus={(e) => moveBlob(e.currentTarget)}
                  onBlur={() => moveBlob(null)}
                >
                  {item.label}
                  {item.to === "/live" && liveCount > 0 && <span className="site-nav__count num">{liveCount}</span>}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="site-header__actions">
          {liveCount > 0 && (
            <Link to="/live" viewTransition className="live-chip" aria-label={`${liveCount} members live`}>
              <span className="live-chip__faces" aria-hidden>
                {liveItems.slice(0, 3).map((l) => (
                  <Avatar key={l.id} member={l.member} size={22} />
                ))}
              </span>
              <span className="live-chip__dot" aria-hidden />
              <span className="num">{liveCount}</span>
              <span className="live-chip__word">live</span>
            </Link>
          )}
          <AccountButton />
          <ThemeToggle />
          <button type="button" className={cx("menu-btn", open && "is-open")} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="site-menu" aria-label={open ? "Close menu" : "Open menu"}>
            <span />
            <span />
          </button>
        </div>
      </div>
      <MobileMenu open={open} onClose={() => setOpen(false)} liveCount={liveCount} />
    </header>
  );
}

/**
 * Full-screen menu. It opens as a circle growing out of the menu button,
 * the links rise out of their masks one by one, and it folds back the same
 * way. Escape or a link closes it.
 */
function MobileMenu({ open, onClose, liveCount }: { open: boolean; onClose: () => void; liveCount: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const tl = useRef<gsap.core.Timeline | null>(null);
  const members = useResource(() => api.listMembers({ sort: "generation" }), []);
  const faces = (members.data ?? []).filter((m) => m.photoUrl && m.status === "active").slice(0, 8);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const q = gsap.utils.selector(el);
      tl.current = gsap
        .timeline({ paused: true, onReverseComplete: () => void gsap.set(el, { visibility: "hidden" }) })
        .set(el, { visibility: "visible" })
        .fromTo(el, { clipPath: "circle(0% at var(--mx) var(--my))" }, { clipPath: "circle(150% at var(--mx) var(--my))", duration: 0.7, ease: "power3.inOut" })
        .fromTo(q(".menu__link > span"), { yPercent: 110, rotate: 4 }, { yPercent: 0, rotate: 0, duration: 0.6, ease: "power4.out", stagger: 0.05 }, "-=0.35")
        .fromTo(q(".menu__index"), { autoAlpha: 0, x: -8 }, { autoAlpha: 1, x: 0, duration: 0.4, stagger: 0.05 }, "<0.1")
        .fromTo(q(".menu__foot > *"), { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.45, stagger: 0.06 }, "-=0.35");
    },
    { scope: ref },
  );

  useEffect(() => {
    const el = ref.current;
    const t = tl.current;
    if (!el || !t) return;
    if (open) {
      const btn = document.querySelector<HTMLElement>(".menu-btn");
      const r = btn?.getBoundingClientRect();
      el.style.setProperty("--mx", `${r ? r.left + r.width / 2 : window.innerWidth - 32}px`);
      el.style.setProperty("--my", `${r ? r.top + r.height / 2 : 32}px`);
      document.documentElement.classList.add("menu-open");
      t.timeScale(1).play();
      el.querySelector<HTMLElement>(".menu__link")?.focus({ preventScroll: true });
      const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }
    document.documentElement.classList.remove("menu-open");
    t.timeScale(1.6).reverse();
  }, [open, onClose]);

  return (
    <div id="site-menu" className="menu" ref={ref} role="dialog" aria-modal="true" aria-label="Menu" aria-hidden={!open} inert={!open}>
      <nav aria-label="Mobile">
        <ol className="menu__list">
          {menuNav.map((item, k) => (
            <li key={item.to}>
              <NavLink to={item.to} end={item.to === "/"} viewTransition className={({ isActive }) => cx("menu__link", isActive && "is-active")} onClick={onClose}>
                <span className="menu__index num">{String(k + 1).padStart(2, "0")}</span>
                <span>
                  {item.label}
                  {item.to === "/live" && liveCount > 0 && <sup className="menu__count num">{liveCount}</sup>}
                </span>
              </NavLink>
            </li>
          ))}
        </ol>
      </nav>
      <div className="menu__foot">
        <div className="menu__faces" aria-hidden>
          {faces.map((m) => (
            <Avatar key={m.slug} member={m} size={40} />
          ))}
        </div>
        <div className="menu__theme">
          <span className="small">Theme</span>
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}

/** Sign-in pill, or the signed-in member's initial linking to the theater room. */
function AccountButton() {
  const { user } = useAuth();
  if (user === undefined) return null;
  if (!user) {
    return (
      <Link to="/login" className="account-btn" aria-label="Sign in">
        <Icon name="user" size={15} />
        <span className="account-btn__word">Sign in</span>
      </Link>
    );
  }
  return (
    <Link to="/dashboard" className="account-btn account-btn--in" aria-label={`Theater room, signed in as ${user.name}`} title={user.name}>
      <span className="account-btn__avatar" aria-hidden>
        {user.name[0]?.toUpperCase()}
      </span>
      <span className="account-btn__word">Room</span>
    </Link>
  );
}
