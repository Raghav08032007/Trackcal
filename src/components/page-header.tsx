// One page header for every page: a title, one short line saying what the page is for, and the main action(s).
import type { ReactNode } from "react";

export function PageHeader({ title, text, actions, eyebrow }: { title: string; text?: ReactNode; actions?: ReactNode; eyebrow?: string }) {
  return <header className="page-head">
    <div className="page-head-text">
      {eyebrow && <p className="page-head-eyebrow">{eyebrow}</p>}
      <h1>{title}</h1>
      {text && <p>{text}</p>}
    </div>
    {actions && <div className="page-head-actions">{actions}</div>}
  </header>;
}
