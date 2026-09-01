import { z } from "zod";

export type CapabilityValueType =
  "string" | "number" | "boolean" | "enum" | "duration" | "datetime";

export interface CapabilityTransformation {
  id: string;
  from: string;
  to: string;
  explanation: string;
}

export interface ProviderCapability {
  semanticKey: string;
  valueType: CapabilityValueType;
  acceptedValues?: unknown[];
  constraints?: Record<string, unknown>;
  supportedTransformations?: CapabilityTransformation[];
}

export interface CapabilityManifest {
  provider: "orbit";
  version: string;
  capabilities: ProviderCapability[];
  unsupportedSemanticKeys: string[];
  humanOnlyActions: ["event.publish"];
}

export type MappingStatus = "direct" | "transformed" | "unsupported" | "needs_decision";

export interface MappingAlternative {
  id: string;
  label: string;
  consequence: string;
}

export interface MappingEntry {
  ruleId: string;
  status: MappingStatus;
  targetCapability?: string;
  proposedValue?: unknown;
  transformation?: {
    id: string;
    explanation: string;
  };
  reason?: string;
  alternatives?: MappingAlternative[];
}

export interface CompatibilityPreview {
  contractId: string;
  contractRevision: number;
  targetProvider: "orbit";
  targetCapabilityVersion: string;
  mappings: MappingEntry[];
  previewHash: string;
  createdAt: string;
}

const capabilityTransformationSchema = z.strictObject({
  id: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
  explanation: z.string().min(1),
});

export const providerCapabilitySchema = z.strictObject({
  semanticKey: z.string().min(1),
  valueType: z.enum(["string", "number", "boolean", "enum", "duration", "datetime"]),
  acceptedValues: z.array(z.unknown()).optional(),
  constraints: z.record(z.string(), z.unknown()).optional(),
  supportedTransformations: z.array(capabilityTransformationSchema).optional(),
});

export const capabilityManifestSchema = z.strictObject({
  provider: z.literal("orbit"),
  version: z.string().min(1),
  capabilities: z.array(providerCapabilitySchema),
  unsupportedSemanticKeys: z.array(z.string().min(1)),
  humanOnlyActions: z.tuple([z.literal("event.publish")]),
});
