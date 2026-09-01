import {
  approveContractByHuman,
  freezeContract,
  reviseApprovedContract,
  type IntentContract,
} from "@intent-relay/contracts";
import type { MappingEntry } from "@intent-relay/protocol";
import type { RelayCommand, RelayState } from "./types";

export function createInitialRelayState(demoSessionId: string): RelayState {
  return {
    demoSessionId,
    step: "demonstrate",
    contracts: [],
    activeContract: null,
    preview: null,
    resolutions: [],
    targetDraft: null,
  };
}

function requireDraftContract(state: RelayState): IntentContract {
  if (state.activeContract === null) {
    throw new Error("There is no active contract to review");
  }
  if (state.activeContract.status !== "draft") {
    throw new Error("Only a draft contract can be edited; revise the approved contract first");
  }
  return state.activeContract;
}

function replaceContract(contracts: IntentContract[], contract: IntentContract): IntentContract[] {
  const index = contracts.findIndex(
    (candidate) => candidate.id === contract.id && candidate.revision === contract.revision,
  );
  if (index === -1) {
    return [...contracts, contract];
  }
  return contracts.map((candidate, position) => (position === index ? contract : candidate));
}

export function unresolvedDecisions(state: RelayState): MappingEntry[] {
  const resolved = new Set(state.resolutions.map((resolution) => resolution.ruleId));
  return (state.preview?.mappings ?? []).filter(
    (entry) => entry.status === "needs_decision" && !resolved.has(entry.ruleId),
  );
}

export function reduceRelay(state: RelayState, command: RelayCommand): RelayState {
  switch (command.type) {
    case "resetDemo":
      return createInitialRelayState(command.sessionId);

    case "goToStep":
      return { ...state, step: command.step };

    case "saveContractDraft": {
      if (command.contract.status !== "draft") {
        throw new Error("Only a draft contract can be saved for human review");
      }
      const approvedSameRevision = state.contracts.find(
        (candidate) =>
          candidate.id === command.contract.id &&
          candidate.revision === command.contract.revision &&
          candidate.status === "approved",
      );
      if (approvedSameRevision !== undefined) {
        throw new Error(
          `Contract "${command.contract.id}" revision ${command.contract.revision} is already approved and immutable; use Revise contract to create the next draft revision`,
        );
      }
      const hasApprovedRevision = state.contracts.some(
        (candidate) => candidate.id === command.contract.id && candidate.status === "approved",
      );
      if (hasApprovedRevision) {
        const humanOpenedRevision =
          state.activeContract !== null &&
          state.activeContract.status === "draft" &&
          state.activeContract.id === command.contract.id
            ? state.activeContract.revision
            : null;
        if (command.contract.revision !== humanOpenedRevision) {
          throw new Error(
            `Contract "${command.contract.id}" has an approved revision; the human must open the next draft revision with Revise contract before a draft for revision ${command.contract.revision} can be saved`,
          );
        }
      }
      return {
        ...state,
        contracts: replaceContract(state.contracts, command.contract),
        activeContract: command.contract,
        preview: null,
        resolutions: [],
        targetDraft: null,
        step: "verify_contract",
      };
    }

    case "setRuleStatus": {
      const active = requireDraftContract(state);
      if (!active.rules.some((rule) => rule.id === command.ruleId)) {
        throw new Error(`The active contract has no rule "${command.ruleId}"`);
      }
      const updated = structuredClone(active);
      updated.rules = updated.rules.map((rule) =>
        rule.id === command.ruleId ? { ...rule, humanStatus: command.humanStatus } : rule,
      );
      const frozen = freezeContract(updated);
      return {
        ...state,
        activeContract: frozen,
        contracts: replaceContract(state.contracts, frozen),
      };
    }

    case "approveContractByHuman": {
      const active = requireDraftContract(state);
      const approved = approveContractByHuman(active, command.approvedAt);
      return {
        ...state,
        activeContract: approved,
        contracts: replaceContract(state.contracts, approved),
      };
    }

    case "reviseContract": {
      if (state.activeContract === null || state.activeContract.status !== "approved") {
        throw new Error("Only an approved contract can be revised");
      }
      const revised = reviseApprovedContract(state.activeContract);
      return {
        ...state,
        activeContract: revised,
        contracts: replaceContract(state.contracts, revised),
        preview: null,
        resolutions: [],
        targetDraft: null,
        step: "verify_contract",
      };
    }

    case "savePreview": {
      if (state.activeContract === null || state.activeContract.status !== "approved") {
        throw new Error("A compatibility preview requires an approved active contract");
      }
      if (
        command.preview.contractId !== state.activeContract.id ||
        command.preview.contractRevision !== state.activeContract.revision
      ) {
        throw new Error("The preview does not match the active contract revision");
      }
      return {
        ...state,
        preview: command.preview,
        resolutions: [],
        targetDraft: null,
        step: "transfer",
      };
    }

    case "resolveDecision": {
      if (state.preview === null) {
        throw new Error("There is no compatibility preview to resolve decisions for");
      }
      if (state.targetDraft !== null) {
        throw new Error(
          "Human Queue decisions are locked once a target draft has been prepared; revise the contract or inspect compatibility again to start a new transfer",
        );
      }
      const entry = state.preview.mappings.find((candidate) => candidate.ruleId === command.ruleId);
      if (entry === undefined || entry.status !== "needs_decision") {
        throw new Error(`Rule "${command.ruleId}" is not a needs_decision mapping entry`);
      }
      if (
        !(entry.alternatives ?? []).some((alternative) => alternative.id === command.alternativeId)
      ) {
        throw new Error(
          `"${command.alternativeId}" is not a listed alternative for rule "${command.ruleId}"`,
        );
      }
      const resolutions = [
        ...state.resolutions.filter((resolution) => resolution.ruleId !== command.ruleId),
        {
          ruleId: command.ruleId,
          alternativeId: command.alternativeId,
          resolvedAt: command.resolvedAt,
        },
      ];
      return { ...state, resolutions };
    }

    case "recordTargetDraft": {
      if (state.preview === null) {
        throw new Error("A compatibility preview is required before recording a target draft");
      }
      const blocking = unresolvedDecisions(state);
      if (blocking.length > 0) {
        throw new Error(
          `${blocking.length} unresolved decision(s) block draft preparation; the human must resolve every needs_decision entry first`,
        );
      }
      return { ...state, targetDraft: command.draft, step: "review" };
    }
  }
}
