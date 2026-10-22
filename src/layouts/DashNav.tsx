import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link, NavLink, useLocation } from "react-router";
import { LogoMark } from "@/components/layout/Logo";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { Icon, type IconName } from "@/components/ui";
import { enter, gsap, shift, useGSAP } from "@/motion/gsap";
import { cx } from "@/utils/format";

export interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  end?: boolean;
  admin?: boolean;
  /** Shown in the phone dock (the rest live behind the curtain). */
  dock?: boolean;
}

/** Setlist numbering: M01, M02… for the show, EN1… for the encore (admin). */
export function setlistCodes(items: NavItem[]) {
  let m = 0;
  let en = 0;
  return items.map((n) => (n.admin ? `EN${++en}` : `M${String(++m).padStart(2, "0")}`));
}

export const isActive = (n: NavItem, path: string) => (n.end ? path === n.to : path === n.to || path.startsWith(n.to + "/"));

const today = () => new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", timeZone: "Asia/Jakarta" }).format(new Date()).replace(".", "").toUpperCase();

function LiveTag() {
  return (
    <span className="live-tag">
      <i aria-hidden /> Live
    </span>
  );
}

function Eq() {
  return (
    <span className="eq" aria-hidden>
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}

/* ------------------------------------------------------------------------ */
/* Desktop: the setlist rail. A follow-spot hangs from the truss at the top  */
/* and swings onto the current page; the lit row plays an equalizer.         */
/* ------------------------------------------------------------------------ */

export function SetlistRail({ items, liveTo, footer }: { items: NavItem[]; liveTo: string | null; footer: ReactNode }) {
  const { pathname } = useLocation();
  const codes = setlistCodes(items);
  const panel = useRef<HTMLDivElement>(null);
  const beam = useRef<HTMLSpanElement>(null);
  const lamp = useRef<HTMLSpanElement>(null);
  const spot = useRef<HTMLSpanElement>(null);
  const placed = useRef(false);
  const replace = useRef<() => void>(() => undefined);
  const firstEncore = items.findIndex((n) => n.admin);

  useGSAP(
    () => {
      const tl = gsap.timeline({ defaults: { duration: 0.7, ease: "power3.out" } });
      enter(".rail", { x: shift(-28), autoAlpha: 0, duration: 0.9 }, tl);
      enter(".rail__truss", { scaleX: 0, duration: 0.9, ease: "expo.out" }, tl, "-=0.6");
      enter(".rail__logo, .rail__head", { y: shift(-10), autoAlpha: 0, stagger: 0.06 }, tl, "-=0.6");
      enter(".setlist__item, .setlist__encore", { x: shift(-18), autoAlpha: 0, stagger: 0.05 }, tl, "-=0.5");
      enter(".rail__foot > *", { y: shift(14), autoAlpha: 0, stagger: 0.06 }, tl, "-=0.4");
      // The rows were measured mid-slide; aim the spot again once they're home.
      tl.eventCallback("onComplete", () => replace.current());
    },
    { scope: panel },
  );

  useLayoutEffect(() => {
    const place = (instant: boolean) => {
      const p = panel.current;
      const link = p?.querySelector<HTMLElement>(".setlist__item.is-active");
      const targets = [beam.current, lamp.current, spot.current];
      if (!p || !link) {
        gsap.to(targets, { autoAlpha: 0, duration: 0.3 });
        return;
      }
      const pr = p.getBoundingClientRect();
      const lr = link.getBoundingClientRect();
      const all = [...p.querySelectorAll<HTMLElement>(".setlist__item")];
      const k = all.indexOf(link) / Math.max(1, all.length - 1);
      // The lamp rides the truss: top rows are lit from the left, lower ones from the right.
      const ax = pr.width * (0.22 + 0.56 * k);
      const d = instant ? 0 : 0.75;
      const geo = { "--ax": ax, "--l": lr.left - pr.left + 4, "--r": lr.right - pr.left - 4, "--b": lr.bottom - pr.top - 6 };
      gsap.to(beam.current, { ...geo, autoAlpha: 1, duration: d, ease: "expo.out" });
      gsap.to(lamp.current, { x: ax, autoAlpha: 1, duration: d, ease: "expo.out" });
      gsap.to(spot.current, { y: link.offsetTop, height: link.offsetHeight, autoAlpha: 1, duration: d, ease: "expo.out" });
      if (!instant) {
        // A follow-spot dims while it travels, then hits the mark.
        gsap.to(beam.current, { keyframes: { opacity: [1, 0.2, 0.55, 0.3, 1] }, duration: 0.8, ease: "none" });
        gsap.fromTo(link.querySelector(".setlist__label"), { letterSpacing: "0.12em" }, { letterSpacing: "0em", duration: 0.7, ease: "expo.out" });
      }
    };
    place(!placed.current);
    placed.current = true;
    replace.current = () => place(true);
    window.addEventListener("resize", replace.current);
    return () => window.removeEventListener("resize", replace.current);
  }, [pathname, items.length, liveTo]);

  return (
    <aside className="dash-side" aria-label="Dashboard">
      <div className="rail" ref={panel}>
        <span className="rail__truss" aria-hidden>
          <span className="rail__lamp" ref={lamp} />
        </span>
        <span className="rail__beam" ref={beam} aria-hidden />

        <Link to="/" className="rail__logo" aria-label="Avonera48 home">
          <LogoMark size={30} />
          <span className="rail__brand">
            <b>
              Avonera<span>48</span>
            </b>
            <small>Members’ stage</small>
          </span>
        </Link>

        <p className="rail__head" aria-hidden>
          <span>Setlist</span>
          <span>{today()}</span>
        </p>

        <nav className="setlist" aria-label="Dashboard pages">
          <span className="setlist__spot" ref={spot} aria-hidden />
          {items.map((n, i) => (
            <SetlistLink key={n.to} item={n} code={codes[i]} live={liveTo === n.to} encore={i === firstEncore} />
          ))}
        </nav>

        <div className="rail__foot">{footer}</div>
      </div>
    </aside>
  );
}

function SetlistLink({ item, code, live, encore }: { item: NavItem; code: string; live: boolean; encore: boolean }) {
  return (
    <>
      {encore && (
        <span className="setlist__encore" aria-hidden>
          Encore
        </span>
      )}
      <NavLink to={item.to} end={item.end} className={({ isActive: a }) => cx("setlist__item", a && "is-active")}>
        <span className="setlist__code">{code}</span>
        <span className="setlist__icon">
          <Icon name={item.icon} size={16} />
        </span>
        <span className="setlist__label">{item.label}</span>
        {live ? <LiveTag /> : <Eq />}
      </NavLink>
    </>
  );
}

/* ------------------------------------------------------------------------ */
/* Phone: a floating dock. The marker is a drop of ink that stretches to    */
/* the next tab and snaps into place; the middle button draws the curtain.  */
/* ------------------------------------------------------------------------ */

export function Dock({ items, liveTo, open, onOpen }: { items: NavItem[]; liveTo: string | null; open: boolean; onOpen: () => void }) {
  const { pathname } = useLocation();
  const dock = useRef<HTMLElement>(null);
  const blob = useRef<HTMLSpanElement>(null);
  const last = useRef<{ x: number; w: number } | null>(null);
  const shown = items.filter((n) => n.dock);
  const half = Math.ceil(shown.length / 2);
  const offDock = !shown.some((n) => isActive(n, pathname));

  useGSAP(() => enter(dock.current, { y: shift(60), autoAlpha: 0, duration: 0.9, delay: 0.15, ease: "expo.out" }), { scope: dock });

  useLayoutEffect(() => {
    const tab = dock.current?.querySelector<HTMLElement>(".dock__tab.is-active");
    const b = blob.current;
    if (!b) return;
    if (!tab) {
      gsap.to(b, { scale: 0.2, autoAlpha: 0, duration: 0.3, ease: "power2.in" });
      last.current = null;
      return;
    }
    const to = { x: tab.offsetLeft + 6, w: tab.offsetWidth - 12 };
    const from = last.current;
    gsap.killTweensOf(b);
    if (!from) {
      gsap.fromTo(b, { x: to.x, width: to.w, scale: 0.4, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.5, ease: "back.out(2.4)" });
    } else {
      // Stretch across both tabs, then let go: the far edge springs to the new tab.
      const left = Math.min(from.x, to.x);
      const right = Math.max(from.x + from.w, to.x + to.w);
      gsap
        .timeline()
        .to(b, { x: left, width: right - left, scaleY: 0.78, duration: 0.2, ease: "power2.in" })
        .to(b, { x: to.x, width: to.w, scaleY: 1, duration: 0.75, ease: "elastic.out(1, 0.55)" });
    }
    gsap.fromTo(tab.querySelector(".dock__icon"), { y: 8, scale: 0.6 }, { y: 0, scale: 1, duration: 0.7, ease: "back.out(3)" });
    last.current = to;
  }, [pathname]);

  // Steps aside while reading down; back on the way up.
  useEffect(() => {
    let y0 = window.scrollY;
    let hidden = false;
    const onScroll = () => {
      const y = window.scrollY;
      if (Math.abs(y - y0) < 6) return;
      const hide = y > y0 && y > 120;
      if (hide !== hidden && dock.current) {
        hidden = hide;
        gsap.to(dock.current, { yPercent: hide ? 160 : 0, duration: hide ? 0.4 : 0.7, ease: hide ? "power2.in" : "expo.out" });
      }
      y0 = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const tab = (n: NavItem) => (
    <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive: a }) => cx("dock__tab", a && "is-active")}>
      <span className="dock__icon">
        <Icon name={n.icon} size={20} />
        {liveTo === n.to && <i className="dock__dot" aria-label="A show is live" />}
      </span>
      <span className="dock__label">{n.label}</span>
    </NavLink>
  );

  return (
    <nav className="dash-dock" aria-label="Dashboard" ref={dock}>
      <span className="dock__blob" ref={blob} aria-hidden />
      {shown.slice(0, half).map(tab)}
      <button type="button" className={cx("dock__curtain", offDock && "is-active", open && "is-open")} onClick={onOpen} aria-haspopup="dialog" aria-expanded={open}>
        <span className="dock__ring" aria-hidden />
        <span className="dock__burger" aria-hidden>
          <i />
          <i />
          <i />
        </span>
        <span className="sr-only">Open the setlist</span>
      </button>
      {shown.slice(half).map(tab)}
    </nav>
  );
}

/* ------------------------------------------------------------------------ */
/* The curtain: velvet drapes close in from both wings, the valance drops,  */
/* and the setlist is read out over them. Closing parts the drapes again.   */
/* ------------------------------------------------------------------------ */

export function CurtainMenu({ items, liveTo, open, onClose, footer }: { items: NavItem[]; liveTo: string | null; open: boolean; onClose: () => void; footer: ReactNode }) {
  const { pathname } = useLocation();
  const codes = setlistCodes(items);
  const root = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const tl = useRef<gsap.core.Timeline | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const firstEncore = items.findIndex((n) => n.admin);

  useGSAP(
    () => {
      tl.current = gsap
        .timeline({ paused: true, defaults: { ease: "power4.inOut" } })
        .set(root.current, { autoAlpha: 1 })
        .fromTo(".curtain__shade", { opacity: 0 }, { opacity: 1, duration: 0.4, ease: "none" }, 0)
        .fromTo(".curtain__drape--l", { xPercent: -104, skewX: 6 }, { xPercent: 0, skewX: 0, duration: 0.85 }, 0)
        .fromTo(".curtain__drape--r", { xPercent: 104, skewX: -6 }, { xPercent: 0, skewX: 0, duration: 0.85 }, 0)
        .fromTo(".curtain__valance", { yPercent: -110 }, { yPercent: 0, duration: 0.7, ease: "expo.out" }, 0.25)
        .fromTo(".curtain__glow", { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.8, ease: "expo.out" }, 0.55)
        .fromTo(".curtain__kicker > *", { yPercent: 120 }, { yPercent: 0, duration: 0.6, stagger: 0.06, ease: "expo.out" }, 0.6)
        .fromTo(".curtain__close, .curtain__encore", { autoAlpha: 0, scale: 0.8 }, { autoAlpha: 1, scale: 1, duration: 0.5, ease: "back.out(2)" }, 0.6)
        .fromTo(".curtain__row > *", { yPercent: 115 }, { yPercent: 0, duration: 0.7, stagger: 0.045, ease: "expo.out" }, 0.62)
        .fromTo(".curtain__foot > *", { y: 18, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.5, stagger: 0.05, ease: "power3.out" }, 0.8);
    },
    { scope: root },
  );

  useEffect(() => {
    const t = tl.current;
    if (!t) return;
    if (open) {
      opener.current = document.activeElement as HTMLElement | null;
      t.timeScale(1).play();
      document.documentElement.classList.add("curtain-lock");
      // The close button fades in with the setlist; focus it once it can take focus.
      const id = window.setTimeout(() => closeBtn.current?.focus(), 1000);
      return () => window.clearTimeout(id);
    }
    t.timeScale(1.6).reverse();
    document.documentElement.classList.remove("curtain-lock");
    if (root.current?.contains(document.activeElement)) opener.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => () => document.documentElement.classList.remove("curtain-lock"), []);

  return createPortal(
    <div className="curtain" ref={root} role="dialog" aria-modal="true" aria-label="Setlist" inert={!open}>
      <span className="curtain__shade" aria-hidden onClick={onClose} />
      <span className="curtain__drape curtain__drape--l" aria-hidden />
      <span className="curtain__drape curtain__drape--r" aria-hidden />
      <span className="curtain__valance" aria-hidden />
      <span className="curtain__glow" aria-hidden />

      <div className="curtain__stage">
        <div className="curtain__top">
          <p className="curtain__kicker">
            <span>Setlist</span>
            <span>{today()}</span>
          </p>
          <button type="button" className="curtain__close" onClick={onClose} ref={closeBtn} aria-label="Close the setlist">
            <Icon name="close" size={20} />
          </button>
        </div>

        <ol className="curtain__list">
          {items.map((n, i) => (
            <li key={n.to} className={cx(i === firstEncore && "is-encore")}>
              {i === firstEncore && <span className="curtain__encore">Encore</span>}
              <Link to={n.to} className={cx("curtain__row", isActive(n, pathname) && "is-active")} onClick={onClose} aria-current={isActive(n, pathname) ? "page" : undefined}>
                <span className="curtain__code">{codes[i]}</span>
                <span className="curtain__label">
                  {n.label}
                  {liveTo === n.to && <LiveTag />}
                </span>
              </Link>
            </li>
          ))}
        </ol>

        <div className="curtain__foot">
          {footer}
          <div className="curtain__tools">
            <ThemeToggle />
            <Link to="/" className="curtain__back" onClick={onClose}>
              <Icon name="arrowLeft" size={14} /> Back to site
            </Link>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
