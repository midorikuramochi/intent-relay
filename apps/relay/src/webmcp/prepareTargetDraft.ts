import { toolFailure, toolSuccess, type CompatibilityPreview } from "@intent-relay/protocol";
import type { ModelContextPort } from "@intent-relay/webmcp";
import { unresolvedDecisions } from "../domain/reducer";
import type { RelayStore } from "../domain/storage";
import type { HumanResolution } from "../domain/types";
import type { ProviderBridge } from "../providers/providerBridge";
import { stableStringify } from "@intent-relay/mapping";
import {
  cancelledFailure,
  describeCapabilitiesDataSchema,
  executeProvider,
  isCancelled,
  prepareEventDraftDataSchema,
  readEventDraftDataSchema,
  type RelayToolHandler,
} from "./toolResults";

/**
 * Builds the exact Orbit draft payload from the preview and recorded human
 * resolutions: direct and transformed entries carry their proposed values,
 * needs_decision entries carry the human's chosen alternative, unsupported
 * entries are excluded from the payload while remaining in the review, and
 * human-only actions (event.publish) are never sent as draft values.
 */
export function buildOrbitDraftPayload(
  preview: CompatibilityPreview,
  resolutions: HumanResolution[],
  humanOnlyActions: readonly string[],
): {
  contractId: string;
  contractRevision: number;
  capabilityVersion: string;
  previewHash: string;
  values: Record<string, unknown>;
} {
  const resolutionByRule = new Map(
    resolutions.map((resolution) => [resolution.ruleId, resolution]),
  );
  const values: Record<string, unknown> = {};
  for (const entry of preview.mappings) {
    if (entry.targetCapability === undefined) {
      continue;
    }
    if (humanOnlyActions.includes(entry.targetCapability)) {
      continue;
    }
    if (entry.status === "direct" || entry.status === "transformed") {
      if (entry.proposedValue !== undefined) {
        values[entry.targetCapability] = entry.proposedValue;
      }
      continue;
    }
    if (entry.status === "needs_decision") {
      const resolution = resolutionByRule.get(entry.ruleId);
      if (resolution !== undefined) {
        values[entry.targetCapability] = resolution.alternativeId;
      }
    }
  }
  return {
    contractId: preview.contractId,
    contractRevision: preview.contractRevision,
    capabilityVersion: preview.targetCapabilityVersion,
    previewHash: preview.previewHash,
    values,
  };
}

type TransferValidation =
  | { ok: true; preview: NonNullable<ReturnType<RelayStore["getState"]>["preview"]> }
  | ReturnType<typeof toolFailure>;

/**
 * Validates the transfer prerequisites against ONE consistent Relay state
 * snapshot. prepare_target_draft runs this both before and after every await
 * so a human change during an in-flight provider call is always re-checked.
 */
function validateTransfer(
  state: ReturnType<RelayStore["getState"]>,
  contractId: string | null,
  previewHash: string | null,
): TransferValidation {
  if (state.preview === null) {
    const revisedMidTransfer =
      state.activeContract !== null &&
      state.activeContract.status === "draft" &&
      state.contracts.some(
        (candidate) => candidate.id === state.activeContract?.id && candidate.status === "approved",
      );
    if (revisedMidTransfer) {
      return toolFailure(
        "STALE_PREVIEW",
        "The contract was revised after the preview was created; run inspect_target_compatibility again once the new revision is approved",
        true,
      );
    }
    return toolFailure(
      "PREVIEW_NOT_FOUND",
      "There is no compatibility preview; run inspect_target_compatibility first",
      true,
    );
  }
  if (contractId === null || state.preview.contractId !== contractId) {
    return toolFailure(
      "PREVIEW_NOT_FOUND",
      `The current preview does not belong to contract "${String(contractId)}"`,
      true,
    );
  }
  if (previewHash === null || state.preview.previewHash !== previewHash) {
    return toolFailure(
      "STALE_PREVIEW",
      "The supplied preview hash does not match the current preview; inspect compatibility again",
      true,
    );
  }
  if (
    state.activeContract === null ||
    state.activeContract.id !== state.preview.contractId ||
    state.activeContract.revision !== state.preview.contractRevision ||
    state.activeContract.status !== "approved"
  ) {
    return toolFailure(
      "STALE_PREVIEW",
      "The active contract revision no longer matches the preview; inspect compatibility again",
      true,
    );
  }
  const blocking = unresolvedDecisions(state);
  if (blocking.length > 0) {
    return toolFailure(
      "UNRESOLVED_DECISIONS",
      `${blocking.length} needs_decision entr${blocking.length === 1 ? "y" : "ies"} must be resolved by the human in the Workbench before the draft can be prepared`,
      true,
      blocking.map((entry) => entry.ruleId),
    );
  }
  return { ok: true, preview: state.preview };
}

export function createPrepareTargetDraft(deps: {
  port: ModelContextPort;
  bridge: ProviderBridge;
  store: RelayStore;
}): RelayToolHandler {
  return async (args, signal) => {
    if (isCancelled(signal)) {
      return cancelledFailure("prepare_target_draft");
    }
    const contractId = typeof args.contractId === "string" ? args.contractId : null;
    const previewHash = typeof args.previewHash === "string" ? args.previewHash : null;

    const first = validateTransfer(deps.store.getState(), contractId, previewHash);
    if (!("preview" in first)) {
      return first;
    }

    const capabilities = await executeProvider(
      deps,
      "orbit",
      "describe_event_capabilities",
      {},
      signal,
      describeCapabilitiesDataSchema,
    );
    if (!("data" in capabilities)) {
      return capabilities;
    }

    const latest = deps.store.getState();
    const second = validateTransfer(latest, contractId, previewHash);
    if (!("preview" in second)) {
      return second;
    }
    if (capabilities.data.manifest.version !== second.preview.targetCapabilityVersion) {
      return toolFailure(
        "STALE_PREVIEW",
        `Orbit now serves capability version "${capabilities.data.manifest.version}" but the preview targets "${second.preview.targetCapabilityVersion}"; inspect compatibility again`,
        true,
      );
    }
    if (isCancelled(signal)) {
      return cancelledFailure("prepare_target_draft");
    }

    const payload = buildOrbitDraftPayload(
      second.preview,
      latest.resolutions,
      capabilities.data.manifest.humanOnlyActions,
    );
    const prepared = await executeProvider(
      deps,
      "orbit",
      "prepare_event_draft",
      { draft: payload },
      signal,
      prepareEventDraftDataSchema,
    );
    if (!("data" in prepared)) {
      return prepared;
    }

    // Post-write verification: confirm the live Orbit draft is exactly the
    // payload this call sent, and that the Relay transfer still represents
    // that payload, before recording anything as the current target draft.
    const liveDraft = await executeProvider(
      deps,
      "orbit",
      "read_event_draft",
      {},
      signal,
      readEventDraftDataSchema,
    );
    if (!("data" in liveDraft)) {
      return liveDraft;
    }
    const written = liveDraft.data.draft;
    if (
      written === null ||
      written.draftId !== prepared.data.draftId ||
      written.previewHash !== payload.previewHash ||
      written.contractId !== payload.contractId ||
      written.contractRevision !== payload.contractRevision ||
      Object.entries(payload.values).some(
        ([key, value]) => stableStringify(written.values[key]) !== stableStringify(value),
      )
    ) {
      return toolFailure(
        "STALE_PREVIEW",
        "Orbit's live draft does not match the payload that was just sent; the draft was not recorded — inspect compatibility and prepare again",
        true,
      );
    }

    const finalState = deps.store.getState();
    const finalCheck = validateTransfer(finalState, contractId, previewHash);
    if (!("preview" in finalCheck)) {
      return finalCheck;
    }
    const finalPayload = buildOrbitDraftPayload(
      finalCheck.preview,
      finalState.resolutions,
      capabilities.data.manifest.humanOnlyActions,
    );
    if (stableStringify(finalPayload) !== stableStringify(payload)) {
      return toolFailure(
        "STALE_PREVIEW",
        "The human changed a decision while the Orbit draft was being prepared; the prepared draft was not recorded — revise the contract to start a new transfer with the updated decision",
        true,
      );
    }

    try {
      deps.store.dispatch({
        type: "recordTargetDraft",
        draft: {
          draftId: prepared.data.draftId,
          revision: prepared.data.revision,
          publication: prepared.data.publication,
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Relay refused to record the target draft";
      return toolFailure(
        message.toLowerCase().includes("decision") ? "UNRESOLVED_DECISIONS" : "STALE_PREVIEW",
        message,
        true,
      );
    }
    return toolSuccess({
      targetDraftId: prepared.data.draftId,
      targetDraftRevision: prepared.data.revision,
      publication: prepared.data.publication,
      excludedUnsupportedRuleIds: second.preview.mappings
        .filter((entry) => entry.status === "unsupported")
        .map((entry) => entry.ruleId),
    });
  };
}
