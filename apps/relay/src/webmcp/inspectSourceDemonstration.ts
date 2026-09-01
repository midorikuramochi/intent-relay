import type { SemanticTrace } from "@intent-relay/contracts";
import { toolFailure, toolSuccess, type ToolFailure } from "@intent-relay/protocol";
import type { ModelContextPort } from "@intent-relay/webmcp";
import type { ProviderBridge } from "../providers/providerBridge";
import type { RelayStore } from "../domain/storage";
import {
  cancelledFailure,
  executeProvider,
  isCancelled,
  readEventStateDataSchema,
  readSetupTraceDataSchema,
  type RelayToolHandler,
} from "./toolResults";

export interface SourceDemonstration {
  provider: "gather";
  eventState: unknown;
  trace: SemanticTrace;
}

export interface SourceDeps {
  port: ModelContextPort;
  bridge: ProviderBridge;
  store: RelayStore;
}

/**
 * Shared source read: executes Gather's two provider tools, validates both
 * envelopes at the trust boundary, and verifies session identity and trace /
 * event revision agreement. Both inspection and contract saving use this one
 * helper so freshness checks cannot drift apart.
 */
export async function readSourceDemonstration(
  deps: SourceDeps,
  signal: AbortSignal | undefined,
): Promise<{ ok: true; data: SourceDemonstration } | ToolFailure> {
  const stateResult = await executeProvider(
    deps,
    "gather",
    "read_event_state",
    {},
    signal,
    readEventStateDataSchema,
  );
  if (!("data" in stateResult)) {
    return stateResult;
  }
  if (isCancelled(signal)) {
    return cancelledFailure("inspect_source_demonstration");
  }
  const traceResult = await executeProvider(
    deps,
    "gather",
    "read_setup_trace",
    {},
    signal,
    readSetupTraceDataSchema,
  );
  if (!("data" in traceResult)) {
    return traceResult;
  }

  if (traceResult.data.trace.eventRevision !== stateResult.data.revision) {
    return toolFailure(
      "STALE_TRACE",
      "The Gather event changed between reading its state and its trace; inspect again",
      true,
    );
  }
  return {
    ok: true,
    data: {
      provider: "gather",
      eventState: stateResult.data.eventState,
      trace: traceResult.data.trace,
    },
  };
}

export function createInspectSourceDemonstration(deps: {
  port: ModelContextPort;
  bridge: ProviderBridge;
  store: RelayStore;
  setDemonstration: (demonstration: SourceDemonstration | null) => void;
}): RelayToolHandler {
  return async (_args, signal) => {
    if (isCancelled(signal)) {
      return cancelledFailure("inspect_source_demonstration");
    }
    deps.setDemonstration(null);
    const source = await readSourceDemonstration(deps, signal);
    if (!("data" in source)) {
      return source;
    }
    if (isCancelled(signal)) {
      return cancelledFailure("inspect_source_demonstration");
    }
    deps.setDemonstration(source.data);
    return toolSuccess(source.data);
  };
}
