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
            The site is in <strong>preview</strong>. Every member, show, lineup, stream and article is <strong>sample data</strong> used to build and test the interface. Names
            are fictional and photo slots show initials instead of real photos. Nothing here is live or official.
          </p>
          <p>When a verified source is connected, sample records are replaced. Live status and stream links will only appear when they come from that source.</p>
          <h2>Privacy</h2>
          <p>There are no accounts and no tracking. Your theme choice is saved in your browser and never leaves your device.</p>
        </div>
      </div>
    </div>
  );
}
