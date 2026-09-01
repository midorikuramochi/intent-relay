import type { ReactNode } from "react";
import type { IntentContract } from "@intent-relay/contracts";
import type { CompatibilityPreview, MappingEntry } from "@intent-relay/protocol";
import {
  DataTable,
  EmptyState,
  Panel,
  StatusBadge,
  semanticKeyLabel,
  useI18n,
} from "@intent-relay/ui";
import { HumanValue, KeyCode } from "./ValueDisplay";
import { RoleLabel } from "./RoleLabel";

export const MAPPING_STATUS_PRESENTATION = {
  direct: { tone: "ok", icon: "✓", key: "map.status.direct" },
  transformed: { tone: "info", icon: "↻", key: "map.status.transformed" },
  unsupported: { tone: "error", icon: "✕", key: "map.status.unsupported" },
  needs_decision: { tone: "warn", icon: "⚑", key: "map.status.needs_decision" },
} as const;

const STATUS_ORDER = ["direct", "transformed", "unsupported", "needs_decision"] as const;

/** The 5/2/1/1 headline: always visible, the hero of the Transfer step. */
export function CapabilityMap({ preview }: { preview: CompatibilityPreview | null }): ReactNode {
  const { t } = useI18n();
  if (preview === null) {
    return (
      <Panel heading={t("map.heading")}>
        <EmptyState title={t("map.empty.title")}>
          <p>{t("map.empty.body")}</p>
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

  return (
    <Panel heading={t("map.heading")} badge={<RoleLabel role="agent" />}>
      <p className="panel-note">{t("map.summary", { version: preview.targetCapabilityVersion })}</p>
      <ul className="map-summary" aria-label={t("map.heading")}>
        {STATUS_ORDER.map((status) => {
          const presentation = MAPPING_STATUS_PRESENTATION[status];
          return (
            <li key={status} className={`map-stat map-stat-${presentation.tone}`}>
              <span className="map-stat-count">
                {presentation.icon} {counts[status]}
              </span>
              <span className="map-stat-label">{t(presentation.key)}</span>
              <code className="map-stat-code">{status}</code>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

function EvidenceRows({
  entries,
  contract,
}: {
  entries: MappingEntry[];
  contract: IntentContract | null;
}): ReactNode {
  const { locale, t } = useI18n();
  const semanticKeyFor = (ruleId: string): string =>
    contract?.rules.find((rule) => rule.id === ruleId)?.semanticKey ?? ruleId;
  return (
    <DataTable
      caption="Mapping status for approved contract rules"
      columns={[
        { key: "rule", header: t("map.col.rule") },
        { key: "status", header: t("map.col.status") },
        { key: "outcome", header: t("map.col.outcome") },
      ]}
      rows={entries.map((entry) => {
        const presentation = MAPPING_STATUS_PRESENTATION[entry.status];
        const semanticKey = semanticKeyFor(entry.ruleId);
        return {
          id: entry.ruleId,
          cells: {
            rule: (
              <div className="rule-key">
                <span className="rule-key-label">{semanticKeyLabel(locale, semanticKey)}</span>
                <KeyCode value={semanticKey} />
              </div>
            ),
            status: (
              <StatusBadge tone={presentation.tone}>
                {presentation.icon} {t(presentation.key)}
              </StatusBadge>
            ),
            outcome: (
              <>
                {entry.status === "unsupported" && (
                  <div className="mapping-unsupported">{t("map.unsupportedNote")}</div>
                )}
                {entry.targetCapability !== undefined && (
                  <div>
                    → {semanticKeyLabel(locale, entry.targetCapability)}{" "}
                    <KeyCode value={entry.targetCapability} />
                    {entry.proposedValue !== undefined && (
                      <>
                        {" "}
                        = <HumanValue locale={locale} value={entry.proposedValue} />
                      </>
                    )}
                  </div>
                )}
                {entry.transformation !== undefined && (
                  <div className="mapping-note">{entry.transformation.explanation}</div>
                )}
                {entry.reason !== undefined && <div className="mapping-note">{entry.reason}</div>}
              </>
            ),
          },
        };
      })}
    />
  );
}

/**
 * Concrete WebMCP mapping evidence. Non-trivial rows (adapted, unsupported,
 * needs-decision) stay visible; the preserved/direct rows group behind a
 * disclosure. Nothing is removed — every rule keeps its explicit status.
 */
export function MappingEvidence({
  preview,
  contract,
}: {
  preview: CompatibilityPreview | null;
  contract: IntentContract | null;
}): ReactNode {
  const { t } = useI18n();
  if (preview === null) {
    return null;
  }
  const nonTrivial = preview.mappings.filter((entry) => entry.status !== "direct");
  const preserved = preview.mappings.filter((entry) => entry.status === "direct");

  return (
    <Panel heading={t("map.evidence")} badge={<RoleLabel role="agent" />}>
      <EvidenceRows entries={nonTrivial} contract={contract} />
      {preserved.length > 0 && (
        <details className="evidence-preserved">
          <summary>{t("map.showPreserved", { n: preserved.length })}</summary>
          <EvidenceRows entries={preserved} contract={contract} />
        </details>
      )}
      <p className="panel-note tech-note">
        {t("map.preview", {
          hash: `${preview.previewHash.slice(0, 12)}…`,
          n: preview.contractRevision,
        })}
      </p>
    </Panel>
  );
}
