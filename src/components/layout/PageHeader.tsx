import { useRef, type ReactNode } from "react";
import { gsap, shift, useGSAP } from "@/motion/gsap";
import { cx } from "@/utils/format";

interface PageHeaderProps {
  title: string;
  /** Small uppercase line above the title, e.g. "Theater". */
  label?: string;
  lead?: ReactNode;
  aside?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function PageHeader({ title, label, lead, aside, children, className }: PageHeaderProps) {
  const ref = useRef<HTMLElement>(null);
  useGSAP(
    () => {
      gsap
        .timeline()
        .from(".page-header__title-inner", shift(1) ? { yPercent: 110, duration: 0.9, ease: "power4.out" } : { autoAlpha: 0, duration: 0.5 })
        .from(".page-header [data-in]", { autoAlpha: 0, y: shift(12), duration: 0.6, stagger: 0.06, clearProps: "transform,opacity,visibility" }, "-=0.6");
    },
    { scope: ref },
  );
  return (
    <header ref={ref} className={cx("page-header", className)}>
      <div className="container">
        <div className="page-header__row">
          <div>
            {label && (
              <p className="label page-header__label" data-in>
                {label}
              </p>
            )}
            <h1 className="h-page">
              <span className="page-header__mask">
                <span className="page-header__title-inner">{title}</span>
              </span>
            </h1>
            {lead && (
              <p className="lead page-header__lead" data-in>
                {lead}
              </p>
            )}
          </div>
          {aside && (
            <div className="page-header__aside" data-in>
              {aside}
            </div>
          )}
        </div>
        {children}
      </div>
    </header>
  );
}
