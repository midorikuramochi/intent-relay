import { approvalTimestampSchema } from "./schema";
import type { IntentContract } from "./types";

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
  }
  return value;
}

export function freezeContract(contract: IntentContract): IntentContract {
  return deepFreeze(structuredClone(contract));
}

export function approveContractByHuman(
  contract: IntentContract,
  approvedAt: string,
): IntentContract {
  if (contract.status !== "draft") {
    throw new Error("Only a draft contract can be approved");
  }
  if (!approvalTimestampSchema.safeParse(approvedAt).success) {
    throw new Error("Approval requires a valid ISO 8601 timestamp");
  }
  const proposedRuleIds = contract.rules
    .filter((rule) => rule.humanStatus === "proposed")
    .map((rule) => rule.id);
  if (proposedRuleIds.length > 0) {
    throw new Error(
      `Cannot approve a contract while rules remain proposed; approve or exclude: ${proposedRuleIds.join(", ")}`,
    );
  }
  return freezeContract({
    ...contract,
    status: "approved",
    approvedAt,
  });
}

export function reviseApprovedContract(contract: IntentContract): IntentContract {
  if (contract.status !== "approved") {
    throw new Error("Only an approved contract can be revised");
  }
  const revised: IntentContract = {
    ...contract,
    revision: contract.revision + 1,
    status: "draft",
  };
  delete revised.approvedAt;
  return freezeContract(revised);
}
