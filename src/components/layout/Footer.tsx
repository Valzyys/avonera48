import { useRef } from "react";
import { Link } from "react-router";
import { useResource } from "@/hooks/useResource";
import { gsap, shift, useGSAP } from "@/motion/gsap";
import { api } from "@/services";
import { Logo } from "./Logo";

const cols = [
  {
    title: "Watch",
    links: [
      { to: "/live", label: "Live now" },
      { to: "/recent-live", label: "Recent live" },
    ],
  },
  {
    title: "Theater",
    links: [
      { to: "/theater", label: "Schedule" },
      { to: "/theater?status=completed", label: "Past shows" },
    ],
  },
  {
    title: "Explore",
    links: [
      { to: "/members", label: "Members" },
      { to: "/news", label: "News" },
      { to: "/about", label: "About" },
    ],
  },
];

export function Footer() {
  const members = useResource(() => api.listMembers({ sort: "generation" }), []);
  const stripe = useRef<HTMLDivElement>(null);
  const colors = (members.data ?? []).filter((m) => m.status !== "graduated").map((m) => m.color);
  // The member-colour stripe rises bar by bar when the footer comes into view.
  useGSAP(
    () => {
      if (!stripe.current || !colors.length) return;
      gsap.from(stripe.current.children, {
        scaleY: shift(1) ? 0 : 1,
        autoAlpha: shift(1) ? 1 : 0,
        duration: 0.6,
        ease: "power3.out",
        stagger: 0.03,
        scrollTrigger: { trigger: stripe.current, start: "top 98%", once: true },
      });
    },
    { scope: stripe, dependencies: [colors.length] },
  );
  return (
    <footer className="footer">
      <div className="footer__stripe" ref={stripe} aria-hidden>
        {colors.map((c, k) => (
          <span key={k} style={{ background: c }} />
        ))}
      </div>
      <div className="container footer__inner">
        <div className="footer__brand">
          <Logo />
          <p className="small">
            An unofficial fan site for JKT48. Not affiliated with JKT48 or its management. Data shown is a sample snapshot of the jkt48connect.com API.
          </p>
        </div>
        {cols.map((c) => (
          <nav key={c.title} aria-label={c.title} className="footer__col">
            <h2 className="meta">{c.title}</h2>
            <ul>
              {c.links.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} viewTransition>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="container footer__base meta">
        <span>© {new Date().getFullYear()} Avonera48 · made by fans</span>
        <span>Times shown in WIB (UTC+7)</span>
      </div>
    </footer>
  );
}
