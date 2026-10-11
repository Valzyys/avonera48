import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Link, type LinkProps } from "react-router";
import { cx } from "@/utils/format";
import { Icon, type IconName } from "./Icon";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface Common {
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  iconRight?: IconName;
  children?: ReactNode;
}

const classes = (variant: Variant, size: Size, extra?: string) => cx("btn", `btn--${variant}`, `btn--${size}`, extra);

export interface ButtonProps extends Common, ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", icon, iconRight, loading, disabled, children, className, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={classes(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <span className="btn__spinner" aria-hidden /> : icon && <Icon name={icon} size={size === "sm" ? 15 : 17} />}
      {children && <span className="btn__label">{children}</span>}
      {iconRight && !loading && <Icon name={iconRight} size={size === "sm" ? 15 : 17} className="btn__icon-right" />}
    </button>
  );
});

export function ButtonLink({ variant = "secondary", size = "md", icon, iconRight, children, className, ...rest }: Common & LinkProps) {
  return (
    <Link className={classes(variant, size, className)} {...rest}>
      {icon && <Icon name={icon} size={size === "sm" ? 15 : 17} />}
      {children && <span className="btn__label">{children}</span>}
      {iconRight && <Icon name={iconRight} size={size === "sm" ? 15 : 17} className="btn__icon-right" />}
    </Link>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName;
  label: string;
  size?: Size;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, label, size = "md", className, type = "button", ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} className={cx("icon-btn", `icon-btn--${size}`, className)} aria-label={label} title={label} {...rest}>
      <Icon name={icon} size={size === "sm" ? 15 : 18} />
    </button>
  );
});
