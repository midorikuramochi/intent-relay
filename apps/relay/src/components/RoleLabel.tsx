import type { ReactNode } from "react";
import { useI18n } from "@intent-relay/ui";

/** Restrained typographic role marker — never a filled pill, never an emoji. */
export function RoleLabel({ role }: { role: "you" | "agent" }): ReactNode {
  const { t } = useI18n();
  return (
    <span className={`role-label role-${role}`}>
      {role === "you" ? t("common.you") : t("common.agent")}
    </span>
  );
}
