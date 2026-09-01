import { describe, expect, it } from "vitest";
import {
  approvedStudentAiWorkshopContract,
  orbitCapabilities,
  proposedStudentAiWorkshopContract,
} from "@intent-relay/fixtures";
import { mapContract } from "@intent-relay/mapping";
import { createInitialRelayState, reduceRelay, unresolvedDecisions } from "./reducer";
import type { RelayState } from "./types";
import {
  createRelayStore,
  generateDemoSessionId,
  loadRelayState,
  rotateDemoSession,
  saveRelayState,
  storageKeyFor,
} from "./storage";

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

const NOW = "2026-08-30T01:00:00.000Z";

const initial = createInitialRelayState("session-a1234567");

function stateWithDraftContract(): RelayState {
  let state = reduceRelay(initial, {
    type: "saveContractDraft",
    contract: proposedStudentAiWorkshopContract,
  });
  for (const rule of proposedStudentAiWorkshopContract.rules) {
    state = reduceRelay(state, {
      type: "setRuleStatus",
      ruleId: rule.id,
      humanStatus: "approved",
    });
  }
  return state;
}

async function stateWithPreview(): Promise<RelayState> {
  const approvedState = reduceRelay(stateWithDraftContract(), {
    type: "approveContractByHuman",
    approvedAt: NOW,
  });
  const preview = await mapContract(
    approvedState.activeContract ?? approvedStudentAiWorkshopContract,
    orbitCapabilities,
    NOW,
  );
  return reduceRelay(approvedState, { type: "savePreview", preview });
}

describe("reduceRelay", () => {
  it("rotates the session and clears Relay-owned state", async () => {
    const populatedRelayState = await stateWithPreview();
    const next = reduceRelay(populatedRelayState, { type: "resetDemo", sessionId: "session-b" });
    expect(next.demoSessionId).toBe("session-b");
    expect(next.contracts).toEqual([]);
    expect(next.preview).toBeNull();
    expect(next.activeContract).toBeNull();
    expect(next.resolutions).toEqual([]);
    expect(next.step).toBe("demonstrate");
  });

  it("requires a human action to approve the active contract", () => {
    const next = reduceRelay(stateWithDraftContract(), {
      type: "approveContractByHuman",
      approvedAt: "2026-08-29T00:00:00.000Z",
    });
    expect(next.activeContract?.status).toBe("approved");
    expect(next.activeContract?.approvedAt).toBe("2026-08-29T00:00:00.000Z");
  });

  it("refuses contract approval while any rule remains proposed", () => {
    const withProposed = reduceRelay(initial, {
      type: "saveContractDraft",
      contract: proposedStudentAiWorkshopContract,
    });
    expect(() =>
      reduceRelay(withProposed, { type: "approveContractByHuman", approvedAt: NOW }),
    ).toThrow(/proposed/i);
  });

  it("saves a draft contract, resets stale transfer state, and moves to verify", async () => {
    const populated = await stateWithPreview();
    const secondContract = {
      ...structuredClone(proposedStudentAiWorkshopContract),
      id: "contract-second-demonstration",
    };
    const next = reduceRelay(populated, {
      type: "saveContractDraft",
      contract: secondContract,
    });
    expect(next.activeContract?.id).toBe("contract-second-demonstration");
    expect(next.activeContract?.status).toBe("draft");
    expect(next.preview).toBeNull();
    expect(next.resolutions).toEqual([]);
    expect(next.targetDraft).toBeNull();
    expect(next.step).toBe("verify_contract");
    expect(next.contracts.length).toBeGreaterThan(1);
  });

  it("rejects overwriting an approved revision with a draft of the same revision", () => {
    const approvedState = reduceRelay(stateWithDraftContract(), {
      type: "approveContractByHuman",
      approvedAt: NOW,
    });
    expect(() =>
      reduceRelay(approvedState, {
        type: "saveContractDraft",
        contract: proposedStudentAiWorkshopContract,
      }),
    ).toThrow(/approved/i);
    expect(approvedState.activeContract?.status).toBe("approved");
    expect(
      approvedState.contracts.find(
        (candidate) =>
          candidate.id === proposedStudentAiWorkshopContract.id && candidate.revision === 1,
      )?.status,
    ).toBe("approved");
    const revised = reduceRelay(approvedState, { type: "reviseContract" });
    expect(revised.activeContract?.status).toBe("draft");
    expect(revised.activeContract?.revision).toBe(2);
  });

  it("rejects saving a contract that claims to be approved", () => {
    expect(() =>
      reduceRelay(initial, {
        type: "saveContractDraft",
        contract: approvedStudentAiWorkshopContract,
      }),
    ).toThrow(/draft/i);
  });

  it("rejects an agent-invented next revision after approval without human revise", () => {
    const approvedState = reduceRelay(stateWithDraftContract(), {
      type: "approveContractByHuman",
      approvedAt: NOW,
    });
    const inventedRevision = {
      ...structuredClone(proposedStudentAiWorkshopContract),
      revision: 2,
    };
    expect(() =>
      reduceRelay(approvedState, { type: "saveContractDraft", contract: inventedRevision }),
    ).toThrow(/revise/i);
    expect(approvedState.activeContract?.status).toBe("approved");
    expect(approvedState.activeContract?.revision).toBe(1);
  });

  it("allows saving an updated proposal into the human-opened draft revision", () => {
    const approvedState = reduceRelay(stateWithDraftContract(), {
      type: "approveContractByHuman",
      approvedAt: NOW,
    });
    const revisedState = reduceRelay(approvedState, { type: "reviseContract" });
    expect(revisedState.activeContract?.revision).toBe(2);
    expect(revisedState.activeContract?.status).toBe("draft");

    const updatedProposal = {
      ...structuredClone(proposedStudentAiWorkshopContract),
      revision: 2,
    };
    const next = reduceRelay(revisedState, {
      type: "saveContractDraft",
      contract: updatedProposal,
    });
    expect(next.activeContract?.revision).toBe(2);
    expect(next.activeContract?.status).toBe("draft");
    expect(next.preview).toBeNull();

    const skipped = { ...structuredClone(proposedStudentAiWorkshopContract), revision: 3 };
    expect(() => reduceRelay(next, { type: "saveContractDraft", contract: skipped })).toThrow(
      /revise/i,
    );
  });

  it("allows the initial draft revision for a new contract id", () => {
    const next = reduceRelay(initial, {
      type: "saveContractDraft",
      contract: proposedStudentAiWorkshopContract,
    });
    expect(next.activeContract?.id).toBe(proposedStudentAiWorkshopContract.id);
    expect(next.activeContract?.revision).toBe(1);
    expect(next.activeContract?.status).toBe("draft");
  });

  it("lets the human approve or exclude individual rules immutably", () => {
    const saved = reduceRelay(initial, {
      type: "saveContractDraft",
      contract: proposedStudentAiWorkshopContract,
    });
    const next = reduceRelay(saved, {
      type: "setRuleStatus",
      ruleId: "rule-dietary",
      humanStatus: "excluded",
    });
    const rule = next.activeContract?.rules.find((candidate) => candidate.id === "rule-dietary");
    expect(rule?.humanStatus).toBe("excluded");
    const original = saved.activeContract?.rules.find(
      (candidate) => candidate.id === "rule-dietary",
    );
    expect(original?.humanStatus).toBe("proposed");
  });

  it("rejects rule review without a draft contract", () => {
    expect(() =>
      reduceRelay(initial, {
        type: "setRuleStatus",
        ruleId: "rule-title",
        humanStatus: "approved",
      }),
    ).toThrow(/contract/i);
    const approved = reduceRelay(stateWithDraftContract(), {
      type: "approveContractByHuman",
      approvedAt: NOW,
    });
    expect(() =>
      reduceRelay(approved, {
        type: "setRuleStatus",
        ruleId: "rule-title",
        humanStatus: "excluded",
      }),
    ).toThrow(/draft/i);
  });

  it("revises an approved contract into a fresh draft revision", () => {
    const approved = reduceRelay(stateWithDraftContract(), {
      type: "approveContractByHuman",
      approvedAt: NOW,
    });
    const revised = reduceRelay(approved, { type: "reviseContract" });
    expect(revised.activeContract?.status).toBe("draft");
    expect(revised.activeContract?.revision).toBe(2);
    expect(revised.preview).toBeNull();
    expect(revised.step).toBe("verify_contract");
  });

  it("stores a preview only for the approved active contract revision", async () => {
    const approvedState = reduceRelay(stateWithDraftContract(), {
      type: "approveContractByHuman",
      approvedAt: NOW,
    });
    const preview = await mapContract(
      approvedState.activeContract ?? approvedStudentAiWorkshopContract,
      orbitCapabilities,
      NOW,
    );
    const next = reduceRelay(approvedState, { type: "savePreview", preview });
    expect(next.preview?.previewHash).toBe(preview.previewHash);
    expect(next.step).toBe("transfer");

    const mismatched = { ...preview, contractRevision: preview.contractRevision + 1 };
    expect(() => reduceRelay(approvedState, { type: "savePreview", preview: mismatched })).toThrow(
      /revision/i,
    );
    const draftState = stateWithDraftContract();
    expect(() => reduceRelay(draftState, { type: "savePreview", preview })).toThrow(/approved/i);
  });

  it("keeps needs_decision entries blocking until the human resolves them", async () => {
    const withPreview = await stateWithPreview();
    expect(unresolvedDecisions(withPreview).map((entry) => entry.ruleId)).toEqual([
      "rule-overflow",
    ]);
    const resolved = reduceRelay(withPreview, {
      type: "resolveDecision",
      ruleId: "rule-overflow",
      alternativeId: "external_form",
      resolvedAt: NOW,
    });
    expect(unresolvedDecisions(resolved)).toEqual([]);
    expect(resolved.resolutions).toEqual([
      { ruleId: "rule-overflow", alternativeId: "external_form", resolvedAt: NOW },
    ]);
  });

  it("never resolves a decision on the user's behalf and validates the choice", async () => {
    const withPreview = await stateWithPreview();
    expect(withPreview.resolutions).toEqual([]);
    expect(() =>
      reduceRelay(withPreview, {
        type: "resolveDecision",
        ruleId: "rule-title",
        alternativeId: "external_form",
        resolvedAt: NOW,
      }),
    ).toThrow(/needs_decision/i);
    expect(() =>
      reduceRelay(withPreview, {
        type: "resolveDecision",
        ruleId: "rule-overflow",
        alternativeId: "invent_waitlist",
        resolvedAt: NOW,
      }),
    ).toThrow(/alternative/i);
  });

  it("replaces an earlier resolution for the same rule", async () => {
    const withPreview = await stateWithPreview();
    const first = reduceRelay(withPreview, {
      type: "resolveDecision",
      ruleId: "rule-overflow",
      alternativeId: "close_registration",
      resolvedAt: NOW,
    });
    const second = reduceRelay(first, {
      type: "resolveDecision",
      ruleId: "rule-overflow",
      alternativeId: "external_form",
      resolvedAt: "2026-08-30T02:00:00.000Z",
    });
    expect(second.resolutions).toHaveLength(1);
    expect(second.resolutions[0]?.alternativeId).toBe("external_form");
  });

  it("locks Human Queue decisions once a target draft is recorded", async () => {
    const withPreview = await stateWithPreview();
    const resolved = reduceRelay(withPreview, {
      type: "resolveDecision",
      ruleId: "rule-overflow",
      alternativeId: "external_form",
      resolvedAt: NOW,
    });
    const prepared = reduceRelay(resolved, {
      type: "recordTargetDraft",
      draft: { draftId: "orbit-draft-abc", revision: 1, publication: "draft" },
    });
    expect(() =>
      reduceRelay(prepared, {
        type: "resolveDecision",
        ruleId: "rule-overflow",
        alternativeId: "close_registration",
        resolvedAt: NOW,
      }),
    ).toThrow(/locked/i);
  });

  it("rejects recording a target draft without a compatibility preview", () => {
    const noPreview = stateWithDraftContract();
    expect(() =>
      reduceRelay(noPreview, {
        type: "recordTargetDraft",
        draft: { draftId: "orbit-draft-abc", revision: 1, publication: "draft" },
      }),
    ).toThrow(/preview/i);
  });

  it("rejects recording a target draft while a decision remains unresolved", async () => {
    const withPreview = await stateWithPreview();
    expect(unresolvedDecisions(withPreview)).toHaveLength(1);
    expect(() =>
      reduceRelay(withPreview, {
        type: "recordTargetDraft",
        draft: { draftId: "orbit-draft-abc", revision: 1, publication: "draft" },
      }),
    ).toThrow(/decision/i);
  });

  it("records the target draft and moves to review once every decision is resolved", async () => {
    const withPreview = await stateWithPreview();
    const resolved = reduceRelay(withPreview, {
      type: "resolveDecision",
      ruleId: "rule-overflow",
      alternativeId: "external_form",
      resolvedAt: NOW,
    });
    const next = reduceRelay(resolved, {
      type: "recordTargetDraft",
      draft: { draftId: "orbit-draft-abc", revision: 1, publication: "draft" },
    });
    expect(next.targetDraft?.draftId).toBe("orbit-draft-abc");
    expect(next.step).toBe("review");
  });
});

describe("session rotation and storage", () => {
  it("generates distinct cryptographically random session IDs", () => {
    const first = generateDemoSessionId();
    const second = generateDemoSessionId();
    expect(first).toMatch(/^session-[0-9a-f]{24}$/);
    expect(second).toMatch(/^session-[0-9a-f]{24}$/);
    expect(first).not.toBe(second);
  });

  it("rotates the stored session pointer", () => {
    const storage = new MemoryStorage();
    const first = rotateDemoSession(storage);
    const second = rotateDemoSession(storage);
    expect(first).not.toBe(second);
    expect(storage.getItem("intent-relay:relay:currentSession")).toBe(second);
  });

  it("round-trips relay state through session-scoped storage", async () => {
    const storage = new MemoryStorage();
    const state = await stateWithPreview();
    saveRelayState(storage, state);
    expect(storageKeyFor(state.demoSessionId)).toBe(
      `intent-relay:relay:${state.demoSessionId}:state`,
    );
    expect(loadRelayState(storage, state.demoSessionId)).toEqual(state);
    expect(loadRelayState(storage, "session-elsewhere")).toBeNull();
  });

  it("returns null for corrupt persisted state", () => {
    const storage = new MemoryStorage();
    storage.setItem(storageKeyFor("session-a1234567"), "{broken");
    expect(loadRelayState(storage, "session-a1234567")).toBeNull();
  });

  it("resets the demo through the store and clears prior state", () => {
    const storage = new MemoryStorage();
    const store = createRelayStore({ storage });
    const before = store.getState().demoSessionId;
    store.dispatch({ type: "saveContractDraft", contract: proposedStudentAiWorkshopContract });
    const after = store.resetDemo();
    expect(after.demoSessionId).not.toBe(before);
    expect(after.contracts).toEqual([]);
    const reloaded = createRelayStore({ storage });
    expect(reloaded.getState().demoSessionId).toBe(after.demoSessionId);
    expect(reloaded.getState().contracts).toEqual([]);
  });
});
