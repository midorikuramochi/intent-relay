import { describe, expect, it } from "vitest";
import type { IntentContract, SemanticTrace } from "@intent-relay/contracts";
import { orbitCapabilities, proposedStudentAiWorkshopContract } from "@intent-relay/fixtures";
import type { ToolResult } from "@intent-relay/protocol";
import { toolSuccess } from "@intent-relay/protocol";
import { executeJsonTool, type DiscoveredTool } from "@intent-relay/webmcp";
import { FakeModelContext } from "@intent-relay/webmcp/testing";
import {
  createGatherStore,
  sampleDemonstrationCommands,
} from "@intent-relay/gather/src/domain/commands";
import { registerGatherTools } from "@intent-relay/gather/src/webmcp/registerGatherTools";
import { createOrbitStore, type OrbitStore } from "@intent-relay/orbit/src/domain/commands";
import { registerOrbitTools } from "@intent-relay/orbit/src/webmcp/registerOrbitTools";
import { createRelayStore, type RelayStore } from "../domain/storage";
import { createProviderBridge, type ProviderBridge } from "../providers/providerBridge";
import { createRelayOrchestrator, type RelayOrchestrator } from "./registerRelayTools";

const RELAY_ORIGIN = "http://localhost:4173";
const GATHER_ORIGIN = "http://localhost:4174";
const ORBIT_ORIGIN = "http://localhost:4175";
const NOW = "2026-08-30T03:00:00.000Z";

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

interface Harness {
  relayPort: FakeModelContext;
  orbitPort: FakeModelContext;
  relayStore: RelayStore;
  bridge: ProviderBridge;
  orchestrator: RelayOrchestrator;
  gatherStore: ReturnType<typeof createGatherStore>;
  orbitStore: OrbitStore;
  invoke: (name: string, input: unknown, signal?: AbortSignal) => Promise<ToolResult<unknown>>;
  completeDemo: () => void;
  approveContractAsHuman: () => void;
  saveLiveProposal: () => Promise<ToolResult<unknown>>;
}

async function mountProvider(
  relayPort: FakeModelContext,
  providerPort: FakeModelContext,
): Promise<void> {
  for (const tool of await providerPort.getTools()) {
    relayPort.addRemoteTool({ ...tool }, (input, signal) =>
      providerPort.executeTool(tool, input, { signal }),
    );
  }
}

function liveProposalFrom(trace: SemanticTrace): IntentContract {
  return {
    ...structuredClone(proposedStudentAiWorkshopContract),
    id: "contract-live-1",
    source: {
      provider: "gather",
      traceId: trace.id,
      capturedAt: NOW,
    },
    rules: proposedStudentAiWorkshopContract.rules.map((rule) => {
      const supporting = trace.actions.find((action) => action.semanticKey === rule.semanticKey);
      return { ...structuredClone(rule), provenance: [supporting?.id ?? "missing"] };
    }),
  };
}

async function createHarness(): Promise<Harness> {
  const relayPort = new FakeModelContext(RELAY_ORIGIN);
  const relayStore = createRelayStore({ storage: new MemoryStorage() });
  const demoSessionId = relayStore.getState().demoSessionId;

  const gatherPort = new FakeModelContext(GATHER_ORIGIN);
  const gatherStore = createGatherStore({
    demoSessionId,
    storage: new MemoryStorage(),
    now: () => NOW,
  });
  await registerGatherTools(gatherPort, RELAY_ORIGIN, gatherStore.getState, {});
  await mountProvider(relayPort, gatherPort);

  const orbitPort = new FakeModelContext(ORBIT_ORIGIN);
  const orbitStore = createOrbitStore({
    demoSessionId,
    storage: new MemoryStorage(),
    now: () => NOW,
  });
  await registerOrbitTools(orbitPort, RELAY_ORIGIN, orbitStore, {});
  await mountProvider(relayPort, orbitPort);

  const bridge = createProviderBridge(relayPort, { gather: GATHER_ORIGIN, orbit: ORBIT_ORIGIN });
  await bridge.refresh();

  const orchestrator = createRelayOrchestrator({
    port: relayPort,
    bridge,
    store: relayStore,
    now: () => NOW,
  });

  const invoke = async (
    name: string,
    input: unknown,
    signal?: AbortSignal,
  ): Promise<ToolResult<unknown>> =>
    JSON.parse(await orchestrator.invokeTool(name, input, signal)) as ToolResult<unknown>;

  const completeDemo = (): void => {
    for (const command of sampleDemonstrationCommands()) {
      gatherStore.dispatchGatherCommand(command, "human");
    }
    gatherStore.dispatchGatherCommand({ type: "completeDemonstration" }, "human");
  };

  const approveContractAsHuman = (): void => {
    const active = relayStore.getState().activeContract;
    if (active === null) {
      throw new Error("no active contract to approve");
    }
    for (const rule of active.rules) {
      relayStore.dispatch({ type: "setRuleStatus", ruleId: rule.id, humanStatus: "approved" });
    }
    relayStore.dispatch({ type: "approveContractByHuman", approvedAt: NOW });
  };

  const saveLiveProposal = async (): Promise<ToolResult<unknown>> => {
    const inspection = await invoke("inspect_source_demonstration", {});
    if (!inspection.ok) {
      throw new Error("inspection failed during setup");
    }
    const trace = (inspection.data as { trace: SemanticTrace }).trace;
    return invoke("save_intent_contract_draft", { contract: liveProposalFrom(trace) });
  };

  return {
    relayPort,
    orbitPort,
    relayStore,
    bridge,
    orchestrator,
    gatherStore,
    orbitStore,
    invoke,
    completeDemo,
    approveContractAsHuman,
    saveLiveProposal,
  };
}

async function harnessAtPreview(): Promise<Harness> {
  const harness = await createHarness();
  harness.completeDemo();
  await harness.saveLiveProposal();
  harness.approveContractAsHuman();
  const result = await harness.invoke("inspect_target_compatibility", {
    contractId: "contract-live-1",
  });
  if (!result.ok) {
    throw new Error(`compatibility inspection failed during setup: ${result.error.code}`);
  }
  return harness;
}

describe("inspect_source_demonstration", () => {
  it("fails explicitly while Gather is disconnected", async () => {
    const relayPort = new FakeModelContext(RELAY_ORIGIN);
    const relayStore = createRelayStore({ storage: new MemoryStorage() });
    const bridge = createProviderBridge(relayPort, {
      gather: GATHER_ORIGIN,
      orbit: ORBIT_ORIGIN,
    });
    await bridge.refresh();
    const orchestrator = createRelayOrchestrator({ port: relayPort, bridge, store: relayStore });
    const result = JSON.parse(
      await orchestrator.invokeTool("inspect_source_demonstration", {}),
    ) as ToolResult<unknown>;
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("SOURCE_DISCONNECTED");
      expect(result.error.message).toContain(GATHER_ORIGIN);
    }
  });

  it("passes TRACE_EMPTY through before the demonstration is completed", async () => {
    const harness = await createHarness();
    const result = await harness.invoke("inspect_source_demonstration", {});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("TRACE_EMPTY");
    }
  });

  it("returns the completed demonstration with matching revisions", async () => {
    const harness = await createHarness();
    harness.completeDemo();
    const result = await harness.invoke("inspect_source_demonstration", {});
    expect(result.ok).toBe(true);
    if (result.ok) {
      const data = result.data as {
        provider: string;
        eventState: { revision: number };
        trace: SemanticTrace;
      };
      expect(data.provider).toBe("gather");
      expect(data.trace.completed).toBe(true);
      expect(data.trace.actions).toHaveLength(9);
      expect(data.trace.eventRevision).toBe(data.eventState.revision);
    }
  });

  it("returns TOOL_CANCELLED for an aborted call without touching provider state", async () => {
    const harness = await createHarness();
    harness.completeDemo();
    const controller = new AbortController();
    controller.abort();
    const result = await harness.invoke("inspect_source_demonstration", {}, controller.signal);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("TOOL_CANCELLED");
    }
    expect(harness.orchestrator.getLastDemonstration()).toBeNull();
  });
});

describe("save_intent_contract_draft", () => {
  it("saves a provenance-valid proposal as a draft that still requires human approval", async () => {
    const harness = await createHarness();
    harness.completeDemo();
    const result = await harness.saveLiveProposal();
    expect(result.ok).toBe(true);
    const active = harness.relayStore.getState().activeContract;
    expect(active?.status).toBe("draft");
    expect(active?.rules.every((rule) => rule.humanStatus === "proposed")).toBe(true);
  });

  it("forces an agent-supplied approved status back to draft", async () => {
    const harness = await createHarness();
    harness.completeDemo();
    const inspection = await harness.invoke("inspect_source_demonstration", {});
    if (!inspection.ok) {
      throw new Error("inspection failed");
    }
    const trace = (inspection.data as { trace: SemanticTrace }).trace;
    const sneaky = {
      ...liveProposalFrom(trace),
      status: "approved",
      approvedAt: NOW,
    };
    const result = await harness.invoke("save_intent_contract_draft", { contract: sneaky });
    expect(result.ok).toBe(true);
    expect(harness.relayStore.getState().activeContract?.status).toBe("draft");
    expect(harness.relayStore.getState().activeContract?.approvedAt).toBeUndefined();
  });

  it("rejects provenance that is not in the live trace", async () => {
    const harness = await createHarness();
    harness.completeDemo();
    const inspection = await harness.invoke("inspect_source_demonstration", {});
    if (!inspection.ok) {
      throw new Error("inspection failed");
    }
    const trace = (inspection.data as { trace: SemanticTrace }).trace;
    const proposal = liveProposalFrom(trace);
    proposal.rules = proposal.rules.map((rule, index) =>
      index === 0 ? { ...rule, provenance: ["gather-act-01"] } : rule,
    );
    const result = await harness.invoke("save_intent_contract_draft", { contract: proposal });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("UNKNOWN_PROVENANCE");
    }
  });

  it("cannot invent a post-approval revision without the human revising first", async () => {
    const harness = await harnessAtPreview();
    const inspection = await harness.invoke("inspect_source_demonstration", {});
    if (!inspection.ok) {
      throw new Error("inspection failed");
    }
    const trace = (inspection.data as { trace: SemanticTrace }).trace;
    const invented = { ...liveProposalFrom(trace), revision: 2 };
    const result = await harness.invoke("save_intent_contract_draft", { contract: invented });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_CONTRACT");
      expect(result.error.message).toMatch(/revise/i);
    }
    expect(harness.relayStore.getState().activeContract?.status).toBe("approved");
  });
});

describe("inspect_target_compatibility", () => {
  it("rejects a draft contract", async () => {
    const harness = await createHarness();
    harness.completeDemo();
    await harness.saveLiveProposal();
    const result = await harness.invoke("inspect_target_compatibility", {
      contractId: "contract-live-1",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("CONTRACT_NOT_APPROVED");
    }
  });

  it("rejects an unknown contract id", async () => {
    const harness = await createHarness();
    harness.completeDemo();
    await harness.saveLiveProposal();
    harness.approveContractAsHuman();
    const result = await harness.invoke("inspect_target_compatibility", {
      contractId: "contract-nonexistent",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("CONTRACT_NOT_FOUND");
    }
  });

  it("computes the real four-status preview from Orbit's declared capabilities", async () => {
    const harness = await harnessAtPreview();
    const preview = harness.relayStore.getState().preview;
    expect(preview).not.toBeNull();
    const counts = { direct: 0, transformed: 0, unsupported: 0, needs_decision: 0 };
    for (const entry of preview?.mappings ?? []) {
      counts[entry.status] += 1;
    }
    expect(counts).toEqual({ direct: 5, transformed: 2, unsupported: 1, needs_decision: 1 });
    expect(harness.relayStore.getState().resolutions).toEqual([]);
    expect(harness.relayStore.getState().step).toBe("transfer");
  });

  it("fails explicitly when Orbit is disconnected", async () => {
    const harness = await createHarness();
    harness.completeDemo();
    await harness.saveLiveProposal();
    harness.approveContractAsHuman();
    for (const name of ["describe_event_capabilities", "prepare_event_draft", "read_event_draft"]) {
      harness.relayPort.removeRemoteTool(ORBIT_ORIGIN, name);
    }
    await harness.bridge.refresh();
    const result = await harness.invoke("inspect_target_compatibility", {
      contractId: "contract-live-1",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("TARGET_DISCONNECTED");
      expect(result.error.message).toContain(ORBIT_ORIGIN);
    }
  });
});

describe("prepare_target_draft", () => {
  it("rejects with UNRESOLVED_DECISIONS while the Human Queue is open and leaves Orbit unchanged", async () => {
    const harness = await harnessAtPreview();
    const previewHash = harness.relayStore.getState().preview?.previewHash ?? "";
    const result = await harness.invoke("prepare_target_draft", {
      contractId: "contract-live-1",
      previewHash,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("UNRESOLVED_DECISIONS");
    }
    expect(harness.orbitStore.getState().draft).toBeNull();
    expect(harness.relayStore.getState().targetDraft).toBeNull();
  });

  it("prepares the Orbit draft from the human-resolved preview", async () => {
    const harness = await harnessAtPreview();
    harness.relayStore.dispatch({
      type: "resolveDecision",
      ruleId: "rule-overflow",
      alternativeId: "external_form",
      resolvedAt: NOW,
    });
    const previewHash = harness.relayStore.getState().preview?.previewHash ?? "";
    const result = await harness.invoke("prepare_target_draft", {
      contractId: "contract-live-1",
      previewHash,
    });
    expect(result.ok).toBe(true);
    const orbitDraft = harness.orbitStore.getState().draft;
    expect(orbitDraft).not.toBeNull();
    expect(orbitDraft?.previewHash).toBe(previewHash);
    expect(orbitDraft?.values["registration.overflow.mode"]).toBe("external_form");
    expect(orbitDraft?.values["notifications.reminder.offset"]).toBe(1);
    expect(orbitDraft?.values["accessibility.venue_note"]).toBe(
      "Explain that the venue entrance has steps",
    );
    expect("event.publish" in (orbitDraft?.values ?? {})).toBe(false);
    expect("registration.custom_question.dietary_restrictions" in (orbitDraft?.values ?? {})).toBe(
      false,
    );
    expect(harness.orbitStore.getState().publication).toBe("draft");
    expect(harness.relayStore.getState().targetDraft?.draftId).toBe(orbitDraft?.draftId);
    expect(harness.relayStore.getState().step).toBe("review");
  });

  it("rejects a stale preview hash", async () => {
    const harness = await harnessAtPreview();
    harness.relayStore.dispatch({
      type: "resolveDecision",
      ruleId: "rule-overflow",
      alternativeId: "external_form",
      resolvedAt: NOW,
    });
    const result = await harness.invoke("prepare_target_draft", {
      contractId: "contract-live-1",
      previewHash: "f".repeat(64),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("STALE_PREVIEW");
    }
    expect(harness.orbitStore.getState().draft).toBeNull();
  });

  it("rejects a preview whose capability version Orbit no longer serves", async () => {
    const harness = await harnessAtPreview();
    harness.relayStore.dispatch({
      type: "resolveDecision",
      ruleId: "rule-overflow",
      alternativeId: "external_form",
      resolvedAt: NOW,
    });
    const previewHash = harness.relayStore.getState().preview?.previewHash ?? "";
    harness.relayPort.removeRemoteTool(ORBIT_ORIGIN, "describe_event_capabilities");
    harness.relayPort.addRemoteTool(
      {
        name: "describe_event_capabilities",
        description: "changed manifest",
        origin: ORBIT_ORIGIN,
      },
      async () =>
        JSON.stringify(
          toolSuccess({
            provider: "orbit",
            demoSessionId: harness.relayStore.getState().demoSessionId,
            manifest: {
              provider: "orbit",
              version: "orbit-event-v2",
              capabilities: [],
              unsupportedSemanticKeys: [],
              humanOnlyActions: ["event.publish"],
            },
          }),
        ),
    );
    await harness.bridge.refresh();
    const result = await harness.invoke("prepare_target_draft", {
      contractId: "contract-live-1",
      previewHash,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("STALE_PREVIEW");
    }
    expect(harness.orbitStore.getState().draft).toBeNull();
  });

  it("rejects an old preview after the human revises the contract", async () => {
    const harness = await harnessAtPreview();
    const previewHash = harness.relayStore.getState().preview?.previewHash ?? "";
    harness.relayStore.dispatch({ type: "reviseContract" });
    const result = await harness.invoke("prepare_target_draft", {
      contractId: "contract-live-1",
      previewHash,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("STALE_PREVIEW");
    }
  });

  it("records no target draft when Orbit rejects the preparation", async () => {
    const harness = await harnessAtPreview();
    harness.relayStore.dispatch({
      type: "resolveDecision",
      ruleId: "rule-overflow",
      alternativeId: "external_form",
      resolvedAt: NOW,
    });
    harness.relayPort.removeRemoteTool(ORBIT_ORIGIN, "prepare_event_draft");
    harness.relayPort.addRemoteTool(
      { name: "prepare_event_draft", description: "broken", origin: ORBIT_ORIGIN },
      async () => {
        throw new Error("orbit exploded");
      },
    );
    await harness.bridge.refresh();
    const previewHash = harness.relayStore.getState().preview?.previewHash ?? "";
    const result = await harness.invoke("prepare_target_draft", {
      contractId: "contract-live-1",
      previewHash,
    });
    expect(result.ok).toBe(false);
    expect(harness.relayStore.getState().targetDraft).toBeNull();
    expect(harness.relayStore.getState().step).toBe("transfer");
  });

  it("returns TOOL_CANCELLED for an aborted call without partial writes", async () => {
    const harness = await harnessAtPreview();
    harness.relayStore.dispatch({
      type: "resolveDecision",
      ruleId: "rule-overflow",
      alternativeId: "external_form",
      resolvedAt: NOW,
    });
    const previewHash = harness.relayStore.getState().preview?.previewHash ?? "";
    const controller = new AbortController();
    controller.abort();
    const result = await harness.invoke(
      "prepare_target_draft",
      { contractId: "contract-live-1", previewHash },
      controller.signal,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("TOOL_CANCELLED");
    }
    expect(harness.orbitStore.getState().draft).toBeNull();
    expect(harness.relayStore.getState().targetDraft).toBeNull();
  });
});

describe("source freshness for contract drafts", () => {
  it("rejects saving a contract from a stale demonstration after Gather is edited", async () => {
    const harness = await createHarness();
    harness.completeDemo();
    const inspection = await harness.invoke("inspect_source_demonstration", {});
    if (!inspection.ok) {
      throw new Error("inspection failed");
    }
    const trace = (inspection.data as { trace: SemanticTrace }).trace;
    const proposal = liveProposalFrom(trace);

    harness.gatherStore.dispatchGatherCommand({ type: "setCapacity", value: 80 }, "human");

    const result = await harness.invoke("save_intent_contract_draft", { contract: proposal });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(["TRACE_EMPTY", "STALE_TRACE"]).toContain(result.error.code);
    }
    expect(harness.relayStore.getState().activeContract).toBeNull();
  });

  it("rejects a cached demonstration after Gather is edited and re-completed", async () => {
    const harness = await createHarness();
    harness.completeDemo();
    const inspection = await harness.invoke("inspect_source_demonstration", {});
    if (!inspection.ok) {
      throw new Error("inspection failed");
    }
    const trace = (inspection.data as { trace: SemanticTrace }).trace;
    const proposal = liveProposalFrom(trace);

    harness.gatherStore.dispatchGatherCommand({ type: "setCapacity", value: 80 }, "human");
    harness.gatherStore.dispatchGatherCommand({ type: "completeDemonstration" }, "human");

    const result = await harness.invoke("save_intent_contract_draft", { contract: proposal });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("STALE_TRACE");
    }
    expect(harness.relayStore.getState().activeContract).toBeNull();
  });

  it("clears the cached demonstration when reinspection fails", async () => {
    const harness = await createHarness();
    harness.completeDemo();
    const first = await harness.invoke("inspect_source_demonstration", {});
    expect(first.ok).toBe(true);
    expect(harness.orchestrator.toolNames()).toContain("save_intent_contract_draft");

    harness.gatherStore.dispatchGatherCommand({ type: "setCapacity", value: 80 }, "human");
    const second = await harness.invoke("inspect_source_demonstration", {});
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.error.code).toBe("TRACE_EMPTY");
    }
    expect(harness.orchestrator.getLastDemonstration()).toBeNull();
    expect(harness.orchestrator.toolNames()).not.toContain("save_intent_contract_draft");
  });
});

describe("concurrent human activity during prepare_target_draft", () => {
  function gateOrbitCapabilities(harness: Harness): { release: () => void } {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    harness.relayPort.removeRemoteTool(ORBIT_ORIGIN, "describe_event_capabilities");
    harness.relayPort.addRemoteTool(
      {
        name: "describe_event_capabilities",
        description: "gated manifest",
        origin: ORBIT_ORIGIN,
      },
      async () => {
        await gate;
        return JSON.stringify(
          toolSuccess({
            provider: "orbit",
            demoSessionId: harness.relayStore.getState().demoSessionId,
            manifest: orbitCapabilities,
          }),
        );
      },
    );
    return { release };
  }

  it("never sends a superseded human resolution to Orbit", async () => {
    const harness = await harnessAtPreview();
    harness.relayStore.dispatch({
      type: "resolveDecision",
      ruleId: "rule-overflow",
      alternativeId: "close_registration",
      resolvedAt: NOW,
    });
    const previewHash = harness.relayStore.getState().preview?.previewHash ?? "";
    const gate = gateOrbitCapabilities(harness);
    await harness.bridge.refresh();

    const pending = harness.invoke("prepare_target_draft", {
      contractId: "contract-live-1",
      previewHash,
    });
    harness.relayStore.dispatch({
      type: "resolveDecision",
      ruleId: "rule-overflow",
      alternativeId: "external_form",
      resolvedAt: "2026-08-30T04:00:00.000Z",
    });
    gate.release();
    const result = await pending;
    expect(result.ok).toBe(true);
    expect(harness.orbitStore.getState().draft?.values["registration.overflow.mode"]).toBe(
      "external_form",
    );
  });

  it("prepares nothing when the contract is revised during the capability read", async () => {
    const harness = await harnessAtPreview();
    harness.relayStore.dispatch({
      type: "resolveDecision",
      ruleId: "rule-overflow",
      alternativeId: "external_form",
      resolvedAt: NOW,
    });
    const previewHash = harness.relayStore.getState().preview?.previewHash ?? "";
    const gate = gateOrbitCapabilities(harness);
    await harness.bridge.refresh();

    const pending = harness.invoke("prepare_target_draft", {
      contractId: "contract-live-1",
      previewHash,
    });
    harness.relayStore.dispatch({ type: "reviseContract" });
    gate.release();
    const result = await pending;
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("STALE_PREVIEW");
    }
    expect(harness.orbitStore.getState().draft).toBeNull();
    expect(harness.relayStore.getState().targetDraft).toBeNull();
  });
});

describe("session identity and post-write verification", () => {
  it("rejects an Orbit capability response from a different demo session and saves no preview", async () => {
    const harness = await createHarness();
    harness.completeDemo();
    await harness.saveLiveProposal();
    harness.approveContractAsHuman();

    harness.relayPort.removeRemoteTool(ORBIT_ORIGIN, "describe_event_capabilities");
    harness.relayPort.addRemoteTool(
      {
        name: "describe_event_capabilities",
        description: "wrong session",
        origin: ORBIT_ORIGIN,
      },
      async () =>
        JSON.stringify(
          toolSuccess({
            provider: "orbit",
            demoSessionId: "session-other-0001",
            manifest: orbitCapabilities,
          }),
        ),
    );
    await harness.bridge.refresh();

    const result = await harness.invoke("inspect_target_compatibility", {
      contractId: "contract-live-1",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("TARGET_DISCONNECTED");
    }
    expect(harness.relayStore.getState().preview).toBeNull();
  });

  it("rejects a wrong-session Orbit draft response in get_transfer_review", async () => {
    const harness = await harnessAtPreview();
    harness.relayStore.dispatch({
      type: "resolveDecision",
      ruleId: "rule-overflow",
      alternativeId: "external_form",
      resolvedAt: NOW,
    });
    const previewHash = harness.relayStore.getState().preview?.previewHash ?? "";
    await harness.invoke("prepare_target_draft", { contractId: "contract-live-1", previewHash });

    const realDraft = structuredClone(harness.orbitStore.getState().draft);
    harness.relayPort.removeRemoteTool(ORBIT_ORIGIN, "read_event_draft");
    harness.relayPort.addRemoteTool(
      { name: "read_event_draft", description: "wrong session", origin: ORBIT_ORIGIN },
      async () =>
        JSON.stringify(
          toolSuccess({
            provider: "orbit",
            demoSessionId: "session-other-0001",
            draft: realDraft,
            publication: "draft",
          }),
        ),
    );
    await harness.bridge.refresh();

    const result = await harness.invoke("get_transfer_review", {});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("TARGET_DISCONNECTED");
    }
  });

  it("returns no obsolete review when the transfer is revised during the Orbit read", async () => {
    const harness = await harnessAtPreview();
    harness.relayStore.dispatch({
      type: "resolveDecision",
      ruleId: "rule-overflow",
      alternativeId: "external_form",
      resolvedAt: NOW,
    });
    const previewHash = harness.relayStore.getState().preview?.previewHash ?? "";
    await harness.invoke("prepare_target_draft", { contractId: "contract-live-1", previewHash });

    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    harness.relayPort.removeRemoteTool(ORBIT_ORIGIN, "read_event_draft");
    harness.relayPort.addRemoteTool(
      { name: "read_event_draft", description: "gated read", origin: ORBIT_ORIGIN },
      async () => {
        await gate;
        const orbitState = harness.orbitStore.getState();
        return JSON.stringify(
          toolSuccess({
            provider: "orbit",
            demoSessionId: orbitState.demoSessionId,
            draft: orbitState.draft,
            publication: orbitState.publication,
          }),
        );
      },
    );
    await harness.bridge.refresh();

    const pending = harness.invoke("get_transfer_review", {});
    harness.relayStore.dispatch({ type: "reviseContract" });
    release();
    const result = await pending;
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(["DRAFT_NOT_PREPARED", "STALE_PREVIEW"]).toContain(result.error.code);
    }
  });

  function gateOrbitPrepare(harness: Harness): { release: () => void } {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    harness.relayPort.removeRemoteTool(ORBIT_ORIGIN, "prepare_event_draft");
    harness.relayPort.addRemoteTool(
      { name: "prepare_event_draft", description: "gated prepare", origin: ORBIT_ORIGIN },
      async (input, signal) => {
        await gate;
        const realTool = (await harness.orbitPort.getTools()).find(
          (candidate) => candidate.name === "prepare_event_draft",
        );
        if (realTool === undefined) {
          throw new Error("orbit prepare tool missing");
        }
        return harness.orbitPort.executeTool(realTool, input, { signal });
      },
    );
    return { release };
  }

  it("does not record a draft when a decision changes during the Orbit write", async () => {
    const harness = await harnessAtPreview();
    harness.relayStore.dispatch({
      type: "resolveDecision",
      ruleId: "rule-overflow",
      alternativeId: "close_registration",
      resolvedAt: NOW,
    });
    const previewHash = harness.relayStore.getState().preview?.previewHash ?? "";
    const gate = gateOrbitPrepare(harness);
    await harness.bridge.refresh();

    const pending = harness.invoke("prepare_target_draft", {
      contractId: "contract-live-1",
      previewHash,
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    harness.relayStore.dispatch({
      type: "resolveDecision",
      ruleId: "rule-overflow",
      alternativeId: "external_form",
      resolvedAt: "2026-08-30T05:00:00.000Z",
    });
    gate.release();
    const result = await pending;
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("STALE_PREVIEW");
    }
    expect(harness.relayStore.getState().targetDraft).toBeNull();
    expect(harness.relayStore.getState().resolutions[0]?.alternativeId).toBe("external_form");
  });

  it("does not record a stale draft when the contract is revised during the Orbit write", async () => {
    const harness = await harnessAtPreview();
    harness.relayStore.dispatch({
      type: "resolveDecision",
      ruleId: "rule-overflow",
      alternativeId: "external_form",
      resolvedAt: NOW,
    });
    const previewHash = harness.relayStore.getState().preview?.previewHash ?? "";
    const gate = gateOrbitPrepare(harness);
    await harness.bridge.refresh();

    const pending = harness.invoke("prepare_target_draft", {
      contractId: "contract-live-1",
      previewHash,
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    harness.relayStore.dispatch({ type: "reviseContract" });
    gate.release();
    const result = await pending;
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("STALE_PREVIEW");
    }
    expect(harness.relayStore.getState().targetDraft).toBeNull();
  });
});

describe("orchestrator lifecycle after abort", () => {
  it("never re-registers tools after the lifetime aborts", async () => {
    const harness = await createHarness();
    const controller = new AbortController();
    harness.orchestrator.start({ signal: controller.signal });
    expect((await harness.relayPort.getTools()).some((tool) => tool.origin === RELAY_ORIGIN)).toBe(
      true,
    );

    controller.abort();
    expect((await harness.relayPort.getTools()).some((tool) => tool.origin === RELAY_ORIGIN)).toBe(
      false,
    );

    harness.relayStore.dispatch({ type: "goToStep", step: "verify_contract" });
    harness.completeDemo();
    await harness.bridge.refresh();

    expect((await harness.relayPort.getTools()).some((tool) => tool.origin === RELAY_ORIGIN)).toBe(
      false,
    );
  });
});

describe("get_transfer_review", () => {
  it("fails with DRAFT_NOT_PREPARED before preparation", async () => {
    const harness = await harnessAtPreview();
    const result = await harness.invoke("get_transfer_review", {});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("DRAFT_NOT_PREPARED");
    }
  });

  it("fails closed when Orbit's draft is not the recorded target draft", async () => {
    const harness = await harnessAtPreview();
    harness.relayStore.dispatch({
      type: "resolveDecision",
      ruleId: "rule-overflow",
      alternativeId: "external_form",
      resolvedAt: NOW,
    });
    const previewHash = harness.relayStore.getState().preview?.previewHash ?? "";
    await harness.invoke("prepare_target_draft", { contractId: "contract-live-1", previewHash });

    const realDraft = structuredClone(harness.orbitStore.getState().draft);
    harness.relayPort.removeRemoteTool(ORBIT_ORIGIN, "read_event_draft");
    harness.relayPort.addRemoteTool(
      { name: "read_event_draft", description: "tampered", origin: ORBIT_ORIGIN },
      async () =>
        JSON.stringify(
          toolSuccess({
            provider: "orbit",
            demoSessionId: harness.relayStore.getState().demoSessionId,
            draft: { ...realDraft, draftId: "orbit-draft-other" },
            publication: "draft",
          }),
        ),
    );
    await harness.bridge.refresh();

    const result = await harness.invoke("get_transfer_review", {});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("STALE_PREVIEW");
    }
  });

  it("fails closed when Orbit's draft disagrees with the recorded human decisions", async () => {
    const harness = await harnessAtPreview();
    harness.relayStore.dispatch({
      type: "resolveDecision",
      ruleId: "rule-overflow",
      alternativeId: "external_form",
      resolvedAt: NOW,
    });
    const previewHash = harness.relayStore.getState().preview?.previewHash ?? "";
    await harness.invoke("prepare_target_draft", { contractId: "contract-live-1", previewHash });

    const realDraft = structuredClone(harness.orbitStore.getState().draft);
    harness.relayPort.removeRemoteTool(ORBIT_ORIGIN, "read_event_draft");
    harness.relayPort.addRemoteTool(
      { name: "read_event_draft", description: "tampered", origin: ORBIT_ORIGIN },
      async () =>
        JSON.stringify(
          toolSuccess({
            provider: "orbit",
            demoSessionId: harness.relayStore.getState().demoSessionId,
            draft: {
              ...realDraft,
              values: {
                ...(realDraft as unknown as { values: Record<string, unknown> }).values,
                "registration.overflow.mode": "close_registration",
              },
            },
            publication: "draft",
          }),
        ),
    );
    await harness.bridge.refresh();

    const result = await harness.invoke("get_transfer_review", {});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("STALE_PREVIEW");
    }
  });

  it("reports the calculated review without mutating Relay or Orbit state", async () => {
    const harness = await harnessAtPreview();
    harness.relayStore.dispatch({
      type: "resolveDecision",
      ruleId: "rule-overflow",
      alternativeId: "external_form",
      resolvedAt: NOW,
    });
    const previewHash = harness.relayStore.getState().preview?.previewHash ?? "";
    await harness.invoke("prepare_target_draft", {
      contractId: "contract-live-1",
      previewHash,
    });

    const relayBefore = structuredClone(harness.relayStore.getState());
    const orbitBefore = structuredClone(harness.orbitStore.getState());
    const result = await harness.invoke("get_transfer_review", {});
    expect(result.ok).toBe(true);
    if (result.ok) {
      const data = result.data as {
        contractId: string;
        contractRevision: number;
        targetProvider: string;
        targetDraftId: string;
        mappingCounts: Record<string, number>;
        entries: unknown[];
        humanResolutions: unknown[];
        publication: string;
      };
      expect(data.contractId).toBe("contract-live-1");
      expect(data.targetProvider).toBe("orbit");
      expect(data.targetDraftId).toBe(harness.orbitStore.getState().draft?.draftId);
      expect(data.mappingCounts).toEqual({
        direct: 5,
        transformed: 2,
        unsupported: 1,
        needs_decision: 1,
      });
      expect(data.entries).toHaveLength(9);
      expect(data.humanResolutions).toHaveLength(1);
      expect(data.publication).toBe("waiting_for_human");
    }
    expect(harness.relayStore.getState()).toEqual(relayBefore);
    expect(harness.orbitStore.getState()).toEqual(orbitBefore);
  });
});

describe("registration lifecycle through the port", () => {
  async function relayLocalToolNames(port: FakeModelContext): Promise<string[]> {
    return (await port.getTools())
      .filter((tool) => tool.origin === RELAY_ORIGIN)
      .map((tool) => tool.name);
  }

  it("registers and unregisters agent tools as prerequisites change", async () => {
    const harness = await createHarness();
    const controller = new AbortController();
    harness.orchestrator.start({ signal: controller.signal });
    expect(await relayLocalToolNames(harness.relayPort)).toEqual(["inspect_source_demonstration"]);

    harness.completeDemo();
    const inspection = await harness.invoke("inspect_source_demonstration", {});
    expect(inspection.ok).toBe(true);
    expect(await relayLocalToolNames(harness.relayPort)).toEqual([
      "inspect_source_demonstration",
      "save_intent_contract_draft",
    ]);

    await harness.saveLiveProposal();
    harness.approveContractAsHuman();
    expect(await relayLocalToolNames(harness.relayPort)).toContain("inspect_target_compatibility");

    controller.abort();
    expect(await relayLocalToolNames(harness.relayPort)).toEqual([]);
  });

  it("executes a registered relay tool through the consumer JSON boundary", async () => {
    const harness = await createHarness();
    const controller = new AbortController();
    harness.orchestrator.start({ signal: controller.signal });
    harness.completeDemo();
    const tool = (await harness.relayPort.getTools()).find(
      (candidate: DiscoveredTool) =>
        candidate.origin === RELAY_ORIGIN && candidate.name === "inspect_source_demonstration",
    );
    expect(tool).toBeDefined();
    const result = await executeJsonTool(harness.relayPort, tool as DiscoveredTool, {});
    expect(result.ok).toBe(true);
    controller.abort();
  });
});
