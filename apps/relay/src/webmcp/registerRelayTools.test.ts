import { describe, expect, it } from "vitest";
import { studentAiWorkshopTrace } from "@intent-relay/fixtures";
import { createInitialRelayState } from "../domain/reducer";
import type { RelayState } from "../domain/types";
import { RELAY_TOOL_META, relayToolNamesFor, type RelayToolView } from "./registerRelayTools";

const toolNamesFor = relayToolNamesFor;

function view(overrides: Partial<RelayToolView> = {}): RelayToolView {
  return {
    gatherConnected: false,
    orbitConnected: false,
    trace: null,
    state: createInitialRelayState("session-view-0001"),
    ...overrides,
  };
}

const emptyRelayState = view();
const connectedSourceState = view({ gatherConnected: true });
const completedTraceState = view({ gatherConnected: true, trace: studentAiWorkshopTrace });

function approvedState(): RelayState {
  const state = createInitialRelayState("session-view-0001");
  return {
    ...state,
    activeContract: {
      version: "0.1",
      id: "contract-x",
      revision: 1,
      domain: "event",
      status: "approved",
      source: { provider: "gather", traceId: "trace-x", capturedAt: "2026-08-30T00:00:00.000Z" },
      rules: [],
      approvedAt: "2026-08-30T00:00:00.000Z",
    },
  };
}

const reviewReadyState = view({
  gatherConnected: true,
  orbitConnected: true,
  trace: studentAiWorkshopTrace,
  state: {
    ...approvedState(),
    preview: {
      contractId: "contract-x",
      contractRevision: 1,
      targetProvider: "orbit",
      targetCapabilityVersion: "orbit-event-v1",
      mappings: [],
      previewHash: "a".repeat(64),
      createdAt: "2026-08-30T00:00:00.000Z",
    },
    targetDraft: { draftId: "orbit-draft-x", revision: 1, publication: "draft" },
  },
});

describe("relayToolNamesFor", () => {
  it("registers tools only when their prerequisites exist", () => {
    expect(toolNamesFor(emptyRelayState)).toEqual([]);
    expect(toolNamesFor(connectedSourceState)).toEqual(["inspect_source_demonstration"]);
    expect(toolNamesFor(completedTraceState)).toEqual([
      "inspect_source_demonstration",
      "save_intent_contract_draft",
    ]);
  });

  it("requires an approved contract and a connected Orbit for compatibility inspection", () => {
    const approvedButOffline = view({
      gatherConnected: true,
      trace: studentAiWorkshopTrace,
      state: approvedState(),
    });
    expect(toolNamesFor(approvedButOffline)).not.toContain("inspect_target_compatibility");
    const approvedOnline = view({
      gatherConnected: true,
      orbitConnected: true,
      trace: studentAiWorkshopTrace,
      state: approvedState(),
    });
    expect(toolNamesFor(approvedOnline)).toContain("inspect_target_compatibility");
    expect(toolNamesFor(approvedOnline)).not.toContain("prepare_target_draft");
  });

  it("exposes all five tools in review-ready state and never more", () => {
    expect(toolNamesFor(reviewReadyState)).toEqual([
      "inspect_source_demonstration",
      "save_intent_contract_draft",
      "inspect_target_compatibility",
      "prepare_target_draft",
      "get_transfer_review",
    ]);
  });

  it("never registers a publish tool", () => {
    expect(toolNamesFor(reviewReadyState).some((name) => name.includes("publish"))).toBe(false);
  });

  it("never exposes approval, decision, revision, or exclusion behavior as a tool", () => {
    const names = Object.keys(RELAY_TOOL_META);
    expect(names).toHaveLength(5);
    for (const forbidden of ["publish", "activate", "approve", "resolve", "revise", "exclude"]) {
      expect(names.some((name) => name.includes(forbidden))).toBe(false);
    }
  });

  it("declares strict input schemas and read-only annotations where required", () => {
    for (const meta of Object.values(RELAY_TOOL_META)) {
      expect(meta.inputSchema.type).toBe("object");
      expect(meta.inputSchema.additionalProperties).toBe(false);
      expect(meta.description.length).toBeGreaterThan(10);
    }
    expect(RELAY_TOOL_META.inspect_source_demonstration.annotations?.readOnlyHint).toBe(true);
    expect(RELAY_TOOL_META.get_transfer_review.annotations?.readOnlyHint).toBe(true);
    expect(RELAY_TOOL_META.save_intent_contract_draft.inputSchema.required).toEqual(["contract"]);
    expect(RELAY_TOOL_META.inspect_target_compatibility.inputSchema.required).toEqual([
      "contractId",
    ]);
    expect(RELAY_TOOL_META.prepare_target_draft.inputSchema.required).toEqual([
      "contractId",
      "previewHash",
    ]);
  });
});
