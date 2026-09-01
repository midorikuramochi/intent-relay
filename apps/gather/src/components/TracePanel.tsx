import type { ReactNode } from "react";
import { useI18n } from "@intent-relay/ui";
import type { SemanticTrace } from "@intent-relay/contracts";

function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "(empty)";
  }
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value);
}

export function TracePanel({ trace }: { trace: SemanticTrace }): ReactNode {
  const { t } = useI18n();
  return (
    <section className="panel" aria-labelledby="trace-heading">
      <div className="panel-header">
        <h2 id="trace-heading">{t("gather.trace.heading")}</h2>
        <span className={trace.completed ? "badge badge-complete" : "badge badge-open"}>
          {trace.completed ? t("gather.trace.complete") : t("gather.trace.recording")}
        </span>
      </div>
      <p className="panel-note">
        {t("gather.trace.note")}{" "}
        <code>
          {trace.id} · rev {trace.eventRevision}
        </code>
      </p>
      {trace.actions.length === 0 ? (
        <p className="empty-state">{t("gather.trace.empty")}</p>
      ) : (
        <ol className="trace-list">
          {trace.actions.map((action) => (
            <li key={action.id} className="trace-item">
              <div className="trace-item-head">
                <code>{action.id}</code>
                <strong>{action.command}</strong>
                <span className="trace-key">{action.semanticKey}</span>
              </div>
              <div className="trace-item-change">
                <span>{formatValue(action.before)}</span>
                <span aria-hidden="true"> → </span>
                <span className="sr-only">changed to</span>
                <span>{formatValue(action.after)}</span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
