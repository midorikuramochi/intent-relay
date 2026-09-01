import type { ReactNode } from "react";

export function EmptyState({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}): ReactNode {
  return (
    <div className="ir-empty">
      <p className="ir-empty-title">{title}</p>
      {children}
    </div>
  );
}
