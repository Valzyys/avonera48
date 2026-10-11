import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { cx } from "@/utils/format";
import { Button } from "./Button";
import { Icon, type IconName } from "./Icon";

export function Skeleton({ width, height = 14, className }: { width?: number | string; height?: number | string; className?: string }) {
  return <span className={cx("skeleton", className)} style={{ width, height }} aria-hidden />;
}

export function SkeletonRows({ rows = 6, label = "Loading" }: { rows?: number; label?: string }) {
  return (
    <div className="skeleton-rows" role="status" aria-live="polite">
      <span className="sr-only">{label}…</span>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} height={18} width={`${92 - ((i * 13) % 30)}%`} />
      ))}
    </div>
  );
}

export function EmptyState({ icon = "layers", title, children, action }: { icon?: IconName; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="state">
      <span className="state__icon" aria-hidden>
        <Icon name={icon} size={20} />
      </span>
      <h3 className="state__title">{title}</h3>
      {children && <p className="state__text">{children}</p>}
      {action && <div className="state__action">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry, title = "This view could not load" }: { error: Error; onRetry?: () => void; title?: string }) {
  return (
    <div className="state state--error" role="alert">
      <span className="state__icon" aria-hidden>
        <Icon name="alert" size={20} />
      </span>
      <h3 className="state__title">{title}</h3>
      <p className="state__text">{error.message}</p>
      {onRetry && (
        <div className="state__action">
          <Button size="sm" icon="refresh" onClick={onRetry}>
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}

export function Callout({ tone = "info", title, children, icon }: { tone?: "info" | "warn" | "danger" | "ok"; title?: string; children: ReactNode; icon?: IconName }) {
  const defaultIcon: Record<string, IconName> = { info: "info", warn: "alert", danger: "alert", ok: "check" };
  return (
    <div className={cx("callout", `callout--${tone}`)}>
      <Icon name={icon ?? defaultIcon[tone]} size={17} className="callout__icon" />
      <div>
        {title && <p className="callout__title">{title}</p>}
        <div className="callout__body">{children}</div>
      </div>
    </div>
  );
}

async function writeClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand("copy");
  ta.remove();
  if (!ok) throw new Error("Clipboard unavailable");
}

interface CopyButtonProps {
  value: string;
  /** What is being copied, used in the toast and accessible label. */
  what: string;
  size?: "sm" | "md";
  showLabel?: boolean;
  label?: string;
  className?: string;
}

export function CopyButton({ value, what, size = "sm", showLabel, label = "Copy", className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await writeClipboard(value || window.location.href);
      setCopied(true);
      toast.success(`${what} copied to clipboard`);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error(`Could not copy ${what.toLowerCase()}. Select the text and copy it manually.`);
    }
  };
  return (
    <button
      type="button"
      onClick={onCopy}
      className={cx("copy-btn", `copy-btn--${size}`, copied && "is-copied", className)}
      aria-label={copied ? `${what} copied` : `Copy ${what.toLowerCase()}`}
    >
      <Icon name={copied ? "check" : "copy"} size={15} />
      {showLabel && <span>{copied ? "Copied" : label}</span>}
    </button>
  );
}
