import { orbitCapabilities } from "@intent-relay/fixtures";
import { stableStringify } from "@intent-relay/mapping";
import type { ProviderCapability } from "@intent-relay/protocol";
import { z } from "zod";
import type { OrbitAction, OrbitDraftPayload, OrbitDraftValues, OrbitState } from "./types";

export type OrbitRejectionCode = "TARGET_REJECTED_DRAFT" | "CAPABILITY_VERSION_INVALID";

export class OrbitDraftError extends Error {
  constructor(
    public readonly code: OrbitRejectionCode,
    message: string,
  ) {
    super(message);
    this.name = "OrbitDraftError";
  }
}

export function createInitialOrbitState(demoSessionId: string): OrbitState {
  return {
    demoSessionId,
    capabilityVersion: orbitCapabilities.version,
    draft: null,
    publication: "none",
  };
}

export const initialOrbitState: OrbitState = createInitialOrbitState("session-fixture");

const REQUIRED_SEMANTIC_KEYS = [
  "event.title",
  "event.schedule",
  "registration.capacity.maximum",
  "ticketing.mode",
] as const;

const payloadEnvelopeSchema = z.strictObject({
  contractId: z.string().min(1),
  contractRevision: z.number().int().min(1),
  capabilityVersion: z.string().min(1),
  previewHash: z.string().regex(/^[0-9a-f]{64}$/),
  values: z.record(z.string(), z.unknown()),
});

const scheduleValueSchema = z.strictObject({
  start: z.string().min(1),
  end: z.string().min(1),
  timezone: z.string().min(1),
});

function reject(code: OrbitRejectionCode, message: string): never {
  throw new OrbitDraftError(code, message);
}

function validateCapabilityValue(capability: ProviderCapability, value: unknown): void {
  const key = capability.semanticKey;
  switch (capability.valueType) {
    case "string":
      if (typeof value !== "string" || value.trim() === "") {
        reject("TARGET_REJECTED_DRAFT", `Value for ${key} must be a non-empty string`);
      }
      return;
    case "number":
      if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
        reject("TARGET_REJECTED_DRAFT", `Value for ${key} must be a positive number`);
      }
      return;
    case "boolean":
      if (typeof value !== "boolean") {
        reject("TARGET_REJECTED_DRAFT", `Value for ${key} must be a boolean`);
      }
      return;
    case "enum":
      if (!(capability.acceptedValues ?? []).some((accepted) => accepted === value)) {
        reject(
          "TARGET_REJECTED_DRAFT",
          `Value for ${key} must be one of: ${(capability.acceptedValues ?? []).join(", ")}`,
        );
      }
      return;
    case "duration": {
      if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
        reject("TARGET_REJECTED_DRAFT", `Value for ${key} must be a positive duration`);
      }
      if (capability.constraints?.wholeNumbersOnly === true && !Number.isInteger(value)) {
        reject(
          "TARGET_REJECTED_DRAFT",
          `Value for ${key} must be a whole number of ${String(capability.constraints?.unit ?? "units")}`,
        );
      }
      return;
    }
    case "datetime":
      if (!scheduleValueSchema.safeParse(value).success) {
        reject(
          "TARGET_REJECTED_DRAFT",
          `Value for ${key} must be a schedule with start, end, and timezone`,
        );
      }
      return;
  }
}

export function validateOrbitDraftPayload(input: unknown): OrbitDraftPayload {
  const envelope = payloadEnvelopeSchema.safeParse(input);
  if (!envelope.success) {
    reject("TARGET_REJECTED_DRAFT", "Draft payload does not match the required envelope shape");
  }
  const payload = envelope.data;

  const capabilitiesByKey = new Map(
    orbitCapabilities.capabilities.map((capability) => [capability.semanticKey, capability]),
  );
  for (const [key, value] of Object.entries(payload.values)) {
    if (orbitCapabilities.humanOnlyActions.some((action) => action === key)) {
      reject(
        "TARGET_REJECTED_DRAFT",
        `${key} is a human-only action; draft preparation cannot set publish state`,
      );
    }
    const capability = capabilitiesByKey.get(key);
    if (capability === undefined) {
      reject("TARGET_REJECTED_DRAFT", `Orbit does not declare a capability for "${key}"`);
    }
    validateCapabilityValue(capability, value);
  }
  for (const key of REQUIRED_SEMANTIC_KEYS) {
    if (!(key in payload.values)) {
      reject("TARGET_REJECTED_DRAFT", `Draft payload is missing the required field ${key}`);
    }
  }
  return payload as unknown as OrbitDraftPayload;
}

export function prepareOrbitDraft(
  state: OrbitState,
  input: unknown,
  now: string = new Date().toISOString(),
): OrbitState {
  const payload = validateOrbitDraftPayload(input);
  if (payload.capabilityVersion !== state.capabilityVersion) {
    reject(
      "CAPABILITY_VERSION_INVALID",
      `Draft targets capability version "${payload.capabilityVersion}" but Orbit is at "${state.capabilityVersion}"`,
    );
  }
  if (state.draft !== null && state.draft.previewHash === payload.previewHash) {
    const incoming = stableStringify({
      contractId: payload.contractId,
      contractRevision: payload.contractRevision,
      values: payload.values,
    });
    const existing = stableStringify({
      contractId: state.draft.contractId,
      contractRevision: state.draft.contractRevision,
      values: state.draft.values,
    });
    if (incoming === existing) {
      return state;
    }
    reject(
      "TARGET_REJECTED_DRAFT",
      `Preview hash ${payload.previewHash.slice(0, 12)}… is already bound to a different draft payload; a changed contract or resolution requires a fresh compatibility preview`,
    );
  }
  const revision = (state.draft?.revision ?? 0) + 1;
  const next: OrbitState = {
    ...state,
    draft: {
      draftId: `orbit-draft-${payload.previewHash.slice(0, 12)}`,
      revision,
      previewHash: payload.previewHash,
      contractId: payload.contractId,
      contractRevision: payload.contractRevision,
      values: structuredClone(payload.values) as OrbitDraftValues,
      receivedAt: now,
    },
    publication: "draft",
  };
  delete next.publishedAt;
  return next;
}

export function publishOrbitEvent(state: OrbitState, now: string): OrbitState {
  if (state.draft === null) {
    throw new Error("There is no listing draft to publish");
  }
  return { ...state, publication: "published", publishedAt: now };
}

export function reduceOrbit(state: OrbitState, action: OrbitAction): OrbitState {
  switch (action.type) {
    case "prepareDraft":
      return prepareOrbitDraft(state, action.payload, action.now);
    case "publishEvent":
      if (action.actor !== "human") {
        throw new Error("Publication is a human-only action");
      }
      return publishOrbitEvent(state, action.now);
  }
}
