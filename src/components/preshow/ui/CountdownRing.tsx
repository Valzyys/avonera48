/** A ring that thins out as the last minutes run down (progress 1 → 0). */
export function CountdownRing({ progress, hot }: { progress: number; hot: boolean }) {
  const p = Math.max(0, Math.min(1, progress));
  return (
    <svg className={`ps-ring${hot ? " is-hot" : ""}`} viewBox="0 0 100 100" aria-hidden>
      <circle className="ps-ring__track" cx="50" cy="50" r="46" />
      <circle className="ps-ring__bar" cx="50" cy="50" r="46" pathLength={1} style={{ strokeDashoffset: 1 - p, strokeWidth: 1.2 + 2.4 * p }} />
    </svg>
  );
}
