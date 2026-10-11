import { useId, useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { cx } from "@/utils/format";

export interface TabItem<T extends string> {
  id: T;
  label: ReactNode;
  count?: number;
}

interface TabsProps<T extends string> {
  items: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  label: string;
  size?: "sm" | "md";
  /** Render as a segmented control (used for filters / ranges). */
  segmented?: boolean;
  panelId?: string;
}

/** WAI-ARIA tabs with roving focus. Content is rendered by the caller. */
export function Tabs<T extends string>({ items, value, onChange, label, size = "md", segmented, panelId }: TabsProps<T>) {
  const base = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const list = useRef<HTMLDivElement>(null);

  // Slide the indicator under the selected tab; re-measure on resize/font load.
  useLayoutEffect(() => {
    const el = list.current;
    if (!el) return;
    const place = () => {
      const tab = refs.current[items.findIndex((i) => i.id === value)];
      if (!tab) return;
      el.style.setProperty("--ind-x", `${tab.offsetLeft}px`);
      el.style.setProperty("--ind-w", `${tab.offsetWidth}px`);
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(el);
    return () => ro.disconnect();
  }, [items, value]);

  const onKey = (e: KeyboardEvent, index: number) => {
    let next = index;
    if (e.key === "ArrowRight") next = (index + 1) % items.length;
    else if (e.key === "ArrowLeft") next = (index - 1 + items.length) % items.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = items.length - 1;
    else return;
    e.preventDefault();
    refs.current[next]?.focus();
    onChange(items[next].id);
  };

  return (
    <div ref={list} role="tablist" aria-label={label} className={cx("tabs", segmented && "tabs--segmented", `tabs--${size}`)}>
      <span className="tabs__indicator" aria-hidden />
      {items.map((item, i) => {
        const selected = item.id === value;
        return (
          <button
            key={item.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            id={`${base}-${item.id}`}
            role="tab"
            type="button"
            aria-selected={selected}
            aria-controls={panelId}
            tabIndex={selected ? 0 : -1}
            className="tabs__tab"
            onClick={() => onChange(item.id)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {item.label}
            {item.count !== undefined && <span className="tabs__count">{item.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
