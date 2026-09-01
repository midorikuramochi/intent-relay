import { intentContractDraftInputSchema } from "@intent-relay/contracts";
import { z } from "zod";
import { createInitialRelayState, reduceRelay } from "./reducer";
import type { RelayCommand, RelayState } from "./types";

const CURRENT_SESSION_KEY = "intent-relay:relay:currentSession";
const SESSION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9-]{7,63}$/;

export function generateDemoSessionId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `session-${hex}`;
}

export function rotateDemoSession(storage: Storage): string {
  const sessionId = generateDemoSessionId();
  storage.setItem(CURRENT_SESSION_KEY, sessionId);
  return sessionId;
}

export function ensureDemoSession(storage: Storage): string {
  const existing = storage.getItem(CURRENT_SESSION_KEY);
  if (existing !== null && SESSION_ID_PATTERN.test(existing)) {
    return existing;
  }
  return rotateDemoSession(storage);
}

export function storageKeyFor(demoSessionId: string): string {
  return `intent-relay:relay:${demoSessionId}:state`;
}

const mappingEntrySchema = z.strictObject({
  ruleId: z.string().min(1),
  status: z.enum(["direct", "transformed", "unsupported", "needs_decision"]),
  targetCapability: z.string().min(1).optional(),
  proposedValue: z.unknown().optional(),
  transformation: z
    .strictObject({ id: z.string().min(1), explanation: z.string().min(1) })
    .optional(),
  reason: z.string().min(1).optional(),
  alternatives: z
    .array(
      z.strictObject({
        id: z.string().min(1),
        label: z.string().min(1),
        consequence: z.string().min(1),
      }),
    )
    .optional(),
});

const previewSchema = z.strictObject({
  contractId: z.string().min(1),
  contractRevision: z.number().int().positive(),
  targetProvider: z.literal("orbit"),
  targetCapabilityVersion: z.string().min(1),
  mappings: z.array(mappingEntrySchema),
  previewHash: z.string().regex(/^[0-9a-f]{64}$/),
  createdAt: z.string().min(1),
});

const persistedRelayStateSchema = z.strictObject({
  demoSessionId: z.string().min(1),
  step: z.enum(["demonstrate", "verify_contract", "transfer", "review"]),
  contracts: z.array(intentContractDraftInputSchema),
  activeContract: intentContractDraftInputSchema.nullable(),
  preview: previewSchema.nullable(),
  resolutions: z.array(
    z.strictObject({
      ruleId: z.string().min(1),
      alternativeId: z.string().min(1),
      resolvedAt: z.string().min(1),
    }),
  ),
  targetDraft: z
    .strictObject({
      draftId: z.string().min(1),
      revision: z.number().int().positive(),
      publication: z.string().min(1),
    })
    .nullable(),
});

export function loadRelayState(storage: Storage, demoSessionId: string): RelayState | null {
  const raw = storage.getItem(storageKeyFor(demoSessionId));
  if (raw === null) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const result = persistedRelayStateSchema.safeParse(parsed);
  if (!result.success || result.data.demoSessionId !== demoSessionId) {
    return null;
  }
  return result.data as RelayState;
}

export function saveRelayState(storage: Storage, state: RelayState): void {
  storage.setItem(storageKeyFor(state.demoSessionId), JSON.stringify(state));
}

export interface RelayStore {
  getState(): RelayState;
  subscribe(listener: () => void): () => void;
  dispatch(command: RelayCommand): RelayState;
  resetDemo(): RelayState;
}

export function createRelayStore(options: { storage: Storage }): RelayStore {
  const sessionId = ensureDemoSession(options.storage);
  let state = loadRelayState(options.storage, sessionId) ?? createInitialRelayState(sessionId);
  const listeners = new Set<() => void>();
  const dispatch = (command: RelayCommand): RelayState => {
    state = reduceRelay(state, command);
    saveRelayState(options.storage, state);
    for (const listener of listeners) {
      listener();
    }
    return state;
  };
  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispatch,
    resetDemo() {
      const nextSession = rotateDemoSession(options.storage);
      return dispatch({ type: "resetDemo", sessionId: nextSession });
    },
  };
}
