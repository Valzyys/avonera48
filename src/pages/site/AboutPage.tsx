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
          <h2>Where the data comes from</h2>
          <p>
            Live streams, recent lives, members, theater schedules, birthdays and news come from the{" "}
            <a className="link" href="https://jkt48connect.com" target="_blank" rel="noreferrer noopener">
              jkt48connect.com
            </a>{" "}
            API. Avonera48’s server asks the API on your behalf and caches answers for a few seconds to a few minutes, so a stream can take up to half a minute to appear.
          </p>
          <p>
            If the API can’t be reached, the site shows a bundled snapshot from 10 October 2026 instead and says so on every page. Photos and posters load from the API’s
            image proxy; news items link to the full announcement on jkt48.com.
          </p>
          <h2>Privacy</h2>
          <p>There are no accounts and no tracking. Your theme choice is saved in your browser and never leaves your device.</p>
        </div>
      </div>
    </div>
  );
}
