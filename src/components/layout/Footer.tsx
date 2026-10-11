import { Link } from "react-router";
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
  return (
    <footer className="footer">
      <div className="container footer__inner">
        <div className="footer__brand">
          <Logo />
          <p className="small">
            An unofficial fan site for JKT48. Not affiliated with JKT48 or its management. While Avonera48 is in preview, every member, show, stream and article is
            sample data.
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
