import type { ReactNode } from "react";
import { Button, LanguageSwitcher, useI18n } from "@intent-relay/ui";

export function AppHeader({
  demoSessionId,
  onReset,
}: {
  demoSessionId: string;
  onReset: () => void;
}): ReactNode {
  const { t } = useI18n();
  return (
    <header className="workbench-header">
      <div className="workbench-title">
        <h1>Intent Relay Workbench</h1>
        <p className="workbench-tagline">
          {t("relay.tagline")} <strong>{t("common.sample")}</strong>
        </p>
      </div>
      <div className="workbench-utility">
        <div className="workbench-utility-row">
          <span className="session-code">
            {t("relay.session")}{" "}
            {/* full id stays in the DOM/accessible name; truncation is CSS-only */}
            <code title={demoSessionId}>{demoSessionId}</code>
          </span>
          <Button variant="ghost" onClick={onReset}>
            {t("relay.reset")}
          </Button>
          <LanguageSwitcher />
        </div>
        <p className="publication-line">{t("relay.publicationBadge")}</p>
      </div>
    </header>
  );
}
