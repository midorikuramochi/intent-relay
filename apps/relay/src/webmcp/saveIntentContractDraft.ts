import { validateContractDraft, type SemanticTrace } from "@intent-relay/contracts";
import { toolFailure, toolSuccess } from "@intent-relay/protocol";
import { readSourceDemonstration, type SourceDeps } from "./inspectSourceDemonstration";
import { cancelledFailure, isCancelled, type RelayToolHandler } from "./toolResults";

export function createSaveIntentContractDraft(
  deps: SourceDeps & {
    getTrace: () => SemanticTrace | null;
    invalidateDemonstration: () => void;
  },
): RelayToolHandler {
  return async (args, signal) => {
    if (isCancelled(signal)) {
      return cancelledFailure("save_intent_contract_draft");
    }
    const cached = deps.getTrace();
    if (cached === null || !cached.completed || cached.actions.length === 0) {
      return toolFailure(
        "TRACE_EMPTY",
        "There is no inspected completed demonstration; call inspect_source_demonstration first",
        true,
      );
    }
    if (args.contract === undefined) {
      return toolFailure(
        "INVALID_CONTRACT",
        'The input requires a "contract" object with a version 0.1 event Intent Contract',
        true,
      );
    }

    const fresh = await readSourceDemonstration(deps, signal);
    if (!("data" in fresh)) {
      deps.invalidateDemonstration();
      return fresh;
    }
    const freshTrace = fresh.data.trace;
    if (
      freshTrace.id !== cached.id ||
      !freshTrace.completed ||
      freshTrace.eventRevision !== cached.eventRevision ||
      freshTrace.actions.length !== cached.actions.length
    ) {
      deps.invalidateDemonstration();
      return toolFailure(
        "STALE_TRACE",
        "The Gather demonstration changed after it was inspected; call inspect_source_demonstration again before saving a contract",
        true,
      );
    }

    const validation = validateContractDraft(args.contract, freshTrace);
    if (!validation.ok) {
      return toolFailure(
        validation.error.code,
        validation.error.message,
        true,
        validation.error.details,
      );
    }
    if (isCancelled(signal)) {
      return cancelledFailure("save_intent_contract_draft");
    }
    try {
      deps.store.dispatch({ type: "saveContractDraft", contract: validation.value });
    } catch (error) {
      return toolFailure(
        "INVALID_CONTRACT",
        error instanceof Error ? error.message : "The Relay state rejected the contract draft",
        true,
      );
    }
    return toolSuccess({
      contractId: validation.value.id,
      revision: validation.value.revision,
      status: validation.value.status,
      ruleCount: validation.value.rules.length,
      humanApprovalRequired: true,
    });
  };
}
