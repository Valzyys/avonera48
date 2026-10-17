import { useEffect } from "react";

export const OUTRO_MS = 3000;

/** Show time: lights full, a white flash, "SHOW DIMULAI", then hand over to the player. */
export function Outro({ setlist, onDone }: { setlist?: string; onDone: () => void }) {
  useEffect(() => {
    const t = window.setTimeout(onDone, OUTRO_MS);
    return () => window.clearTimeout(t);
  }, [onDone]);
  return (
    <div className="ps-mode ps-outro">
      <span className="ps-flash" aria-hidden />
      <h2 className="ps-outro__title">SHOW DIMULAI</h2>
      {setlist && <span className="ps-outro__show">{setlist}</span>}
    </div>
  );
}
