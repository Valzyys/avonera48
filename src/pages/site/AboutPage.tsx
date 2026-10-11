import { PageHeader } from "@/components/layout/PageHeader";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

export default function AboutPage() {
  useDocumentTitle("About");
  return (
    <div className="page">
      <PageHeader label="Fan site" title="About" lead="A fan-made place to follow JKT48 live streams, theater shows, members and news." />
      <div className="container page-body">
        <div className="prose">
          <h2>Unofficial</h2>
          <p>
            Avonera48 is made by fans. It is not affiliated with, endorsed by or operated by JKT48, its management or any streaming platform. Trademarks belong to their
            owners.
          </p>
          <h2>The data you see right now</h2>
          <p>
            Members, streams, theater shows, birthdays and news come from a <strong>sample snapshot</strong> of the{" "}
            <a className="link" href="https://jkt48connect.com" target="_blank" rel="noreferrer noopener">
              jkt48connect.com
            </a>{" "}
            API, taken on 10–11 October 2026. The site replays that snapshot at 23:20 WIB on 10 October, so “live now” means live at that moment — not right now.
          </p>
          <p>Photos and posters load from the API’s image proxy. News items link to the full announcement on jkt48.com.</p>
          <h2>Privacy</h2>
          <p>There are no accounts and no tracking. Your theme choice is saved in your browser and never leaves your device.</p>
        </div>
      </div>
    </div>
  );
}
