import type { ReactNode } from "react";
import type { IntentContract } from "@intent-relay/contracts";
import type { CompatibilityPreview } from "@intent-relay/protocol";
import {
  EmptyState,
  Panel,
  formatTimestamp,
  semanticKeyLabel,
  useI18n,
  valueLabel,
} from "@intent-relay/ui";
import type { HumanResolution, TargetDraftRecord } from "../domain/types";
import { KeyCode } from "./ValueDisplay";
import { RoleLabel } from "./RoleLabel";

export function TransferReview({
  preview,
  contract,
  resolutions,
  targetDraft,
}: {
  preview: CompatibilityPreview | null;
  contract: IntentContract | null;
  resolutions: HumanResolution[];
  targetDraft: TargetDraftRecord | null;
}): ReactNode {
  const { locale, t } = useI18n();
  if (preview === null || targetDraft === null) {
    return (
      <Panel heading={t("review.panel")}>
        <EmptyState title={t("review.empty.title")}>
          <p>{t("review.empty.body")}</p>
        </EmptyState>
      </Panel>
    );
  }

  const counts = preview.mappings.reduce(
    (accumulator, entry) => {
      accumulator[entry.status] += 1;
      return accumulator;
    },
    { direct: 0, transformed: 0, unsupported: 0, needs_decision: 0 },
  );
  const semanticKeyFor = (ruleId: string): string =>
    contract?.rules.find((rule) => rule.id === ruleId)?.semanticKey ?? ruleId;
  const excludedRules = contract?.rules.filter((rule) => rule.humanStatus === "excluded") ?? [];
  const unsupported = preview.mappings.filter((entry) => entry.status === "unsupported");

  return (
    <Panel
      heading={t("review.panel")}
      badge={<span className="state-text state-info">◷ {t("review.waiting")}</span>}
    >
      <div className="review-hero">
        <p className="review-hero-title">{t("review.ready")}</p>
        <p className="review-hero-counts">
          {t("review.counts", {
            direct: counts.direct,
            transformed: counts.transformed,
            unsupported: counts.unsupported,
            decided: resolutions.length,
          })}
        </p>
        <div className="review-final">
          <p className="review-final-step">
            <RoleLabel role="you" /> <strong>{t("review.finalStep")}</strong> —{" "}
            {t("review.finalBody")}
          </p>
          <p className="review-quote">“{t("review.quote")}”</p>
        </div>
      </div>

      {unsupported.length > 0 && (
        <div className="review-block">
          <h3>{t("review.notTransferred")}</h3>
          <ul>
            {unsupported.map((entry) => (
              <li key={entry.ruleId}>
                {semanticKeyLabel(locale, semanticKeyFor(entry.ruleId))}
                {entry.reason !== undefined && <> — {entry.reason}</>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {excludedRules.length > 0 && (
        <div className="review-block">
          <h3>{t("review.excludedByYou")}</h3>
          <ul>
            {excludedRules.map((rule) => (
              <li key={rule.id}>
                {semanticKeyLabel(locale, rule.semanticKey)} <KeyCode value={rule.semanticKey} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {resolutions.length > 0 && (
        <div className="review-block">
          <h3>{t("review.yourDecisions")}</h3>
          <ul>
            {resolutions.map((resolution) => (
              <li key={resolution.ruleId}>
                {semanticKeyLabel(locale, semanticKeyFor(resolution.ruleId))} →{" "}
                {t("review.decisionRecorded", {
                  label: valueLabel(locale, resolution.alternativeId) ?? resolution.alternativeId,
                  ts: formatTimestamp(locale, resolution.resolvedAt),
                })}{" "}
                <code>{resolution.alternativeId}</code>
              </li>
            ))}
          </ul>
        </div>
      )}

      <footer className="review-footer">
        <p className="tech-note">
          {t("review.meta", {
            draft: targetDraft.draftId,
            n: targetDraft.revision,
            publication: targetDraft.publication,
          })}
        </p>
        <p className="panel-note">{t("review.humanOnly")}</p>
      </footer>
    </Panel>
  );
}
