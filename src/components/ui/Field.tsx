import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cx } from "@/utils/format";
import { Icon, type IconName } from "./Icon";

interface FieldProps {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  hideLabel?: boolean;
  children: (ids: { id: string; describedBy?: string; invalid: boolean }) => ReactNode;
  className?: string;
}

export function Field({ label, hint, error, hideLabel, children, className }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cx("field", error && "field--invalid", className)}>
      <label htmlFor={id} className={cx("field__label", hideLabel && "sr-only")}>
        {label}
      </label>
      {children({ id, describedBy, invalid: !!error })}
      {hint && !error && (
        <p id={hintId} className="field__hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="field__error" role="alert">
          <Icon name="alert" size={14} />
          {error}
        </p>
      )}
    </div>
  );
}

export function Input({ className, icon, ...rest }: InputHTMLAttributes<HTMLInputElement> & { icon?: IconName }) {
  if (!icon) return <input className={cx("input", className)} {...rest} />;
  return (
    <span className={cx("input-wrap", className)}>
      <Icon name={icon} size={16} className="input-wrap__icon" />
      <input className="input input--with-icon" {...rest} />
    </span>
  );
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx("input", "input--area", className)} {...rest} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className={cx("select-wrap", className)}>
      <select className="input select" {...rest}>
        {children}
      </select>
      <Icon name="chevronDown" size={16} className="select-wrap__chevron" />
    </span>
  );
}

export function Checkbox({ label, description, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: string; description?: string }) {
  const id = useId();
  return (
    <div className="checkbox">
      <input type="checkbox" id={id} className="checkbox__input" {...rest} />
      <label htmlFor={id} className="checkbox__label">
        <span className="checkbox__box" aria-hidden>
          <Icon name="check" size={13} strokeWidth={2.4} />
        </span>
        <span>
          <span className="checkbox__text">{label}</span>
          {description && <span className="checkbox__desc">{description}</span>}
        </span>
      </label>
    </div>
  );
}
