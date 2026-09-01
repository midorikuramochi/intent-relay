import type { ReactNode } from "react";

export function Panel({
  heading,
  badge,
  children,
}: {
  heading: string;
  badge?: ReactNode;
  children: ReactNode;
}): ReactNode {
  return (
    <section className="ir-panel" aria-label={heading}>
      <div className="ir-panel-head">
        <h2>{heading}</h2>
        {badge}
      </div>
      {children}
    </section>
  );
}
