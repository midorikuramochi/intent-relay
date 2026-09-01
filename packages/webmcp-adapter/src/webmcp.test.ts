import { describe, expect, it, vi } from "vitest";
import { toolFailure, toolSuccess } from "@intent-relay/protocol";
import { getBrowserModelContextPort } from "./modelContext";
import type { WebMCPToolDescriptor } from "./modelContext";
import { assertProductionBuildEnv, readOriginConfig } from "./origins";
import { registerTypedTool } from "./registerTool";
import { discoverProviderTools } from "./discoverTools";
import { executeJsonTool } from "./executeTool";
import { FakeModelContext } from "./fakeModelContext";

const validEnv = {
  VITE_RELAY_ORIGIN: "http://localhost:4173",
  VITE_GATHER_ORIGIN: "http://localhost:4174",
  VITE_ORBIT_ORIGIN: "http://localhost:4175",
};

const sampleTool: WebMCPToolDescriptor = {
  name: "read_event_state",
  description: "Returns the current visible event draft.",
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
  execute: async () => JSON.stringify(toolSuccess({ ready: true })),
};

describe("readOriginConfig", () => {
  it("rejects a wildcard provider origin", () => {
    expect(() =>
      readOriginConfig({
        VITE_RELAY_ORIGIN: "https://relay.example",
        VITE_GATHER_ORIGIN: "*",
        VITE_ORBIT_ORIGIN: "https://orbit.example",
      }),
    ).toThrow("Exact Gather origin required");
  });

  it("rejects an insecure non-localhost origin", () => {
    expect(() =>
      readOriginConfig({
        VITE_RELAY_ORIGIN: "https://relay.example",
        VITE_GATHER_ORIGIN: "https://gather.example",
        VITE_ORBIT_ORIGIN: "http://orbit.example",
      }),
    ).toThrow("Exact Orbit origin required");
  });

  it("rejects an origin that carries a path", () => {
    expect(() =>
      readOriginConfig({
        VITE_RELAY_ORIGIN: "https://relay.example/workbench",
        VITE_GATHER_ORIGIN: "https://gather.example",
        VITE_ORBIT_ORIGIN: "https://orbit.example",
      }),
    ).toThrow("Exact Relay origin required");
  });

  it("rejects a missing origin variable", () => {
    expect(() =>
      readOriginConfig({
        VITE_RELAY_ORIGIN: "https://relay.example",
        VITE_ORBIT_ORIGIN: "https://orbit.example",
      }),
    ).toThrow("Exact Gather origin required");
  });

  it("rejects duplicate origins", () => {
    expect(() =>
      readOriginConfig({
        VITE_RELAY_ORIGIN: "https://relay.example",
        VITE_GATHER_ORIGIN: "https://gather.example",
        VITE_ORBIT_ORIGIN: "https://gather.example",
      }),
    ).toThrow(/distinct/i);
  });

  it("accepts exact localhost development origins", () => {
    expect(readOriginConfig(validEnv)).toEqual({
      relay: "http://localhost:4173",
      gather: "http://localhost:4174",
      orbit: "http://localhost:4175",
    });
  });
});

describe("assertProductionBuildEnv", () => {
  it("rejects a production build with the test adapter variable set", () => {
    expect(() => assertProductionBuildEnv({ VITE_E2E_MODE: "1" })).toThrow(/VITE_E2E_MODE/);
  });

  it("rejects a partially configured origin set", () => {
    expect(() => assertProductionBuildEnv({ VITE_RELAY_ORIGIN: "https://relay.example" })).toThrow(
      /Exact Gather origin required/,
    );
  });

  it("rejects wildcard, duplicate, and insecure origins", () => {
    expect(() =>
      assertProductionBuildEnv({
        VITE_RELAY_ORIGIN: "https://relay.example",
        VITE_GATHER_ORIGIN: "*",
        VITE_ORBIT_ORIGIN: "https://orbit.example",
      }),
    ).toThrow(/wildcard/i);
    expect(() =>
      assertProductionBuildEnv({
        VITE_RELAY_ORIGIN: "https://relay.example",
        VITE_GATHER_ORIGIN: "https://relay.example",
        VITE_ORBIT_ORIGIN: "https://orbit.example",
      }),
    ).toThrow(/distinct/i);
    expect(() =>
      assertProductionBuildEnv({
        VITE_RELAY_ORIGIN: "https://relay.example",
        VITE_GATHER_ORIGIN: "https://gather.example",
        VITE_ORBIT_ORIGIN: "http://orbit.example",
      }),
    ).toThrow(/Exact Orbit origin required/);
  });

  it("accepts a complete exact production configuration", () => {
    expect(() =>
      assertProductionBuildEnv({
        VITE_RELAY_ORIGIN: "https://relay.example",
        VITE_GATHER_ORIGIN: "https://gather.example",
        VITE_ORBIT_ORIGIN: "https://orbit.example",
      }),
    ).not.toThrow();
  });

  it("permits an unconfigured artifact build and defers to the runtime startup guard", () => {
    expect(() => assertProductionBuildEnv({})).not.toThrow();
  });
});

describe("registerTypedTool", () => {
  it("unregisters a tool when its AbortController is aborted", async () => {
    const port = new FakeModelContext();
    const controller = new AbortController();
    await registerTypedTool(port, sampleTool, { signal: controller.signal });
    controller.abort();
    expect(await port.getTools()).toEqual([]);
  });

  it("does not register a tool for an already-aborted signal", async () => {
    const port = new FakeModelContext();
    const controller = new AbortController();
    controller.abort();
    await registerTypedTool(port, sampleTool, { signal: controller.signal });
    expect(await port.getTools()).toEqual([]);
  });

  it("registers with the provided origin exposure", async () => {
    const port = new FakeModelContext();
    await registerTypedTool(port, sampleTool, { exposedTo: ["http://localhost:4173"] });
    expect(port.registrationOptionsFor("read_event_state")?.exposedTo).toEqual([
      "http://localhost:4173",
    ]);
  });

  it("rejects an invalid tool name", async () => {
    const port = new FakeModelContext();
    await expect(
      registerTypedTool(port, { ...sampleTool, name: "Read Event!" }, {}),
    ).rejects.toThrow(/tool name/i);
  });

  it("emits toolchange when the registered tool set changes", async () => {
    const port = new FakeModelContext();
    const listener = vi.fn();
    port.addEventListener("toolchange", listener);
    const controller = new AbortController();
    await registerTypedTool(port, sampleTool, { signal: controller.signal });
    controller.abort();
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe("producer-side registration boundary", () => {
  it("invokes a registered execute callback with parsed arguments, not a JSON string", async () => {
    const port = new FakeModelContext("http://localhost:4174");
    const receivedArgs: unknown[] = [];
    await registerTypedTool(port, {
      ...sampleTool,
      execute: async (args) => {
        receivedArgs.push(args);
        return JSON.stringify(toolSuccess({}));
      },
    });
    const [tool] = await port.getTools();
    await port.executeTool(tool!, JSON.stringify({ include: "trace" }));
    expect(receivedArgs).toEqual([{ include: "trace" }]);
    expect(typeof receivedArgs[0]).toBe("object");
  });

  it("exposes a discovered tool's inputSchema as serialized JSON text", async () => {
    const port = new FakeModelContext("http://localhost:4174");
    await registerTypedTool(port, sampleTool);
    const [tool] = await port.getTools();
    expect(tool?.inputSchema).toBe(JSON.stringify(sampleTool.inputSchema));
  });
});

describe("discoverProviderTools", () => {
  it("requests only the configured provider origins and groups tools by origin", async () => {
    const origins = readOriginConfig(validEnv);
    const port = new FakeModelContext();
    port.addRemoteTool(
      { name: "read_event_state", description: "Gather state", origin: origins.gather },
      async () => JSON.stringify(toolSuccess({})),
    );
    port.addRemoteTool(
      { name: "describe_event_capabilities", description: "Orbit manifest", origin: origins.orbit },
      async () => JSON.stringify(toolSuccess({})),
    );
    port.addRemoteTool(
      { name: "steal_state", description: "Unknown origin", origin: "https://evil.example" },
      async () => JSON.stringify(toolSuccess({})),
    );

    const inventory = await discoverProviderTools(port, origins);

    expect(port.lastGetToolsOptions?.fromOrigins).toEqual([origins.gather, origins.orbit]);
    expect(inventory.gather.map((tool) => tool.name)).toEqual(["read_event_state"]);
    expect(inventory.orbit.map((tool) => tool.name)).toEqual(["describe_event_capabilities"]);
    const allNames = [...inventory.gather, ...inventory.orbit].map((tool) => tool.name);
    expect(allNames).not.toContain("steal_state");
  });

  it("excludes an unknown-origin tool even when the port fails to filter", async () => {
    const origins = readOriginConfig(validEnv);
    const port = new FakeModelContext();
    port.ignoreFromOriginsFilter = true;
    port.addRemoteTool(
      { name: "steal_state", description: "Unknown origin", origin: "https://evil.example" },
      async () => JSON.stringify(toolSuccess({})),
    );
    const inventory = await discoverProviderTools(port, origins);
    expect(inventory.gather).toEqual([]);
    expect(inventory.orbit).toEqual([]);
  });
});

describe("executeJsonTool", () => {
  const origins = readOriginConfig(validEnv);

  function portWithHandler(handler: (input: string, signal?: AbortSignal) => Promise<unknown>): {
    port: FakeModelContext;
    tool: { name: string; description: string; origin: string };
  } {
    const port = new FakeModelContext();
    const tool = { name: "read_event_state", description: "Gather state", origin: origins.gather };
    port.addRemoteTool(tool, handler);
    return { port, tool };
  }

  it("serializes the input once and returns the parsed success envelope", async () => {
    const received: string[] = [];
    const { port, tool } = portWithHandler(async (input) => {
      received.push(input);
      return JSON.stringify(toolSuccess({ echoed: JSON.parse(input) }));
    });

    const result = await executeJsonTool(port, tool, { include: "trace" });

    expect(received).toEqual(['{"include":"trace"}']);
    expect(result).toEqual({ ok: true, data: { echoed: { include: "trace" } } });
  });

  it("passes a structured failure envelope through unchanged", async () => {
    const { port, tool } = portWithHandler(async () =>
      JSON.stringify(toolFailure("TRACE_EMPTY", "The demonstration has no actions yet", true)),
    );
    const result = await executeJsonTool(port, tool, {});
    expect(result).toEqual({
      ok: false,
      error: {
        code: "TRACE_EMPTY",
        message: "The demonstration has no actions yet",
        recoverable: true,
      },
    });
  });

  it("returns TOOL_CANCELLED without executing when the signal is already aborted", async () => {
    const handler = vi.fn(async () => JSON.stringify(toolSuccess({})));
    const { port, tool } = portWithHandler(handler);
    const controller = new AbortController();
    controller.abort();

    const result = await executeJsonTool(port, tool, {}, controller.signal);

    expect(handler).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("TOOL_CANCELLED");
    }
  });

  it("forwards cancellation to an in-flight execution", async () => {
    const { port, tool } = portWithHandler(
      (_input, signal) =>
        new Promise((_resolve, reject) => {
          signal?.addEventListener(
            "abort",
            () => reject(new DOMException("Aborted", "AbortError")),
            {
              once: true,
            },
          );
        }),
    );
    const controller = new AbortController();
    const pending = executeJsonTool(port, tool, {}, controller.signal);
    controller.abort();
    const result = await pending;
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("TOOL_CANCELLED");
    }
  });

  it("rejects non-JSON output as INVALID_TOOL_RESPONSE", async () => {
    const { port, tool } = portWithHandler(async () => "<html>not json</html>");
    const result = await executeJsonTool(port, tool, {});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_TOOL_RESPONSE");
    }
  });

  it("rejects a non-string result as INVALID_TOOL_RESPONSE", async () => {
    const { port, tool } = portWithHandler(async () => ({ ok: true, data: {} }));
    const result = await executeJsonTool(port, tool, {});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_TOOL_RESPONSE");
    }
  });

  it("rejects an envelope whose error code is outside the protocol set", async () => {
    const { port, tool } = portWithHandler(async () =>
      JSON.stringify({
        ok: false,
        error: { code: "MADE_UP_CODE", message: "nope", recoverable: false },
      }),
    );
    const result = await executeJsonTool(port, tool, {});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_TOOL_RESPONSE");
    }
  });

  it("rejects an envelope carrying unknown extra properties", async () => {
    const { port, tool } = portWithHandler(async () =>
      JSON.stringify({ ok: true, data: {}, confidence: 0.99 }),
    );
    const result = await executeJsonTool(port, tool, {});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_TOOL_RESPONSE");
    }
  });
});

describe("getBrowserModelContextPort", () => {
  it("returns null when document.modelContext is unavailable", () => {
    expect(getBrowserModelContextPort({} as Document)).toBeNull();
  });

  it("returns the browser-provided port object itself, never a fake", () => {
    const candidate = new FakeModelContext();
    const doc = { modelContext: candidate } as unknown as Document;
    const port = getBrowserModelContextPort(doc);
    expect(port).toBe(candidate);
  });

  it("returns null when the candidate does not match the port shape", () => {
    const doc = { modelContext: { registerTool: "not a function" } } as unknown as Document;
    expect(getBrowserModelContextPort(doc)).toBeNull();
  });
});
