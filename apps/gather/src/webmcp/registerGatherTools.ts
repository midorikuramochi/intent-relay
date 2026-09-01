import { toolFailure, toolSuccess } from "@intent-relay/protocol";
import {
  registerTypedTool,
  type ModelContextPort,
  type WebMCPToolDescriptor,
} from "@intent-relay/webmcp";
import type { GatherState } from "../domain/types";

const EMPTY_INPUT_SCHEMA = {
  type: "object",
  properties: {},
  additionalProperties: false,
} as const;

export function gatherToolDescriptors(getState: () => GatherState): WebMCPToolDescriptor[] {
  return [
    {
      name: "read_event_state",
      description:
        "Returns the current visible Gather event draft, its revision, and whether the user has marked the demonstration complete. Read-only.",
      inputSchema: { ...EMPTY_INPUT_SCHEMA },
      annotations: { readOnlyHint: true },
      execute: async () => {
        const state = getState();
        return JSON.stringify(
          toolSuccess({
            provider: "gather",
            demoSessionId: state.demoSessionId,
            eventState: state.event,
            revision: state.event.revision,
            completed: state.trace.completed,
          }),
        );
      },
    },
    {
      name: "read_setup_trace",
      description:
        "Returns the semantic setup trace in chronological order once the user has completed a non-empty demonstration. Read-only.",
      inputSchema: { ...EMPTY_INPUT_SCHEMA },
      annotations: { readOnlyHint: true },
      execute: async () => {
        const state = getState();
        if (!state.trace.completed || state.trace.actions.length === 0) {
          return JSON.stringify(
            toolFailure(
              "TRACE_EMPTY",
              "The demonstration has not been completed with at least one semantic action yet",
              true,
            ),
          );
        }
        return JSON.stringify(
          toolSuccess({
            provider: "gather",
            demoSessionId: state.demoSessionId,
            trace: state.trace,
          }),
        );
      },
    },
  ];
}

/**
 * Registers Gather's provider tools atomically: either both tools end up
 * registered or none do. Registrations are bound to an internal lifetime
 * controller chained to the caller's signal, so a failure part-way through
 * rolls back every tool this call already registered, and a caller abort
 * after success still unregisters both.
 */
export async function registerGatherTools(
  port: ModelContextPort,
  relayOrigin: string,
  getState: () => GatherState,
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
    for (const descriptor of gatherToolDescriptors(getState)) {
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
