import { mapContract } from "@intent-relay/mapping";
import { toolFailure, toolSuccess, type MappingStatus } from "@intent-relay/protocol";
import type { ModelContextPort } from "@intent-relay/webmcp";
import { unresolvedDecisions } from "../domain/reducer";
import type { RelayStore } from "../domain/storage";
import type { ProviderBridge } from "../providers/providerBridge";
import {
  cancelledFailure,
  describeCapabilitiesDataSchema,
  executeProvider,
  isCancelled,
  type RelayToolHandler,
} from "./toolResults";

export function countMappingStatuses(
  mappings: Array<{ status: MappingStatus }>,
): Record<MappingStatus, number> {
  const counts: Record<MappingStatus, number> = {
    direct: 0,
    transformed: 0,
    unsupported: 0,
    needs_decision: 0,
  };
  for (const entry of mappings) {
    counts[entry.status] += 1;
  }
  return counts;
}

export function createInspectTargetCompatibility(deps: {
  port: ModelContextPort;
  bridge: ProviderBridge;
  store: RelayStore;
  now: () => string;
}): RelayToolHandler {
  return async (args, signal) => {
    if (isCancelled(signal)) {
      return cancelledFailure("inspect_target_compatibility");
    }
    const contractId = typeof args.contractId === "string" ? args.contractId : null;
    const active = deps.store.getState().activeContract;
    if (contractId === null || active === null || active.id !== contractId) {
      return toolFailure(
        "CONTRACT_NOT_FOUND",
        `There is no active contract with id "${String(args.contractId)}"`,
        true,
      );
    }
    if (active.status !== "approved") {
      return toolFailure(
        "CONTRACT_NOT_APPROVED",
        "Only a human-approved contract can be mapped against Orbit; ask the user to approve it in the Workbench",
        true,
      );
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
    let preview;
    try {
      preview = await mapContract(active, capabilities.data.manifest, deps.now());
    } catch (error) {
      return toolFailure(
        "CAPABILITY_VERSION_INVALID",
        error instanceof Error ? error.message : "Orbit's capability manifest could not be mapped",
        true,
      );
    }
    if (isCancelled(signal)) {
      return cancelledFailure("inspect_target_compatibility");
    }
    try {
      deps.store.dispatch({ type: "savePreview", preview });
    } catch (error) {
      return toolFailure(
        "CONTRACT_NOT_FOUND",
        error instanceof Error ? error.message : "The active contract changed during inspection",
        true,
      );
    }
    const state = deps.store.getState();
    return toolSuccess({
      contractId: preview.contractId,
      contractRevision: preview.contractRevision,
      targetCapabilityVersion: preview.targetCapabilityVersion,
      previewHash: preview.previewHash,
      mappingCounts: countMappingStatuses(preview.mappings),
      mappings: preview.mappings,
      unresolvedDecisionCount: unresolvedDecisions(state).length,
      humanDecisionRequired: unresolvedDecisions(state).length > 0,
    });
  };
}
