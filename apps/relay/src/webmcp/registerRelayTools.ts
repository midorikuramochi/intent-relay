import type { SemanticTrace } from "@intent-relay/contracts";
import { toolFailure } from "@intent-relay/protocol";
import { registerTypedTool, type ModelContextPort } from "@intent-relay/webmcp";
import type { RelayStore } from "../domain/storage";
import type { RelayState } from "../domain/types";
import type { ProviderBridge } from "../providers/providerBridge";
import {
  createInspectSourceDemonstration,
  type SourceDemonstration,
} from "./inspectSourceDemonstration";
import { createSaveIntentContractDraft } from "./saveIntentContractDraft";
import { createInspectTargetCompatibility } from "./inspectTargetCompatibility";
import { createPrepareTargetDraft } from "./prepareTargetDraft";
import { createGetTransferReview } from "./getTransferReview";
import { envelope, type RelayToolHandler } from "./toolResults";

export interface RelayToolView {
  gatherConnected: boolean;
  orbitConnected: boolean;
  trace: SemanticTrace | null;
  state: RelayState;
}

const EMPTY_INPUT_SCHEMA = {
  type: "object",
  properties: {},
  additionalProperties: false,
} as const;

interface RelayToolMeta {
  description: string;
  inputSchema: {
    type: "object";
    required?: string[];
    properties: Record<string, unknown>;
    additionalProperties: false;
  };
  annotations?: { readOnlyHint: boolean };
}

export const RELAY_TOOL_ORDER = [
  "inspect_source_demonstration",
  "save_intent_contract_draft",
  "inspect_target_compatibility",
  "prepare_target_draft",
  "get_transfer_review",
] as const;

export type RelayToolName = (typeof RELAY_TOOL_ORDER)[number];

export const RELAY_TOOL_META: Record<RelayToolName, RelayToolMeta> = {
  inspect_source_demonstration: {
    description:
      "Retrieves the visible Gather event state and its completed semantic setup trace. Use after the user finishes demonstrating the source workflow. Read-only.",
    inputSchema: { ...EMPTY_INPUT_SCHEMA, properties: {} },
    annotations: { readOnlyHint: true },
  },
  save_intent_contract_draft: {
    description:
      "Validates and saves an agent-proposed version 0.1 Intent Contract draft derived from the current Gather trace. Every rule must cite source action IDs. The contract stays a draft until the human approves it in the Workbench.",
    inputSchema: {
      type: "object",
      required: ["contract"],
      properties: {
        contract: {
          type: "object",
          description:
            "A version 0.1 event Intent Contract. Every rule must cite source action IDs from the current trace.",
        },
      },
      additionalProperties: false,
    },
  },
  inspect_target_compatibility: {
    description:
      "Discovers Orbit's declared capabilities and computes a deterministic compatibility preview for the human-approved contract. Surfaces direct, transformed, unsupported, and needs_decision statuses; the human resolves decisions in the Workbench.",
    inputSchema: {
      type: "object",
      required: ["contractId"],
      properties: { contractId: { type: "string" } },
      additionalProperties: false,
    },
  },
  prepare_target_draft: {
    description:
      "Prepares an editable Orbit listing draft from the current preview after the human has resolved every needs_decision entry. Never publishes or activates the event.",
    inputSchema: {
      type: "object",
      required: ["contractId", "previewHash"],
      properties: {
        contractId: { type: "string" },
        previewHash: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  get_transfer_review: {
    description:
      "Returns the current semantic transfer review: preserved, transformed, unsupported, and human-decided outcomes plus the Orbit draft and publication state. Read-only.",
    inputSchema: { ...EMPTY_INPUT_SCHEMA, properties: {} },
    annotations: { readOnlyHint: true },
  },
};

export function relayToolNamesFor(view: RelayToolView): RelayToolName[] {
  const available = new Set<RelayToolName>();
  if (view.gatherConnected) {
    available.add("inspect_source_demonstration");
  }
  if (view.trace !== null && view.trace.completed && view.trace.actions.length > 0) {
    available.add("save_intent_contract_draft");
  }
  if (view.orbitConnected && view.state.activeContract?.status === "approved") {
    available.add("inspect_target_compatibility");
  }
  if (view.state.preview !== null) {
    available.add("prepare_target_draft");
  }
  if (view.state.targetDraft !== null) {
    available.add("get_transfer_review");
  }
  return RELAY_TOOL_ORDER.filter((name) => available.has(name));
}

export interface RelayOrchestrator {
  invokeTool(name: string, input: unknown, signal?: AbortSignal): Promise<string>;
  toolNames(): string[];
  registeredNames(): string[];
  getLastDemonstration(): SourceDemonstration | null;
  subscribe(listener: () => void): () => void;
  start(options?: { signal?: AbortSignal }): void;
}

export function createRelayOrchestrator(deps: {
  port: ModelContextPort;
  bridge: ProviderBridge;
  store: RelayStore;
  now?: () => string;
}): RelayOrchestrator {
  const now = deps.now ?? (() => new Date().toISOString());
  let lastDemonstration: SourceDemonstration | null = null;
  let lastSessionId = deps.store.getState().demoSessionId;
  const listeners = new Set<() => void>();
  const registered = new Map<RelayToolName, AbortController>();
  let lifetime: AbortSignal | undefined;
  let started = false;
  let unsubscribeStore: (() => void) | null = null;
  let unsubscribeBridge: (() => void) | null = null;

  const notify = (): void => {
    for (const listener of listeners) {
      listener();
    }
  };

  const handlers: Record<string, RelayToolHandler> = {
    inspect_source_demonstration: createInspectSourceDemonstration({
      port: deps.port,
      bridge: deps.bridge,
      store: deps.store,
      setDemonstration: (demonstration) => {
        lastDemonstration = demonstration;
        if (started) {
          sync();
        } else {
          notify();
        }
      },
    }),
    save_intent_contract_draft: createSaveIntentContractDraft({
      port: deps.port,
      bridge: deps.bridge,
      store: deps.store,
      getTrace: () => lastDemonstration?.trace ?? null,
      invalidateDemonstration: () => {
        lastDemonstration = null;
        if (started) {
          sync();
        } else {
          notify();
        }
      },
    }),
    inspect_target_compatibility: createInspectTargetCompatibility({
      port: deps.port,
      bridge: deps.bridge,
      store: deps.store,
      now,
    }),
    prepare_target_draft: createPrepareTargetDraft({
      port: deps.port,
      bridge: deps.bridge,
      store: deps.store,
    }),
    get_transfer_review: createGetTransferReview({
      port: deps.port,
      bridge: deps.bridge,
      store: deps.store,
    }),
  };

  const view = (): RelayToolView => ({
    gatherConnected: deps.bridge.getInventory().gather.state === "connected",
    orbitConnected: deps.bridge.getInventory().orbit.state === "connected",
    trace: lastDemonstration?.trace ?? null,
    state: deps.store.getState(),
  });

  const invokeTool = async (
    name: string,
    input: unknown,
    signal?: AbortSignal,
  ): Promise<string> => {
    const handler = handlers[name];
    if (handler === undefined) {
      return envelope(
        toolFailure("INVALID_TOOL_RESPONSE", `Relay has no tool named "${name}"`, false),
      );
    }
    const args =
      input !== null && typeof input === "object" && !Array.isArray(input)
        ? (input as Record<string, unknown>)
        : {};
    return envelope(await handler(args, signal));
  };

  const sync = (): void => {
    if (!started) {
      return;
    }
    const sessionId = deps.store.getState().demoSessionId;
    if (sessionId !== lastSessionId) {
      lastSessionId = sessionId;
      lastDemonstration = null;
    }
    const desired = new Set(relayToolNamesFor(view()));
    for (const [name, controller] of registered) {
      if (!desired.has(name)) {
        controller.abort();
        registered.delete(name);
      }
    }
    for (const name of desired) {
      if (registered.has(name)) {
        continue;
      }
      const controller = new AbortController();
      lifetime?.addEventListener("abort", () => controller.abort(), { once: true });
      registered.set(name, controller);
      const meta = RELAY_TOOL_META[name];
      registerTypedTool(
        deps.port,
        {
          name,
          description: meta.description,
          inputSchema: meta.inputSchema,
          ...(meta.annotations !== undefined ? { annotations: meta.annotations } : {}),
          execute: (args, context) => invokeTool(name, args, context?.signal),
        },
        { signal: controller.signal },
      ).catch(() => {
        registered.delete(name);
      });
    }
    notify();
  };

  return {
    invokeTool,
    toolNames: () => relayToolNamesFor(view()),
    registeredNames: () => [...registered.keys()],
    getLastDemonstration: () => lastDemonstration,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    start(options = {}) {
      if (started || options.signal?.aborted) {
        return;
      }
      started = true;
      lifetime = options.signal;
      unsubscribeStore = deps.store.subscribe(sync);
      unsubscribeBridge = deps.bridge.subscribe(sync);
      options.signal?.addEventListener(
        "abort",
        () => {
          started = false;
          lifetime = undefined;
          unsubscribeStore?.();
          unsubscribeBridge?.();
          unsubscribeStore = null;
          unsubscribeBridge = null;
          for (const [name, controller] of registered) {
            controller.abort();
            registered.delete(name);
          }
          notify();
        },
        { once: true },
      );
      sync();
    },
  };
}
