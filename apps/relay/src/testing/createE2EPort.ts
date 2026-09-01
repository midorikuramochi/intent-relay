import type { IntentContract } from "@intent-relay/contracts";
import { proposedStudentAiWorkshopContract } from "@intent-relay/fixtures";
import type { DiscoveredTool, ModelContextPort } from "@intent-relay/webmcp";
import { FakeModelContext } from "@intent-relay/webmcp/testing";
import {
  createGatherStore,
  sampleDemonstrationCommands,
  type GatherStore,
} from "@intent-relay/gather/src/domain/commands";
import { registerGatherTools } from "@intent-relay/gather/src/webmcp/registerGatherTools";
import { createOrbitStore, type OrbitStore } from "@intent-relay/orbit/src/domain/commands";
import { registerOrbitTools } from "@intent-relay/orbit/src/webmcp/registerOrbitTools";
import type { RelayStore } from "../domain/storage";

if (import.meta.env.PROD) {
  throw new Error("The E2E test adapter must never be part of a production build");
}

class MemoryStorage implements Storage {
  private readonly entries = new Map<string, string>();

  get length(): number {
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
  }

  getItem(key: string): string | null {
    return this.entries.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.entries.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.entries.delete(key);
  }

  setItem(key: string, value: string): void {
    this.entries.set(key, value);
  }
}

export interface E2EHarness {
  port: ModelContextPort;
  /** Keeps the in-page provider stores bound to Relay's current demo session. */
  attach(store: RelayStore): void;
  /** The "Load sample demonstration" control drives this human replay. */
  seedSampleDemonstration(): void;
  /** Canonical proposal remapped onto the live trace so provenance validates. */
  buildProposedContract(): IntentContract;
  /** Unsubscribes, aborts provider registrations, and unmounts remote tools. */
  dispose(): void;
}

/**
 * Deterministic in-page ModelContextPort for Playwright. Providers are the
 * REAL Gather and Orbit domain stores and tool registrations, mounted onto a
 * fake transport; Relay's orchestrator, reducer, and tools run unchanged.
 * This adapter is not evidence of real cross-origin WebMCP behavior.
 */
export function createE2EHarness(origins: {
  relay: string;
  gather: string;
  orbit: string;
}): E2EHarness {
  const relayPort = new FakeModelContext(origins.relay);
  let gatherStore: GatherStore | null = null;
  let orbitStore: OrbitStore | null = null;
  let providerLifetime: AbortController | null = null;
  let mountedTools: DiscoveredTool[] = [];
  let currentSession: string | null = null;
  let unsubscribe: (() => void) | null = null;
  let disposed = false;

  const mountProvider = async (providerPort: FakeModelContext): Promise<void> => {
    for (const tool of await providerPort.getTools()) {
      relayPort.addRemoteTool({ ...tool }, (input, signal) =>
        providerPort.executeTool(tool, input, { signal }),
      );
      mountedTools.push(tool);
    }
  };

  const rebuildProviders = async (demoSessionId: string): Promise<void> => {
    if (disposed) {
      return;
    }
    providerLifetime?.abort();
    providerLifetime = new AbortController();
    for (const tool of mountedTools) {
      relayPort.removeRemoteTool(tool.origin, tool.name);
    }
    mountedTools = [];

    gatherStore = createGatherStore({ demoSessionId, storage: new MemoryStorage() });
    orbitStore = createOrbitStore({ demoSessionId, storage: new MemoryStorage() });

    const gatherPort = new FakeModelContext(origins.gather);
    await registerGatherTools(gatherPort, origins.relay, gatherStore.getState, {
      signal: providerLifetime.signal,
    });
    await mountProvider(gatherPort);

    const orbitPort = new FakeModelContext(origins.orbit);
    await registerOrbitTools(orbitPort, origins.relay, orbitStore, {
      signal: providerLifetime.signal,
    });
    await mountProvider(orbitPort);
  };

  return {
    port: relayPort,
    attach(store) {
      if (disposed) {
        throw new Error("E2E harness is disposed");
      }
      unsubscribe?.();
      const sync = (): void => {
        const sessionId = store.getState().demoSessionId;
        if (sessionId !== currentSession) {
          currentSession = sessionId;
          void rebuildProviders(sessionId);
        }
      };
      unsubscribe = store.subscribe(sync);
      sync();
    },
    dispose() {
      disposed = true;
      unsubscribe?.();
      unsubscribe = null;
      providerLifetime?.abort();
      providerLifetime = null;
      for (const tool of mountedTools) {
        relayPort.removeRemoteTool(tool.origin, tool.name);
      }
      mountedTools = [];
      gatherStore = null;
      orbitStore = null;
    },
    seedSampleDemonstration() {
      if (disposed) {
        throw new Error("E2E harness is disposed");
      }
      if (gatherStore === null) {
        throw new Error("E2E harness is not attached to the Relay store yet");
      }
      for (const command of sampleDemonstrationCommands()) {
        gatherStore.dispatchGatherCommand(command, "human");
      }
      gatherStore.dispatchGatherCommand({ type: "completeDemonstration" }, "human");
    },
    buildProposedContract() {
      if (gatherStore === null) {
        throw new Error("E2E harness is not attached to the Relay store yet");
      }
      const trace = gatherStore.getState().trace;
      return {
        ...structuredClone(proposedStudentAiWorkshopContract),
        id: "contract-e2e-1",
        source: {
          provider: "gather",
          traceId: trace.id,
          capturedAt: new Date().toISOString(),
        },
        rules: proposedStudentAiWorkshopContract.rules.map((rule) => {
          const supporting = trace.actions.find(
            (action) => action.semanticKey === rule.semanticKey,
          );
          return { ...structuredClone(rule), provenance: [supporting?.id ?? "missing"] };
        }),
      };
    },
  };
}
