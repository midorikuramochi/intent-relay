export type RuleKind =
  "context" | "constraint" | "preference" | "conditional" | "approval_boundary";

export type HumanStatus = "proposed" | "approved" | "excluded";

export type RuleEnforcement = "must" | "prefer" | "inform" | "human_required";

export interface RuleCondition {
  semanticKey: string;
  operator: "equals" | "not_equals" | "exists";
  value?: unknown;
}

export interface IntentRule {
  id: string;
  kind: RuleKind;
  semanticKey: string;
  value: unknown;
  unit?: string;
  enforcement: RuleEnforcement;
  rationale?: string;
  provenance: string[];
  humanStatus: HumanStatus;
  condition?: RuleCondition;
}

export interface ContractSource {
  provider: "gather";
  traceId: string;
  capturedAt: string;
}

export interface IntentContract {
  version: "0.1";
  id: string;
  revision: number;
  domain: "event";
  status: "draft" | "approved";
  source: ContractSource;
  rules: IntentRule[];
  approvedAt?: string;
}
