import { useEffect, useRef, useState, type ReactNode } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { enter, gsap, ScrollTrigger, useGSAP } from "@/motion/gsap";
import { cx } from "@/utils/format";

const FACTS = [
  { term: "Status", value: "Unofficial", note: "Fan-made, independent" },
  { term: "Coverage", value: "5 areas", note: "Live, recent, theater, members, news" },
  { term: "Refresh", value: "20 s – 1 h", note: "Per data type, see below" },
  { term: "Time zone", value: "WIB", note: "All times in UTC+7" },
];

const REFRESH = [
  ["Live now", "20 seconds"],
  ["Recent lives and their statistics", "30 seconds – 1 minute"],
  ["Theater schedule and news", "5 minutes"],
  ["Member profiles", "10 minutes"],
  ["Birthdays", "1 hour"],
];

const SECTIONS = [
  { id: "purpose", title: "Purpose" },
  { id: "independence", title: "Independence" },
  { id: "data", title: "Data and sources" },
  { id: "accuracy", title: "Accuracy" },
  { id: "rights", title: "Content and trademarks" },
  { id: "privacy", title: "Privacy" },
];

export default function AboutPage() {
  useDocumentTitle("About");
  const root = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(SECTIONS[0].id);

  useGSAP(
    () => {
      enter(".about__notice, .about__fact", { autoAlpha: 0, y: 18, duration: 0.7, stagger: 0.07, delay: 0.35, clearProps: "transform,opacity,visibility" });
      gsap.utils.toArray<HTMLElement>(".about__section").forEach((el) => {
        const tl = gsap.timeline({ scrollTrigger: { trigger: el, start: "top 85%", once: true } });
        enter(el.querySelector(".about__rule"), { scaleX: 0, duration: 0.9, ease: "power3.inOut" }, tl);
        enter(el.querySelectorAll(".about__num, .about__h, .about__body > *"), { autoAlpha: 0, y: 14, duration: 0.6, stagger: 0.05, clearProps: "transform,opacity,visibility" }, tl, "-=0.6");
      });
      ScrollTrigger.refresh();
    },
    { scope: root },
  );

  // Highlight the section being read in the index.
  useEffect(() => {
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter((e): e is HTMLElement => !!e);
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (hit) setActive(hit.target.id);
      },
      { rootMargin: "-30% 0px -60% 0px" },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);

  return (
    <div className="page about" ref={root}>
      <PageHeader label="About" title="Avonera48" lead="An independent guide to JKT48: live streams, theater schedules, members and news, gathered in one place." />
      <div className="container page-body">
        <aside className="about__notice" role="note">
          <span className="about__notice-label">Notice</span>
          <p>
            <strong>Avonera48 is an unofficial fan project.</strong> It is not affiliated with, endorsed by or operated by JKT48, its management or any streaming
            platform.
          </p>
        </aside>

        <dl className="about__facts">
          {FACTS.map((f) => (
            <div className="about__fact" key={f.term}>
              <dt>{f.term}</dt>
              <dd>
                <span className="about__fact-value">{f.value}</span>
                <span className="about__fact-note">{f.note}</span>
              </dd>
            </div>
          ))}
        </dl>

        <div className="about__layout">
          <nav className="about__toc" aria-label="On this page">
            <p className="label">On this page</p>
            <ol>
              {SECTIONS.map((s, k) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className={cx(active === s.id && "is-active")} aria-current={active === s.id ? "location" : undefined}>
                    <span className="mono">{String(k + 1).padStart(2, "0")}</span>
                    {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="about__sections">
            <Section n={1} id="purpose" title="Purpose">
              <p>
                Following JKT48 means keeping several places open at once: two streaming platforms, the theater schedule, member profiles and official announcements.
                Avonera48 brings them together on one page that is quick to read on a phone.
              </p>
              <p>
                Registered members can access a personalized dashboard with features designed to enhance their experience on Avonera48.
              </p>
            </Section>

            <Section n={2} id="independence" title="Independence">
              <p>
                Avonera48 is made by fans, on their own time. It has no commercial relationship with JKT48, its management, SHOWROOM or IDN Live, and nothing on the site
                should be read as an official statement.
              </p>
            </Section>

            <Section n={3} id="data" title="Data and sources">
              <p>
                Information comes from public sources: the official JKT48 website, SHOWROOM and IDN Live, collected by a third-party data service. Avonera48’s own server
                requests it on your behalf, keeps any access keys private, and serves images through its own proxy, so your browser only talks to this site.
              </p>
              <p>Each type of data is cached for a short time, so a new stream can take up to half a minute to appear.</p>
              <table className="about__table">
                <caption className="sr-only">How often each type of data is refreshed</caption>
                <thead>
                  <tr>
                    <th scope="col">Data</th>
                    <th scope="col">Refreshed at most every</th>
                  </tr>
                </thead>
                <tbody>
                  {REFRESH.map(([what, when]) => (
                    <tr key={what}>
                      <th scope="row">{what}</th>
                      <td className="mono">{when}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p>If the data service cannot be reached, the site falls back to a bundled snapshot and says so wherever data is shown.</p>
            </Section>

            <Section n={4} id="accuracy" title="Accuracy">
              <p>
                Schedules, lineups and streams can change at short notice. The official JKT48 website and the platforms themselves are the authoritative sources; every
                news item links to the original announcement. If something here disagrees with them, they are right.
              </p>
            </Section>

            <Section n={5} id="rights" title="Content and trademarks">
              <p>
                Names, photographs, posters, logos and trademarks belong to JKT48 and their respective owners. They appear here only to identify members, shows and
                announcements. Nothing on Avonera48 is for sale.
              </p>
            </Section>

            <Section n={6} id="privacy" title="Privacy">
              <p>There is no advertising and there are no analytics or tracking cookies.</p>
              <p>
                An account stores your name, your email and a salted hash of your password; your password itself is never stored. Signing in sets a single session cookie
                that keeps you signed in for 30 days. When you watch a show, the partner service receives an anonymous account ID so a reload doesn’t count as a
                new viewer.
              </p>
              <p>Your theme choice is stored in your own browser and never leaves your device.</p>
            </Section>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ n, id, title, children }: { n: number; id: string; title: string; children: ReactNode }) {
  return (
    <section className="about__section" id={id} aria-labelledby={`${id}-h`}>
      <span className="about__rule" aria-hidden />
      <span className="about__num mono" aria-hidden>
        {String(n).padStart(2, "0")}
      </span>
      <h2 className="about__h" id={`${id}-h`}>
        {title}
      </h2>
      <div className="about__body">{children}</div>
    </section>
  );
}
