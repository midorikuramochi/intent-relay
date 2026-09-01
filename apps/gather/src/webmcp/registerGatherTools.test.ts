import { describe, expect, it } from "vitest";
import { executeJsonTool, type DiscoveredTool, type ModelContextPort } from "@intent-relay/webmcp";
import { FakeModelContext } from "@intent-relay/webmcp/testing";
import { createGatherStore, type GatherStore } from "../domain/commands";
import { registerGatherTools } from "./registerGatherTools";

const RELAY_ORIGIN = "http://localhost:4173";
const GATHER_ORIGIN = "http://localhost:4174";

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

async function setup(): Promise<{
  port: FakeModelContext;
  store: GatherStore;
  controller: AbortController;
  toolNamed: (name: string) => Promise<DiscoveredTool>;
}> {
  const port = new FakeModelContext(GATHER_ORIGIN);
  const store = createGatherStore({
    demoSessionId: "session-tools-01",
    storage: new MemoryStorage(),
  });
  const controller = new AbortController();
  await registerGatherTools(port, RELAY_ORIGIN, store.getState, { signal: controller.signal });
  const toolNamed = async (name: string): Promise<DiscoveredTool> => {
    const tool = (await port.getTools()).find((candidate) => candidate.name === name);
    if (tool === undefined) {
      throw new Error(`Tool ${name} is not registered`);
    }
    return tool;
  };
  return { port, store, controller, toolNamed };
}

describe("registerGatherTools", () => {
  it("registers exactly the two read-only Gather tools exposed to Relay", async () => {
    const { port } = await setup();
    const tools = await port.getTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual(["read_event_state", "read_setup_trace"]);
    for (const name of ["read_event_state", "read_setup_trace"]) {
      expect(port.registrationOptionsFor(name)?.exposedTo).toEqual([RELAY_ORIGIN]);
    }
    expect(tools.some((tool) => tool.name.includes("publish"))).toBe(false);
  });

  it("returns the live visible event state through read_event_state", async () => {
    const { port, store, toolNamed } = await setup();
    store.dispatchGatherCommand({ type: "setCapacity", value: 100 }, "human");
    const result = await executeJsonTool(port, await toolNamed("read_event_state"), {});
    expect(result.ok).toBe(true);
    if (result.ok) {
      const data = result.data as {
        provider: string;
        demoSessionId: string;
        eventState: { capacity: number | null; revision: number };
        completed: boolean;
      };
      expect(data.provider).toBe("gather");
      expect(data.demoSessionId).toBe("session-tools-01");
      expect(data.eventState.capacity).toBe(100);
      expect(data.eventState.revision).toBe(1);
      expect(data.completed).toBe(false);
    }
  });

  it("fails with TRACE_EMPTY before the demonstration is completed", async () => {
    const { port, store, toolNamed } = await setup();
    store.dispatchGatherCommand({ type: "setCapacity", value: 100 }, "human");
    const result = await executeJsonTool(port, await toolNamed("read_setup_trace"), {});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("TRACE_EMPTY");
    }
  });

  it("fails with TRACE_EMPTY when completed without any semantic action", async () => {
    const { port, store, toolNamed } = await setup();
    store.dispatchGatherCommand({ type: "completeDemonstration" }, "human");
    const result = await executeJsonTool(port, await toolNamed("read_setup_trace"), {});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("TRACE_EMPTY");
    }
  });

  it("returns the completed semantic trace through read_setup_trace", async () => {
    const { port, store, toolNamed } = await setup();
    store.dispatchGatherCommand({ type: "setCapacity", value: 100 }, "human");
    store.dispatchGatherCommand({ type: "completeDemonstration" }, "human");
    const result = await executeJsonTool(port, await toolNamed("read_setup_trace"), {});
    expect(result.ok).toBe(true);
    if (result.ok) {
      const data = result.data as {
        provider: string;
        trace: { completed: boolean; eventRevision: number; actions: unknown[] };
      };
      expect(data.provider).toBe("gather");
      expect(data.trace.completed).toBe(true);
      expect(data.trace.eventRevision).toBe(1);
      expect(data.trace.actions).toHaveLength(1);
    }
  });

  it("rolls back the first tool when the second registration fails", async () => {
    const port = new FakeModelContext(GATHER_ORIGIN);
    const store = createGatherStore({
      demoSessionId: "session-rollback-1",
      storage: new MemoryStorage(),
    });
    const failingPort: ModelContextPort = {
      registerTool: async (tool, options) => {
        if (tool.name === "read_setup_trace") {
          throw new Error("registration denied by the browser");
        }
        return port.registerTool(tool, options);
      },
      getTools: (options) => port.getTools(options),
      executeTool: (tool, input, options) => port.executeTool(tool, input, options),
      addEventListener: (type, listener) => port.addEventListener(type, listener),
      removeEventListener: (type, listener) => port.removeEventListener(type, listener),
    };

    await expect(
      registerGatherTools(failingPort, RELAY_ORIGIN, store.getState, {}),
    ).rejects.toThrow(/registration denied/);
    expect(await port.getTools()).toEqual([]);
  });

  it("unregisters both tools when the registration signal aborts", async () => {
    const { port, controller } = await setup();
    controller.abort();
    expect(await port.getTools()).toEqual([]);
  });
});
