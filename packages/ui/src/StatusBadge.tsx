import type { ReactNode } from "react";

export type StatusTone = "ok" | "info" | "warn" | "error" | "neutral";

export function StatusBadge({
  tone,
  children,
}: {
  tone: StatusTone;
  children: ReactNode;
}): ReactNode {
  return <span className={`ir-badge ir-badge-${tone}`}>{children}</span>;
}
