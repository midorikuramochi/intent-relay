import type { ReactNode } from "react";
import type { IntentContract } from "@intent-relay/contracts";
import {
  Button,
  EmptyState,
  Panel,
  formatEventSchedule,
  formatTimestamp,
  semanticKeyLabel,
  useI18n,
  valueLabel,
  type Locale,
} from "@intent-relay/ui";
import { KeyCode, isSchedule } from "./ValueDisplay";
import { RoleLabel } from "./RoleLabel";

/** Human-readable value first; the raw technical value stays visible as code. */
function ValueCell({
  locale,
  semanticKey,
  value,
  unit,
}: {
  locale: Locale;
  semanticKey: string;
  value: unknown;
  unit?: string;
}): ReactNode {
  if (semanticKey === "event.schedule" && isSchedule(value)) {
    return (
      <>
        <span>{formatEventSchedule(locale, value)}</span>
        <code className="value-raw">
          {value.start} → {value.end}
        </code>
      </>
    );
  }
  const label = valueLabel(locale, value);
  if (label !== null) {
    return (
      <>
        <span>{label}</span>
        <code className="value-raw">{String(value)}</code>
      </>
    );
  }
  const rendered = typeof value === "string" ? value : JSON.stringify(value);
  return (
    <span>
      {rendered}
      {unit !== undefined && <> {unit}</>}
    </span>
  );
}

const HUMAN_STATUS_PRESENTATION = {
  proposed: { tone: "warn", key: "contract.status.proposed" },
  approved: { tone: "ok", key: "contract.status.approved" },
  excluded: { tone: "neutral", key: "contract.status.excluded" },
} as const;

export function ContractEditor({
  contract,
  onSetRuleStatus,
  onApproveContract,
  onReviseContract,
}: {
  contract: IntentContract | null;
  onSetRuleStatus: (ruleId: string, humanStatus: "approved" | "excluded") => void;
  onApproveContract: () => void;
  onReviseContract: () => void;
}): ReactNode {
  const { locale, t } = useI18n();
  if (contract === null) {
    return (
      <Panel heading={t("contract.panelTitle")}>
        <EmptyState title={t("contract.empty.title")}>
          <p>{t("contract.empty.body")}</p>
        </EmptyState>
      </Panel>
    );
  }

  const isDraft = contract.status === "draft";
  const proposedCount = contract.rules.filter((rule) => rule.humanStatus === "proposed").length;

  return (
    <Panel
      heading={t("contract.heading", { n: contract.revision })}
      badge={
        <>
          <RoleLabel role="you" />
          {isDraft ? (
            <span className="state-text state-warn">{t("contract.badge.draft")}</span>
          ) : (
            <span className="state-text state-ok">
              {t("contract.status.approved")}{" "}
              <time dateTime={contract.approvedAt}>
                {contract.approvedAt === undefined
                  ? ""
                  : formatTimestamp(locale, contract.approvedAt)}
              </time>
            </span>
          )}
        </>
      }
    >
      <p className="panel-note">
        {t("contract.source", {
          provider: contract.source.provider,
          trace: contract.source.traceId,
          ts: formatTimestamp(locale, contract.source.capturedAt),
        })}{" "}
        {t("contract.youDecide")}
      </p>
      <ul
        className="rule-list"
        aria-label="Intent contract rules with provenance and review status"
      >
        {contract.rules.map((rule) => {
          const presentation = HUMAN_STATUS_PRESENTATION[rule.humanStatus];
          return (
            <li key={rule.id} className="rule-row">
              <span className={`state-text rule-state state-${presentation.tone}`}>
                {t(presentation.key)}
              </span>
              <div className="rule-body">
                <p className="rule-title">
                  <span className="rule-key-label">
                    {semanticKeyLabel(locale, rule.semanticKey)}
                  </span>{" "}
                  <KeyCode value={rule.semanticKey} />
                  <span className="rule-kind">
                    {rule.kind} · {rule.enforcement}
                  </span>
                </p>
                <p className="rule-value">
                  <ValueCell
                    locale={locale}
                    semanticKey={rule.semanticKey}
                    value={rule.value}
                    unit={rule.unit}
                  />
                </p>
                <p className="rule-provenance">
                  {t("contract.col.provenance")}:{" "}
                  {rule.provenance.map((actionId) => (
                    <code key={actionId} className="provenance-chip">
                      {actionId}
                    </code>
                  ))}
                </p>
              </div>
              <span className="rule-actions">
                {isDraft ? (
                  <>
                    <Button
                      variant="ghost"
                      disabled={rule.humanStatus === "approved"}
                      onClick={() => onSetRuleStatus(rule.id, "approved")}
                    >
                      {t("contract.approveRule")}
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={rule.humanStatus === "excluded"}
                      onClick={() => onSetRuleStatus(rule.id, "excluded")}
                    >
                      {t("contract.excludeRule")}
                    </Button>
                  </>
                ) : (
                  <span className="rule-actions-locked">{t("contract.locked")}</span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="contract-actions">
        {isDraft ? (
          <>
            <Button disabled={proposedCount > 0} onClick={onApproveContract}>
              {t("contract.approve")}
            </Button>
            {proposedCount > 0 && (
              <p className="panel-note" role="status">
                {t("contract.proposedRemaining", { n: proposedCount })}
              </p>
            )}
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={onReviseContract}>
              {t("contract.revise")}
            </Button>
            <p className="panel-note">{t("contract.immutable", { n: contract.revision + 1 })}</p>
          </>
        )}
      </div>
    </Panel>
  );
}
