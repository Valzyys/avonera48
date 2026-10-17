import { infoLine } from "../format";

/** Top-left: setlist · day · time; missing parts drop out with their separator. */
export function InfoStrip({ setlist, startAt }: { setlist?: string; startAt?: Date }) {
  const parts = infoLine(setlist, startAt);
  if (!parts.length) return null;
  return (
    <p className="ps-strip">
      {parts.map((p, i) => (
        <span key={i}>
          {i > 0 && <i aria-hidden> · </i>}
          {p}
        </span>
      ))}
    </p>
  );
}
