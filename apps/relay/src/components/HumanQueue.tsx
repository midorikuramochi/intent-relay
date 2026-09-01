import { useState, type ReactNode } from "react";
import type { IntentContract } from "@intent-relay/contracts";
import type { CompatibilityPreview, MappingEntry } from "@intent-relay/protocol";
import {
  Button,
  EmptyState,
  Panel,
  StatusBadge,
  semanticKeyLabel,
  useI18n,
  valueLabel,
} from "@intent-relay/ui";
import type { HumanResolution } from "../domain/types";
import { KeyCode } from "./ValueDisplay";
import { RoleLabel } from "./RoleLabel";

function DecisionEntry({
  entry,
  semanticKey,
  resolution,
  onResolve,
}: {
  entry: MappingEntry;
  semanticKey: string;
  resolution: HumanResolution | undefined;
  onResolve: (ruleId: string, alternativeId: string) => void;
}): ReactNode {
  const { locale, t } = useI18n();
  const [selected, setSelected] = useState<string>(resolution?.alternativeId ?? "");
  const alternatives = entry.alternatives ?? [];
  return (
    <fieldset className="decision">
      <legend>
        <span className="rule-key-label">{semanticKeyLabel(locale, semanticKey)}</span>{" "}
        <KeyCode value={semanticKey} />{" "}
        {resolution === undefined ? (
          <StatusBadge tone="warn">{t("queue.requiredChip")}</StatusBadge>
        ) : (
          <span className="state-text state-ok">{t("queue.decidedChip")}</span>
        )}
      </legend>
      {entry.reason !== undefined && <p className="panel-note">{entry.reason}</p>}
      <div className="decision-options">
        {alternatives.map((alternative) => (
          <label key={alternative.id} className="decision-option">
            <input
              type="radio"
              name={`decision-${entry.ruleId}`}
              value={alternative.id}
              checked={selected === alternative.id}
              onChange={() => setSelected(alternative.id)}
            />
            <span>
              <strong>{valueLabel(locale, alternative.id) ?? alternative.label}</strong>
              <span className="decision-consequence">{alternative.consequence}</span>
              <code className="value-raw">{alternative.id}</code>
            </span>
          </label>
        ))}
      </div>
      <Button
        disabled={selected === "" || selected === resolution?.alternativeId}
        onClick={() => onResolve(entry.ruleId, selected)}
      >
        {t("queue.record")}
      </Button>
    </fieldset>
  );
}

export function HumanQueue({
  preview,
  contract,
  resolutions,
  onResolve,
}: {
  preview: CompatibilityPreview | null;
  contract: IntentContract | null;
  resolutions: HumanResolution[];
  onResolve: (ruleId: string, alternativeId: string) => void;
}): ReactNode {
  const { t } = useI18n();
  const decisions = preview?.mappings.filter((entry) => entry.status === "needs_decision") ?? [];
  const unresolvedCount = decisions.filter(
    (entry) => !resolutions.some((resolution) => resolution.ruleId === entry.ruleId),
  ).length;

  return (
    <Panel
      heading={t("queue.panel")}
      badge={
        <>
          <RoleLabel role="you" />
          {decisions.length === 0 ? undefined : unresolvedCount > 0 ? (
            <StatusBadge tone="warn">
              {t("queue.unresolvedBadge", { n: unresolvedCount })}
            </StatusBadge>
          ) : (
            <span className="state-text state-ok">{t("queue.decided")}</span>
          )}
        </>
      }
    >
      {decisions.length === 0 ? (
        <EmptyState title={t("queue.empty.title")}>
          <p>{t("queue.empty.body")}</p>
        </EmptyState>
      ) : (
        <>
          {unresolvedCount > 0 && (
            <div className="queue-hero" role="status">
              <p className="queue-hero-title">{t("queue.heading")}</p>
              <p className="queue-hero-sub">{t("queue.sub")}</p>
              <p className="panel-note blocking-note">
                {t("queue.blocking", { n: unresolvedCount })}
              </p>
            </div>
          )}
          {decisions.map((entry) => (
            <DecisionEntry
              key={`${preview?.previewHash ?? "none"}:${entry.ruleId}`}
              entry={entry}
              semanticKey={
                contract?.rules.find((rule) => rule.id === entry.ruleId)?.semanticKey ??
                entry.ruleId
              }
              resolution={resolutions.find((resolution) => resolution.ruleId === entry.ruleId)}
              onResolve={onResolve}
            />
          ))}
        </>
      )}
    </Panel>
  );
}
