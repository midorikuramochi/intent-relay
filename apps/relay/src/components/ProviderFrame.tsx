import type { ReactNode } from "react";
import { useI18n, type MessageKey } from "@intent-relay/ui";
import type { ProviderStatus } from "../providers/providerBridge";

const STATE_PRESENTATION: Record<
  ProviderStatus["state"],
  { tone: "ok" | "warn" | "error" | "neutral"; labelKey: MessageKey }
> = {
  connecting: { tone: "neutral", labelKey: "common.connecting" },
  connected: { tone: "ok", labelKey: "common.connected" },
  incomplete: { tone: "warn", labelKey: "common.incomplete" },
  disconnected: { tone: "error", labelKey: "common.disconnected" },
};

export function ProviderFrame({
  title,
  roleLabel,
  url,
  status,
}: {
  /** Stable technical identity (iframe title); intentionally not localized. */
  title: string;
  roleLabel: string;
  url: string;
  status: ProviderStatus;
}): ReactNode {
  const { t } = useI18n();
  const presentation = STATE_PRESENTATION[status.state];
  return (
    <section className="provider-column" aria-label={title}>
      <div className="provider-status">
        <div className="provider-status-row">
          <strong>{title}</strong>
          <span className={`state-text state-${presentation.tone}`}>
            {t(presentation.labelKey)}
          </span>
        </div>
        <p className="provider-role">{roleLabel}</p>
        <details className="provider-tech">
          <summary>
            <code>{status.origin}</code> · {t("provider.tools", { n: status.tools.length })}
          </summary>
          {status.tools.length > 0 && (
            <ul className="provider-tool-list">
              {status.tools.map((tool) => (
                <li key={tool.name}>
                  <code>{tool.name}</code>
                </li>
              ))}
            </ul>
          )}
          {status.missingTools.length > 0 && status.state !== "connecting" && (
            <p className="provider-missing">
              {t("provider.missing", { names: status.missingTools.join(", ") })}
            </p>
          )}
        </details>
      </div>
      <iframe title={title} src={url} allow="tools" className="provider-iframe" />
    </section>
  );
}
