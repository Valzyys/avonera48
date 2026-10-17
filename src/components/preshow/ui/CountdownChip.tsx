import { formatRemaining } from "../format";

/** Under the badge: "Mulai dalam 12:34" while the start is still ahead. */
export function CountdownChip({ remaining }: { remaining: number | null }) {
  if (remaining == null || remaining <= 0) return null;
  return (
    <span className="ps-chip" role="timer" aria-label={`Show mulai dalam ${formatRemaining(remaining)}`}>
      Mulai dalam <b>{formatRemaining(remaining)}</b>
    </span>
  );
}
