import { useSyncExternalStore } from "react";
import { PreviewTag } from "@/components/ui";
import { dataSource } from "@/services";

/** Says where the data on screen comes from: the live API, or the bundled snapshot. */
export function SourceNote({ live = "Live data · jkt48connect.com" }: { live?: string }) {
  const mode = useSyncExternalStore(dataSource.subscribe, dataSource.get);
  if (mode === "live") return <span className="source-note source-note--live">{live}</span>;
  return <PreviewTag>Sample snapshot (10 Oct 2026, 23:20 WIB) — live API not reachable</PreviewTag>;
}
