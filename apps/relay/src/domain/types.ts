import type { IntentContract } from "@intent-relay/contracts";
import type { CompatibilityPreview } from "@intent-relay/protocol";

export type WorkbenchStep = "demonstrate" | "verify_contract" | "transfer" | "review";

export interface HumanResolution {
  ruleId: string;
  alternativeId: string;
  resolvedAt: string;
}

export interface TargetDraftRecord {
  draftId: string;
  revision: number;
  publication: string;
}

export interface RelayState {
  demoSessionId: string;
  step: WorkbenchStep;
  contracts: IntentContract[];
  activeContract: IntentContract | null;
  preview: CompatibilityPreview | null;
  resolutions: HumanResolution[];
  targetDraft: TargetDraftRecord | null;
}

export type RelayCommand =
  | { type: "resetDemo"; sessionId: string }
  | { type: "goToStep"; step: WorkbenchStep }
  | { type: "saveContractDraft"; contract: IntentContract }
  | { type: "setRuleStatus"; ruleId: string; humanStatus: "approved" | "excluded" }
  | { type: "approveContractByHuman"; approvedAt: string }
  | { type: "reviseContract" }
  | { type: "savePreview"; preview: CompatibilityPreview }
  | { type: "resolveDecision"; ruleId: string; alternativeId: string; resolvedAt: string }
  | { type: "recordTargetDraft"; draft: TargetDraftRecord };
