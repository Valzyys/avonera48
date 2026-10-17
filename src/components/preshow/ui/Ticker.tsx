import { PsIcon } from "./Icons";

/** Bottom ticker: the items twice over, sliding by half its width for a seamless loop. */
export function Ticker({ items }: { items: string[] }) {
  if (!items.length) return null;
  const row = (hidden: boolean) => (
    <span className="ps-ticker__row" aria-hidden={hidden || undefined}>
      {items.map((t, i) => (
        <span key={i} className="ps-ticker__item">
          {t}
          <PsIcon name="star" size="0.9em" className="ps-ticker__sep" />
        </span>
      ))}
    </span>
  );
  return (
    <div className="ps-ticker">
      <div className="ps-ticker__track">
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}
