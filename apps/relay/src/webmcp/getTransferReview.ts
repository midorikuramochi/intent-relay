import { toolFailure, toolSuccess } from "@intent-relay/protocol";
import type { ModelContextPort } from "@intent-relay/webmcp";
import type { RelayStore } from "../domain/storage";
import type { ProviderBridge } from "../providers/providerBridge";
import { countMappingStatuses } from "./inspectTargetCompatibility";
import {
  cancelledFailure,
  executeProvider,
  isCancelled,
  readEventDraftDataSchema,
  type RelayToolHandler,
} from "./toolResults";

export function createGetTransferReview(deps: {
  port: ModelContextPort;
  bridge: ProviderBridge;
  store: RelayStore;
}): RelayToolHandler {
  return async (_args, signal) => {
    if (isCancelled(signal)) {
      return cancelledFailure("get_transfer_review");
    }
    const state = deps.store.getState();
    if (state.targetDraft === null || state.preview === null) {
      return toolFailure(
        "DRAFT_NOT_PREPARED",
        "No Orbit draft has been prepared for the current preview; call prepare_target_draft first",
        true,
      );
    }
    const orbitDraft = await executeProvider(
      deps,
      "orbit",
      "read_event_draft",
      {},
      signal,
      readEventDraftDataSchema,
    );
    if (!("data" in orbitDraft)) {
      return orbitDraft;
    }

    const latest = deps.store.getState();
    if (latest.targetDraft === null || latest.preview === null) {
      return toolFailure(
        "DRAFT_NOT_PREPARED",
        "The transfer changed while Orbit was being read; there is no prepared draft for the current transfer",
        true,
      );
    }
    if (orbitDraft.data.draft === null) {
      return toolFailure(
        "DRAFT_NOT_PREPARED",
        "Orbit reports no listing draft for this session",
        true,
      );
    }
    if (orbitDraft.data.draft.previewHash !== latest.preview.previewHash) {
      return toolFailure(
        "STALE_PREVIEW",
        "Orbit's draft was prepared from a different compatibility preview; prepare the draft again",
        true,
      );
    }
    if (orbitDraft.data.draft.draftId !== latest.targetDraft.draftId) {
      return toolFailure(
        "STALE_PREVIEW",
        `Orbit's live draft "${orbitDraft.data.draft.draftId}" is not the recorded target draft "${latest.targetDraft.draftId}"; prepare the draft again`,
        true,
      );
    }
    if (
      orbitDraft.data.draft.contractId !== latest.preview.contractId ||
      orbitDraft.data.draft.contractRevision !== latest.preview.contractRevision
    ) {
      return toolFailure(
        "STALE_PREVIEW",
        "Orbit's draft belongs to a different contract revision than the current preview; prepare the draft again",
        true,
      );
    }
    for (const entry of latest.preview.mappings) {
      if (entry.status !== "needs_decision" || entry.targetCapability === undefined) {
        continue;
      }
      const resolution = latest.resolutions.find((candidate) => candidate.ruleId === entry.ruleId);
      if (
        resolution !== undefined &&
        orbitDraft.data.draft.values[entry.targetCapability] !== resolution.alternativeId
      ) {
        return toolFailure(
          "STALE_PREVIEW",
          `Orbit's draft does not reflect the recorded human decision for ${entry.targetCapability}; prepare the draft again`,
          true,
        );
      }
    }
    return toolSuccess({
      contractId: latest.preview.contractId,
      contractRevision: latest.preview.contractRevision,
      targetProvider: "orbit" as const,
      targetDraftId: orbitDraft.data.draft.draftId,
      mappingCounts: countMappingStatuses(latest.preview.mappings),
      entries: latest.preview.mappings,
      humanResolutions: latest.resolutions,
      publication:
        orbitDraft.data.publication === "draft"
          ? ("waiting_for_human" as const)
          : orbitDraft.data.publication,
    });
  };
}
