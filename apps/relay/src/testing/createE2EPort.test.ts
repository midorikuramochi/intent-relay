import { describe, expect, it, vi } from "vitest";
import { createRelayStore } from "../domain/storage";
import { createE2EHarness } from "./createE2EPort";

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

const ORIGINS = {
  relay: "http://localhost:4173",
  gather: "http://localhost:4174",
  orbit: "http://localhost:4175",
};

describe("createE2EHarness lifecycle", () => {
  it("mounts both providers, follows session rotation, and disposes completely", async () => {
    const harness = createE2EHarness(ORIGINS);
    const store = createRelayStore({ storage: new MemoryStorage() });
    harness.attach(store);

    await vi.waitFor(async () => {
      expect((await harness.port.getTools()).length).toBe(5);
    });

    const firstSession = store.getState().demoSessionId;
    store.resetDemo();
    expect(store.getState().demoSessionId).not.toBe(firstSession);
    await vi.waitFor(async () => {
      expect((await harness.port.getTools()).length).toBe(5);
    });

    harness.dispose();
    expect(await harness.port.getTools()).toEqual([]);

    // no rebuild after disposal, even when Relay state keeps changing
    store.dispatch({ type: "goToStep", step: "verify_contract" });
    store.resetDemo();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(await harness.port.getTools()).toEqual([]);
    expect(() => harness.seedSampleDemonstration()).toThrow(/disposed/i);
  });
});
