import type { ReactNode } from "react";
import { Button, Panel, StatusBadge, useI18n } from "@intent-relay/ui";

export function ConnectionError({
  title,
  origin,
  state,
  message,
  onRetry,
}: {
  title: string;
  origin?: string;
  state?: string;
  message?: string;
  onRetry?: () => void;
}): ReactNode {
  const { t } = useI18n();
  return (
    <Panel
      heading={title}
      badge={<StatusBadge tone="error">{t("fail.connection.badge")}</StatusBadge>}
    >
      <div role="alert" className="connection-error">
        {origin !== undefined && (
          <p className="panel-note">
            {t("fail.connection.pre")} <code>{origin}</code>{" "}
            {t("fail.connection.post", { state: state ?? "unknown" })}
          </p>
        )}
        {message !== undefined && <p className="panel-note">{message}</p>}
        {onRetry !== undefined && (
          <Button variant="ghost" onClick={onRetry}>
            {t("fail.retry")}
          </Button>
        )}
      </div>
    </Panel>
  );
}
