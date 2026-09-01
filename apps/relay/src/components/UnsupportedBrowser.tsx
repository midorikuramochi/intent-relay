import type { ReactNode } from "react";
import { Panel, StatusBadge, useI18n } from "@intent-relay/ui";

export function UnsupportedBrowser(): ReactNode {
  const { t } = useI18n();
  return (
    <Panel
      heading={t("fail.webmcp.title")}
      badge={<StatusBadge tone="error">{t("fail.webmcp.badge")}</StatusBadge>}
    >
      <div role="alert">
        <p className="panel-note">{t("fail.webmcp.body")}</p>
        <p className="panel-note">{t("fail.webmcp.hint")}</p>
      </div>
    </Panel>
  );
}
