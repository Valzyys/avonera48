import type { ReactNode } from "react";
import { cx } from "@/utils/format";

export type Tone = "neutral" | "ok" | "warn" | "danger" | "info" | "violet";

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cx("badge", `badge--${tone}`, className)}>{children}</span>;
}

/** Colored mark + text label, so state is never conveyed by color alone. */
export function StatusDot({ tone, label, pulse }: { tone: Tone; label: string; pulse?: boolean }) {
  return (
    <span className={cx("status-dot", `status-dot--${tone}`, pulse && "status-dot--pulse")}>
      <span className="status-dot__mark" aria-hidden />
      <span>{label}</span>
    </span>
  );
}

/** Subtle marker for anything rendered from sample data. */
export function PreviewTag({ children = "Preview data" }: { children?: ReactNode }) {
  return (
    <span className="preview-tag" title="Generated sample data — not live production information">
      <span className="preview-tag__mark" aria-hidden />
      {children}
    </span>
  );
}
