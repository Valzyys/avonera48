import type { ReactNode } from "react";
import { cx } from "@/utils/format";

interface PageHeaderProps {
  title: string;
  lead?: ReactNode;
  aside?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function PageHeader({ title, lead, aside, children, className }: PageHeaderProps) {
  return (
    <header className={cx("page-header", className)}>
      <div className="container">
        <div className="page-header__row">
          <div>
            <h1 className="h-page">{title}</h1>
            {lead && <p className="lead page-header__lead">{lead}</p>}
          </div>
          {aside && <div className="page-header__aside">{aside}</div>}
        </div>
        {children}
      </div>
    </header>
  );
}
