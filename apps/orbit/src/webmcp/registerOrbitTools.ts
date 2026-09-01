import { orbitCapabilities } from "@intent-relay/fixtures";
import { toolFailure, toolSuccess } from "@intent-relay/protocol";
import {
  registerTypedTool,
  type ModelContextPort,
  type WebMCPToolDescriptor,
} from "@intent-relay/webmcp";
import type { OrbitStore } from "../domain/commands";
import { OrbitDraftError } from "../domain/reducer";

const EMPTY_INPUT_SCHEMA = {
  type: "object",
  properties: {},
  additionalProperties: false,
} as const;

export function orbitToolDescriptors(store: OrbitStore): WebMCPToolDescriptor[] {
  return [
    {
      name: "describe_event_capabilities",
      description:
        "Returns Orbit's versioned capability manifest: supported semantic keys, value constraints, transformations, unsupported keys, and human-only actions. Read-only.",
      inputSchema: { ...EMPTY_INPUT_SCHEMA },
      annotations: { readOnlyHint: true },
      execute: async () => {
        const state = store.getState();
        return JSON.stringify(
          toolSuccess({
            provider: "orbit",
            demoSessionId: state.demoSessionId,
            manifest: orbitCapabilities,
          }),
        );
      },
    },
    {
      name: "prepare_event_draft",
      description:
        "Atomically replaces Orbit's editable listing draft with a validated target payload produced from the current compatibility preview. Cannot publish or activate an event.",
      inputSchema: {
        type: "object",
        required: ["draft"],
        properties: {
          draft: {
            type: "object",
            description:
              "Target draft payload: contractId, contractRevision, capabilityVersion, previewHash, and values keyed by Orbit capability semantic keys.",
          },
        },
        additionalProperties: false,
      },
      execute: async (args) => {
        try {
          const state = store.dispatchOrbitCommand(
            { type: "prepareDraft", payload: args.draft as never },
            "agent",
          );
          const draft = state.draft;
          if (draft === null) {
            throw new Error("Draft preparation returned no draft");
          }
          return JSON.stringify(
            toolSuccess({
              draftId: draft.draftId,
              revision: draft.revision,
              publication: state.publication,
            }),
          );
        } catch (error) {
          if (error instanceof OrbitDraftError) {
            return JSON.stringify(toolFailure(error.code, error.message, true));
          }
          return JSON.stringify(
            toolFailure(
              "TARGET_REJECTED_DRAFT",
              error instanceof Error ? error.message : "Orbit rejected the draft payload",
              true,
            ),
          );
        }
      },
    },
    {
      name: "read_event_draft",
      description:
        "Returns Orbit's current visible listing draft and publication state. Read-only.",
      inputSchema: { ...EMPTY_INPUT_SCHEMA },
      annotations: { readOnlyHint: true },
      execute: async () => {
        const state = store.getState();
        return JSON.stringify(
          toolSuccess({
            provider: "orbit",
            demoSessionId: state.demoSessionId,
            draft: state.draft,
            publication: state.publication,
          }),
        );
      },
    },
  ];
}

/**
 * Registers Orbit's provider tools atomically: either all three tools end up
 * registered or none do, using an internal lifetime controller chained to the
 * caller's signal (same reliability contract as Gather's registration).
 */
export async function registerOrbitTools(
  port: ModelContextPort,
  relayOrigin: string,
  store: OrbitStore,
  options: { signal?: AbortSignal } = {},
): Promise<void> {
  if (options.signal?.aborted) {
    return;
  }
  const lifetime = new AbortController();
  const abortLifetime = (): void => {
    lifetime.abort();
  };
  options.signal?.addEventListener("abort", abortLifetime, { once: true });
  try {
    for (const descriptor of orbitToolDescriptors(store)) {
      await registerTypedTool(port, descriptor, {
        exposedTo: [relayOrigin],
        signal: lifetime.signal,
      });
    }
  } catch (error) {
    lifetime.abort();
    options.signal?.removeEventListener("abort", abortLifetime);
    throw error;
  }
}
