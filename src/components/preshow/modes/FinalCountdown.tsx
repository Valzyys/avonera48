import { formatRemaining } from "../format";
import { CountdownRing } from "../ui/CountdownRing";

/** The last minutes: a huge clock in a thinning ring; the final ten seconds count one big digit at a time. */
export function FinalCountdown({ remaining, total, setlist }: { remaining: number; total: number; setlist?: string }) {
  const secs = Math.max(0, Math.ceil(remaining / 1000));
  const last10 = secs <= 10;
  const hot = secs <= 60;
  return (
    <div className={`ps-mode ps-final${hot ? " is-hot" : ""}`} role="timer" aria-label={`Show dimulai dalam ${formatRemaining(remaining)}`}>
      {setlist && <span className="ps-final__show">{setlist}</span>}
      <div className="ps-final__dial">
        <CountdownRing progress={remaining / (total * 1000)} hot={hot} />
        {last10 ? (
          <span key={secs} className="ps-final__digit" aria-hidden>
            {secs}
          </span>
        ) : (
          <span key={hot ? secs : "clock"} className={`ps-final__clock${hot ? " is-pulse" : ""}`} aria-hidden>
            {formatRemaining(remaining)}
          </span>
        )}
      </div>
      <span className="ps-final__label">Show dimulai dalam</span>
    </div>
  );
}
