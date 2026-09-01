import { describe, expect, it, vi } from "vitest";
import { toolSuccess } from "@intent-relay/protocol";
import type { DiscoveredTool, ModelContextPort } from "@intent-relay/webmcp";
import { FakeModelContext } from "@intent-relay/webmcp/testing";
import {
  createProviderBridge,
  REQUIRED_GATHER_TOOLS,
  REQUIRED_ORBIT_TOOLS,
} from "./providerBridge";

const ORIGINS = { gather: "http://localhost:4174", orbit: "http://localhost:4175" };

function addRemote(port: FakeModelContext, origin: string, name: string): void {
  port.addRemoteTool({ name, description: name, origin }, async () =>
    JSON.stringify(toolSuccess({})),
  );
}

describe("createProviderBridge", () => {
  it("starts in the connecting state before any discovery", () => {
    const bridge = createProviderBridge(new FakeModelContext("http://localhost:4173"), ORIGINS);
    expect(bridge.getInventory().gather.state).toBe("connecting");
    expect(bridge.getInventory().orbit.state).toBe("connecting");
    expect(bridge.getInventory().gather.origin).toBe(ORIGINS.gather);
  });

  it("reports disconnected providers after a discovery that finds no tools", async () => {
    const bridge = createProviderBridge(new FakeModelContext("http://localhost:4173"), ORIGINS);
    await bridge.refresh();
    expect(bridge.getInventory().gather.state).toBe("disconnected");
    expect(bridge.getInventory().orbit.state).toBe("disconnected");
  });

  it("reports connected and incomplete states from the required tool names", async () => {
    const port = new FakeModelContext("http://localhost:4173");
    for (const name of REQUIRED_GATHER_TOOLS) {
      addRemote(port, ORIGINS.gather, name);
    }
    addRemote(port, ORIGINS.orbit, "describe_event_capabilities");
    const bridge = createProviderBridge(port, ORIGINS);
    await bridge.refresh();

    const inventory = bridge.getInventory();
    expect(inventory.gather.state).toBe("connected");
    expect(inventory.gather.tools.map((tool) => tool.name).sort()).toEqual(
      [...REQUIRED_GATHER_TOOLS].sort(),
    );
    expect(inventory.orbit.state).toBe("incomplete");
    expect(inventory.orbit.missingTools.sort()).toEqual(
      ["prepare_event_draft", "read_event_draft"].sort(),
    );
  });

  it("rediscovers tools when the port emits toolchange", async () => {
    const port = new FakeModelContext("http://localhost:4173");
    const bridge = createProviderBridge(port, ORIGINS);
    const controller = new AbortController();
    bridge.start({ signal: controller.signal });
    for (const name of REQUIRED_ORBIT_TOOLS) {
      addRemote(port, ORIGINS.orbit, name);
    }
    await vi.waitFor(() => {
      expect(bridge.getInventory().orbit.state).toBe("connected");
    });
    controller.abort();
  });

  it("notifies subscribers when the inventory changes", async () => {
    const port = new FakeModelContext("http://localhost:4173");
    const bridge = createProviderBridge(port, ORIGINS);
    const listener = vi.fn();
    bridge.subscribe(listener);
    await bridge.refresh();
    expect(listener).toHaveBeenCalled();
  });

  it("stops rediscovering after the start signal aborts", async () => {
    const port = new FakeModelContext("http://localhost:4173");
    const bridge = createProviderBridge(port, ORIGINS);
    const controller = new AbortController();
    bridge.start({ signal: controller.signal });
    await vi.waitFor(() => {
      expect(bridge.getInventory().gather.state).toBe("disconnected");
    });
    controller.abort();
    for (const name of REQUIRED_GATHER_TOOLS) {
      addRemote(port, ORIGINS.gather, name);
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(bridge.getInventory().gather.state).toBe("disconnected");
  });

  it("fails closed when rediscovery rejects after a successful discovery", async () => {
    const fake = new FakeModelContext("http://localhost:4173");
    for (const name of REQUIRED_GATHER_TOOLS) {
      addRemote(fake, ORIGINS.gather, name);
    }
    let failDiscovery = false;
    const flakyPort: ModelContextPort = {
      registerTool: (tool, options) => fake.registerTool(tool, options),
      getTools: async (options) => {
        if (failDiscovery) {
          throw new Error("discovery channel lost");
        }
        return fake.getTools(options);
      },
      executeTool: (tool, input, options) => fake.executeTool(tool, input, options),
      addEventListener: (type, listener) => fake.addEventListener(type, listener),
      removeEventListener: (type, listener) => fake.removeEventListener(type, listener),
    };
    const bridge = createProviderBridge(flakyPort, ORIGINS);
    const listener = vi.fn();
    await bridge.refresh();
    expect(bridge.getInventory().gather.state).toBe("connected");

    bridge.subscribe(listener);
    failDiscovery = true;
    await expect(bridge.refresh()).resolves.toBeUndefined();
    expect(bridge.getInventory().gather.state).toBe("disconnected");
    expect(bridge.getInventory().gather.tools).toEqual([]);
    expect(bridge.getInventory().gather.missingTools).toEqual([...REQUIRED_GATHER_TOOLS]);
    expect(bridge.getInventory().orbit.state).toBe("disconnected");
    expect(listener).toHaveBeenCalled();
  });

  it("does nothing when started with an already-aborted signal", async () => {
    const port = new FakeModelContext("http://localhost:4173");
    const bridge = createProviderBridge(port, ORIGINS);
    const controller = new AbortController();
    controller.abort();
    bridge.start({ signal: controller.signal });
    for (const name of REQUIRED_GATHER_TOOLS) {
      addRemote(port, ORIGINS.gather, name);
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(bridge.getInventory().gather.state).toBe("connecting");
  });

  it("keeps browser platform tool objects out of the inventory while preserving execution handles", async () => {
    // Real Chrome DiscoveredTool objects carry extra platform properties,
    // including a cross-origin `window` reference that must never reach
    // React state (reading its properties throws SecurityError in dev).
    const port = new FakeModelContext("http://localhost:4173");
    const platformTool = {
      name: "read_event_state",
      description: "Gather state",
      origin: ORIGINS.gather,
      inputSchema: "{}",
      title: "read_event_state",
      annotations: {},
      window: { crossOriginMarker: true },
    } as DiscoveredTool;
    port.addRemoteTool(platformTool, async () => JSON.stringify(toolSuccess({})));
    const bridge = createProviderBridge(port, ORIGINS);
    await bridge.refresh();

    const stateTool = bridge.getInventory().gather.tools[0];
    expect(stateTool).toBeDefined();
    expect(Object.keys(stateTool ?? {}).sort()).toEqual([
      "description",
      "inputSchema",
      "name",
      "origin",
    ]);
    expect("window" in (stateTool ?? {})).toBe(false);

    const handle = bridge.toolNamed("gather", "read_event_state");
    expect(handle).toBeDefined();
    expect("window" in (handle ?? {})).toBe(true);
  });

  it("finds a discovered tool by provider and name", async () => {
    const port = new FakeModelContext("http://localhost:4173");
    for (const name of REQUIRED_GATHER_TOOLS) {
      addRemote(port, ORIGINS.gather, name);
    }
    const bridge = createProviderBridge(port, ORIGINS);
    await bridge.refresh();
    expect(bridge.toolNamed("gather", "read_setup_trace")?.origin).toBe(ORIGINS.gather);
    expect(bridge.toolNamed("orbit", "read_event_draft")).toBeUndefined();
  });
});
