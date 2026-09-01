import { freezeContract } from "./contractReducer";
import { intentContractDraftInputSchema } from "./schema";
import type { SemanticTrace } from "./trace";
import type { IntentContract } from "./types";

export type ContractValidationErrorCode = "INVALID_CONTRACT" | "UNKNOWN_PROVENANCE" | "STALE_TRACE";

export interface ContractValidationError {
  code: ContractValidationErrorCode;
  message: string;
  details?: unknown;
}

export type ContractValidationResult =
  { ok: true; value: IntentContract } | { ok: false; error: ContractValidationError };

export function validateContractDraft(
  input: unknown,
  trace: SemanticTrace,
): ContractValidationResult {
  const parsed = intentContractDraftInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: "INVALID_CONTRACT",
        message: "Contract does not match the version 0.1 event contract schema",
        details: parsed.error.issues,
      },
    };
  }

  const contract = parsed.data;

  const seenRuleIds = new Set<string>();
  const duplicateRuleIds = contract.rules
    .map((rule) => rule.id)
    .filter((ruleId) => {
      if (seenRuleIds.has(ruleId)) {
        return true;
      }
      seenRuleIds.add(ruleId);
      return false;
    });
  if (duplicateRuleIds.length > 0) {
    return {
      ok: false,
      error: {
        code: "INVALID_CONTRACT",
        message: "Contract contains duplicate rule IDs",
        details: duplicateRuleIds,
      },
    };
  }

  if (contract.source.traceId !== trace.id) {
    return {
      ok: false,
      error: {
        code: "STALE_TRACE",
        message: `Contract cites trace "${contract.source.traceId}" but the active trace is "${trace.id}"`,
      },
    };
  }

  const actionsById = new Map(trace.actions.map((action) => [action.id, action]));
  const unknownProvenance = contract.rules.flatMap((rule) =>
    rule.provenance
      .filter((actionId) => !actionsById.has(actionId))
      .map((actionId) => ({ ruleId: rule.id, actionId })),
  );
  if (unknownProvenance.length > 0) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_PROVENANCE",
        message: "Contract cites action IDs that are absent from the active trace",
        details: unknownProvenance,
      },
    };
  }

  const unsupportedRules = contract.rules
    .filter(
      (rule) =>
        !rule.provenance.some(
          (actionId) => actionsById.get(actionId)?.semanticKey === rule.semanticKey,
        ),
    )
    .map((rule) => ({ ruleId: rule.id, semanticKey: rule.semanticKey }));
  if (unsupportedRules.length > 0) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_PROVENANCE",
        message: "No cited provenance action supports the rule's semantic key",
        details: unsupportedRules,
      },
    };
  }

  const draft: IntentContract = {
    ...contract,
    status: "draft",
    rules: contract.rules.map((rule) => ({ ...rule, humanStatus: "proposed" })),
  };
  delete draft.approvedAt;
  return { ok: true, value: freezeContract(draft) };
}
