import { useEffect, useId, useRef, type ReactNode } from "react";
import { cx } from "@/utils/format";
import { IconButton } from "./Button";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md";
  variant?: "center" | "drawer";
  /** Block closing (e.g. while a request is in flight). */
  dismissible?: boolean;
}

/**
 * Native <dialog> in modal mode: browser-provided focus containment, inert
 * background and Escape handling. We only add animation and restore focus.
 */
export function Dialog({ open, onClose, title, description, children, footer, size = "md", variant = "center", dismissible = true }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      returnFocus.current = document.activeElement as HTMLElement | null;
      el.showModal();
      document.documentElement.classList.add("has-modal");
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onClosed = () => {
      document.documentElement.classList.remove("has-modal");
      returnFocus.current?.focus?.();
    };
    el.addEventListener("close", onClosed);
    return () => el.removeEventListener("close", onClosed);
  }, []);

  return (
    <dialog
      ref={ref}
      className={cx("dialog", `dialog--${size}`, `dialog--${variant}`)}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onCancel={(e) => {
        e.preventDefault();
        if (dismissible) onClose();
      }}
      onClick={(e) => {
        // Click on the backdrop (the dialog element itself) closes.
        if (e.target === ref.current && dismissible) onClose();
      }}
    >
      {open && (
        <div className="dialog__panel">
          <header className="dialog__header">
            <div>
              <h2 id={titleId} className="dialog__title">
                {title}
              </h2>
              {description && (
                <div id={descId} className="dialog__desc">
                  {description}
                </div>
              )}
            </div>
            <IconButton icon="close" label="Close dialog" size="sm" onClick={onClose} disabled={!dismissible} />
          </header>
          {children && <div className="dialog__body">{children}</div>}
          {footer && <footer className="dialog__footer">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}
