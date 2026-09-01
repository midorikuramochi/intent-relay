import type { IntentContract, IntentRule } from "@intent-relay/contracts";
import {
  capabilityManifestSchema,
  type CapabilityManifest,
  type CompatibilityPreview,
  type MappingEntry,
  type ProviderCapability,
} from "@intent-relay/protocol";
import { computePreviewHash } from "./previewHash";

const DURATION_UNIT_MINUTES: Record<string, number> = {
  minutes: 1,
  hours: 60,
  days: 1440,
};

function humanizeValue(value: string): string {
  const words = value.replaceAll("_", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function mapEnumRule(rule: IntentRule, capability: ProviderCapability): MappingEntry {
  const acceptedValues = capability.acceptedValues ?? [];
  if (acceptedValues.some((accepted) => accepted === rule.value)) {
    return {
      ruleId: rule.id,
      status: "direct",
      targetCapability: capability.semanticKey,
      proposedValue: rule.value,
    };
  }
  return {
    ruleId: rule.id,
    status: "needs_decision",
    targetCapability: capability.semanticKey,
    reason: `Orbit does not accept "${String(rule.value)}" for ${capability.semanticKey}`,
    alternatives: acceptedValues.map((accepted) => ({
      id: String(accepted),
      label: humanizeValue(String(accepted)),
      consequence: `Orbit will apply "${humanizeValue(String(accepted))}" instead of the demonstrated "${humanizeValue(String(rule.value))}".`,
    })),
  };
}

function mapDurationRule(rule: IntentRule, capability: ProviderCapability): MappingEntry {
  const constraintUnit =
    typeof capability.constraints?.unit === "string" ? capability.constraints.unit : undefined;
  if (constraintUnit === undefined || rule.unit === constraintUnit) {
    return {
      ruleId: rule.id,
      status: "direct",
      targetCapability: capability.semanticKey,
      proposedValue: rule.value,
    };
  }
  const transformation = capability.supportedTransformations?.find(
    (candidate) => candidate.from === rule.unit && candidate.to === constraintUnit,
  );
  const fromMinutes = rule.unit === undefined ? undefined : DURATION_UNIT_MINUTES[rule.unit];
  const toMinutes = DURATION_UNIT_MINUTES[constraintUnit];
  if (
    transformation !== undefined &&
    typeof rule.value === "number" &&
    fromMinutes !== undefined &&
    toMinutes !== undefined
  ) {
    const converted = (rule.value * fromMinutes) / toMinutes;
    const wholeNumbersOnly = capability.constraints?.wholeNumbersOnly === true;
    if (!wholeNumbersOnly || Number.isInteger(converted)) {
      return {
        ruleId: rule.id,
        status: "transformed",
        targetCapability: capability.semanticKey,
        proposedValue: converted,
        transformation: { id: transformation.id, explanation: transformation.explanation },
      };
    }
  }
  return {
    ruleId: rule.id,
    status: "needs_decision",
    targetCapability: capability.semanticKey,
    reason: `Orbit measures ${capability.semanticKey} in ${constraintUnit} and no supported conversion preserves the demonstrated value`,
  };
}

function mapRule(rule: IntentRule, manifest: CapabilityManifest): MappingEntry[] {
  if (rule.kind === "approval_boundary") {
    if (manifest.humanOnlyActions.some((action) => action === rule.semanticKey)) {
      return [
        {
          ruleId: rule.id,
          status: "direct",
          targetCapability: rule.semanticKey,
          proposedValue: rule.value,
        },
      ];
    }
    return [
      {
        ruleId: rule.id,
        status: "needs_decision",
        reason: `Orbit does not declare ${rule.semanticKey} as a human-only action; the approval boundary cannot be downgraded`,
      },
    ];
  }

  if (manifest.unsupportedSemanticKeys.includes(rule.semanticKey)) {
    return [
      {
        ruleId: rule.id,
        status: "unsupported",
        reason: `Orbit declares "${rule.semanticKey}" as unsupported`,
      },
    ];
  }

  const capability = manifest.capabilities.find(
    (candidate) => candidate.semanticKey === rule.semanticKey,
  );
  if (capability !== undefined) {
    if (capability.valueType === "enum") {
      return [mapEnumRule(rule, capability)];
    }
    if (capability.valueType === "duration") {
      return [mapDurationRule(rule, capability)];
    }
    return [
      {
        ruleId: rule.id,
        status: "direct",
        targetCapability: capability.semanticKey,
        proposedValue: rule.value,
      },
    ];
  }

  for (const candidate of manifest.capabilities) {
    const transformation = candidate.supportedTransformations?.find(
      (entry) => entry.from === rule.semanticKey && entry.to === candidate.semanticKey,
    );
    if (transformation !== undefined) {
      return [
        {
          ruleId: rule.id,
          status: "transformed",
          targetCapability: candidate.semanticKey,
          proposedValue: rule.value,
          transformation: { id: transformation.id, explanation: transformation.explanation },
        },
      ];
    }
  }

  return [
    {
      ruleId: rule.id,
      status: "unsupported",
      reason: `Orbit does not declare a capability for "${rule.semanticKey}"`,
    },
  ];
}

export async function mapContract(
  contract: IntentContract,
  manifest: CapabilityManifest,
  now: string = new Date().toISOString(),
): Promise<CompatibilityPreview> {
  if (contract.status !== "approved") {
    throw new Error("Only an approved contract can be mapped against provider capabilities");
  }
  if (!capabilityManifestSchema.safeParse(manifest).success) {
    throw new Error("Invalid capability manifest");
  }

  const approvedRules = contract.rules.filter((rule) => rule.humanStatus === "approved");
  const mappings = approvedRules.map((rule) => {
    const entries = mapRule(rule, manifest);
    if (entries.length !== 1) {
      throw new Error(`Mapping produced ${entries.length} entries for rule "${rule.id}"`);
    }
    return entries[0]!;
  });

  const withoutHash = {
    contractId: contract.id,
    contractRevision: contract.revision,
    targetProvider: "orbit" as const,
    targetCapabilityVersion: manifest.version,
    mappings,
    createdAt: now,
  };
  const previewHash = await computePreviewHash(withoutHash);
  return { ...withoutHash, previewHash };
}
