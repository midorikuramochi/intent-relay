import {
  discoverProviderTools,
  type DiscoveredTool,
  type ModelContextPort,
} from "@intent-relay/webmcp";

export const REQUIRED_GATHER_TOOLS = ["read_event_state", "read_setup_trace"] as const;
export const REQUIRED_ORBIT_TOOLS = [
  "describe_event_capabilities",
  "prepare_event_draft",
  "read_event_draft",
] as const;

export type ProviderConnectionState = "connecting" | "connected" | "incomplete" | "disconnected";

export interface ProviderStatus {
  origin: string;
  state: ProviderConnectionState;
  tools: DiscoveredTool[];
  missingTools: string[];
}

export interface ProviderInventory {
  gather: ProviderStatus;
  orbit: ProviderStatus;
}

export interface ProviderBridge {
  getInventory(): ProviderInventory;
  subscribe(listener: () => void): () => void;
  refresh(): Promise<void>;
  start(options?: { signal?: AbortSignal }): void;
  toolNamed(provider: "gather" | "orbit", name: string): DiscoveredTool | undefined;
}

/**
 * Real browser DiscoveredTool objects are platform objects carrying extra
 * properties, including a cross-origin `window` reference. Only sanitized
 * plain clones may enter the inventory (and thus React state); the original
 * platform handles are kept separately because executeTool needs them.
 */
function sanitizeTool(tool: DiscoveredTool): DiscoveredTool {
  const clone: DiscoveredTool = {
    name: tool.name,
    description: tool.description,
    origin: tool.origin,
  };
  if (tool.inputSchema !== undefined) {
    clone.inputSchema = tool.inputSchema;
  }
  return clone;
}

function connectingStatus(origin: string, required: readonly string[]): ProviderStatus {
  return { origin, state: "connecting", tools: [], missingTools: [...required] };
}

function statusFrom(
  origin: string,
  tools: DiscoveredTool[],
  required: readonly string[],
): ProviderStatus {
  const names = new Set(tools.map((tool) => tool.name));
  const missingTools = required.filter((name) => !names.has(name));
  const state: ProviderConnectionState =
    tools.length === 0 ? "disconnected" : missingTools.length > 0 ? "incomplete" : "connected";
  return { origin, state, tools, missingTools };
}

export function createProviderBridge(
  port: ModelContextPort,
  origins: { gather: string; orbit: string },
): ProviderBridge {
  let inventory: ProviderInventory = {
    gather: connectingStatus(origins.gather, REQUIRED_GATHER_TOOLS),
    orbit: connectingStatus(origins.orbit, REQUIRED_ORBIT_TOOLS),
  };
  let handles: Record<"gather" | "orbit", Map<string, DiscoveredTool>> = {
    gather: new Map(),
    orbit: new Map(),
  };
  const listeners = new Set<() => void>();

  const refresh = async (): Promise<void> => {
    try {
      const discovered = await discoverProviderTools(port, origins);
      handles = {
        gather: new Map(discovered.gather.map((tool) => [tool.name, tool])),
        orbit: new Map(discovered.orbit.map((tool) => [tool.name, tool])),
      };
      inventory = {
        gather: statusFrom(
          origins.gather,
          discovered.gather.map(sanitizeTool),
          REQUIRED_GATHER_TOOLS,
        ),
        orbit: statusFrom(origins.orbit, discovered.orbit.map(sanitizeTool), REQUIRED_ORBIT_TOOLS),
      };
    } catch {
      handles = { gather: new Map(), orbit: new Map() };
      inventory = {
        gather: {
          origin: origins.gather,
          state: "disconnected",
          tools: [],
          missingTools: [...REQUIRED_GATHER_TOOLS],
        },
        orbit: {
          origin: origins.orbit,
          state: "disconnected",
          tools: [],
          missingTools: [...REQUIRED_ORBIT_TOOLS],
        },
      };
    }
    for (const listener of listeners) {
      listener();
    }
  };

  return {
    getInventory: () => inventory,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    refresh,
    start(options = {}) {
      if (options.signal?.aborted) {
        return;
      }
      const handleToolChange = (): void => {
        void refresh();
      };
      port.addEventListener("toolchange", handleToolChange);
      options.signal?.addEventListener(
        "abort",
        () => {
          port.removeEventListener("toolchange", handleToolChange);
        },
        { once: true },
      );
      void refresh();
    },
    toolNamed(provider, name) {
      return handles[provider].get(name);
    },
  };
}
