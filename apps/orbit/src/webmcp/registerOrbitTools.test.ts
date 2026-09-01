import { describe, expect, it } from "vitest";
import { orbitCapabilities } from "@intent-relay/fixtures";
import { executeJsonTool, type DiscoveredTool, type ModelContextPort } from "@intent-relay/webmcp";
import { FakeModelContext } from "@intent-relay/webmcp/testing";
import { createOrbitStore, type OrbitStore } from "../domain/commands";
import type { OrbitDraftPayload } from "../domain/types";
import { registerOrbitTools } from "./registerOrbitTools";

const RELAY_ORIGIN = "http://localhost:4173";
const ORBIT_ORIGIN = "http://localhost:4175";
const NOW = "2026-08-29T02:00:00.000Z";

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

function validPayload(overrides: Partial<OrbitDraftPayload> = {}): OrbitDraftPayload {
  return {
    contractId: "contract-student-ai-workshop",
    contractRevision: 1,
    capabilityVersion: orbitCapabilities.version,
    previewHash: "a".repeat(64),
    values: {
      "event.title": "Student AI Workshop",
      "event.schedule": {
        start: "2026-09-18T18:00:00.000+09:00",
        end: "2026-09-18T20:00:00.000+09:00",
        timezone: "Asia/Tokyo",
      },
      "registration.capacity.maximum": 100,
      "ticketing.mode": "free",
      "notifications.reminder.offset": 1,
      "accessibility.venue_note": "Explain that the venue entrance has steps",
      "registration.overflow.mode": "external_form",
    },
    ...overrides,
  };
}

async function setup(): Promise<{
  port: FakeModelContext;
  store: OrbitStore;
  controller: AbortController;
  toolNamed: (name: string) => Promise<DiscoveredTool>;
}> {
  const port = new FakeModelContext(ORBIT_ORIGIN);
  const store = createOrbitStore({
    demoSessionId: "session-orbit-tools",
    storage: new MemoryStorage(),
    now: () => NOW,
  });
  const controller = new AbortController();
  await registerOrbitTools(port, RELAY_ORIGIN, store, { signal: controller.signal });
  const toolNamed = async (name: string): Promise<DiscoveredTool> => {
    const tool = (await port.getTools()).find((candidate) => candidate.name === name);
    if (tool === undefined) {
      throw new Error(`Tool ${name} is not registered`);
    }
    return tool;
  };
  return { port, store, controller, toolNamed };
}

describe("registerOrbitTools", () => {
  it("does not expose publication in the provider tool list", async () => {
    const { port } = await setup();
    const names = (await port.getTools()).map((tool) => tool.name);
    expect(names).toEqual([
      "describe_event_capabilities",
      "prepare_event_draft",
      "read_event_draft",
    ]);
    expect(names.some((name) => name.includes("publish") || name.includes("activate"))).toBe(false);
    for (const name of names) {
      expect(port.registrationOptionsFor(name)?.exposedTo).toEqual([RELAY_ORIGIN]);
    }
  });

  it("returns the canonical capability manifest and version", async () => {
    const { port, toolNamed } = await setup();
    const result = await executeJsonTool(port, await toolNamed("describe_event_capabilities"), {});
    expect(result.ok).toBe(true);
    if (result.ok) {
      const data = result.data as { provider: string; manifest: typeof orbitCapabilities };
      expect(data.provider).toBe("orbit");
      expect(data.manifest).toEqual(orbitCapabilities);
      expect(data.manifest.version).toBe("orbit-event-v1");
    }
  });

  it("prepares a draft and updates visible state before returning", async () => {
    const { port, store, toolNamed } = await setup();
    const result = await executeJsonTool(port, await toolNamed("prepare_event_draft"), {
      draft: validPayload(),
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const data = result.data as { draftId: string; revision: number; publication: string };
      expect(data.revision).toBe(1);
      expect(data.publication).toBe("draft");
      expect(store.getState().draft?.draftId).toBe(data.draftId);
    }
  });

  it("is idempotent for a repeated identical preview hash", async () => {
    const { port, toolNamed } = await setup();
    const tool = await toolNamed("prepare_event_draft");
    const first = await executeJsonTool(port, tool, { draft: validPayload() });
    const second = await executeJsonTool(port, tool, { draft: validPayload() });
    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(second.data).toEqual(first.data);
    }
  });

  it("rejects an invalid payload as TARGET_REJECTED_DRAFT without partial writes", async () => {
    const { port, store, toolNamed } = await setup();
    const broken: unknown = {
      ...validPayload(),
      values: { ...validPayload().values, "ticketing.mode": "donation" },
    };
    const result = await executeJsonTool(port, await toolNamed("prepare_event_draft"), {
      draft: broken,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("TARGET_REJECTED_DRAFT");
    }
    expect(store.getState().draft).toBeNull();
  });

  it("rejects a stale capability version as CAPABILITY_VERSION_INVALID", async () => {
    const { port, toolNamed } = await setup();
    const result = await executeJsonTool(port, await toolNamed("prepare_event_draft"), {
      draft: validPayload({ capabilityVersion: "orbit-event-v0" }),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("CAPABILITY_VERSION_INVALID");
    }
  });

  it("cannot change publication state through draft preparation", async () => {
    const { port, store, toolNamed } = await setup();
    const sneaky: unknown = {
      ...validPayload(),
      values: { ...validPayload().values, "event.publish": "now" },
    };
    const result = await executeJsonTool(port, await toolNamed("prepare_event_draft"), {
      draft: sneaky,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("TARGET_REJECTED_DRAFT");
    }
    expect(store.getState().publication).toBe("none");
  });

  it("returns the visible draft and publication state through read_event_draft", async () => {
    const { port, store, toolNamed } = await setup();
    const before = await executeJsonTool(port, await toolNamed("read_event_draft"), {});
    expect(before.ok && (before.data as { draft: unknown }).draft).toBeNull();
    store.dispatchOrbitCommand({ type: "prepareDraft", payload: validPayload() }, "agent");
    const after = await executeJsonTool(port, await toolNamed("read_event_draft"), {});
    expect(after.ok).toBe(true);
    if (after.ok) {
      const data = after.data as {
        provider: string;
        draft: { previewHash: string } | null;
        publication: string;
      };
      expect(data.provider).toBe("orbit");
      expect(data.draft?.previewHash).toBe(validPayload().previewHash);
      expect(data.publication).toBe("draft");
    }
  });

  it("rejects a reused preview hash with different values and keeps the existing draft", async () => {
    const { port, store, toolNamed } = await setup();
    const tool = await toolNamed("prepare_event_draft");
    await executeJsonTool(port, tool, { draft: validPayload() });
    const divergent = {
      ...validPayload(),
      values: { ...validPayload().values, "registration.overflow.mode": "close_registration" },
    };
    const result = await executeJsonTool(port, tool, { draft: divergent });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("TARGET_REJECTED_DRAFT");
    }
    expect(store.getState().draft?.values["registration.overflow.mode"]).toBe("external_form");
  });

  it("cannot reopen a published event through an identical retry", async () => {
    const { port, store, toolNamed } = await setup();
    const tool = await toolNamed("prepare_event_draft");
    await executeJsonTool(port, tool, { draft: validPayload() });
    store.dispatchOrbitCommand({ type: "publishEvent" }, "human");
    const publishedAt = store.getState().publishedAt;
    const retry = await executeJsonTool(port, tool, { draft: validPayload() });
    expect(retry.ok).toBe(true);
    expect(store.getState().publication).toBe("published");
    expect(store.getState().publishedAt).toBe(publishedAt);
  });

  it("rolls back earlier tools when a later registration fails", async () => {
    const port = new FakeModelContext(ORBIT_ORIGIN);
    const store = createOrbitStore({
      demoSessionId: "session-orbit-rollbk",
      storage: new MemoryStorage(),
    });
    const failingPort: ModelContextPort = {
      registerTool: async (tool, options) => {
        if (tool.name === "read_event_draft") {
          throw new Error("registration denied by the browser");
        }
        return port.registerTool(tool, options);
      },
      getTools: (options) => port.getTools(options),
      executeTool: (tool, input, options) => port.executeTool(tool, input, options),
      addEventListener: (type, listener) => port.addEventListener(type, listener),
      removeEventListener: (type, listener) => port.removeEventListener(type, listener),
    };
    await expect(registerOrbitTools(failingPort, RELAY_ORIGIN, store, {})).rejects.toThrow(
      /registration denied/,
    );
    expect(await port.getTools()).toEqual([]);
  });

  it("unregisters all three tools when the registration signal aborts", async () => {
    const { port, controller } = await setup();
    controller.abort();
    expect(await port.getTools()).toEqual([]);
  });
});
