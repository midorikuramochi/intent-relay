import { describe, expect, it } from "vitest";
import { approveContractByHuman, validateContractDraft } from "@intent-relay/contracts";
import type { MappingEntry, MappingStatus } from "@intent-relay/protocol";
import {
  approvedStudentAiWorkshopContract,
  expectedStudentAiWorkshopMapping,
  orbitCapabilities,
  proposedStudentAiWorkshopContract,
  studentAiWorkshopTrace,
} from "@intent-relay/fixtures";
import { mapContract } from "./mapContract";
import { computePreviewHash } from "./previewHash";
import { stableStringify } from "./stableJson";

const NOW = "2026-08-29T01:00:00.000Z";

function countStatuses(mappings: MappingEntry[]): Record<MappingStatus, number> {
  const counts: Record<MappingStatus, number> = {
    direct: 0,
    transformed: 0,
    unsupported: 0,
    needs_decision: 0,
  };
  for (const entry of mappings) {
    counts[entry.status] += 1;
  }
  return counts;
}

describe("canonical fixture", () => {
  it("passes contract draft validation against its own trace", () => {
    const result = validateContractDraft(proposedStudentAiWorkshopContract, studentAiWorkshopTrace);
    expect(result.ok).toBe(true);
  });
});

describe("mapContract", () => {
  it("maps every approved Student AI Workshop rule exactly once", async () => {
    const preview = await mapContract(approvedStudentAiWorkshopContract, orbitCapabilities, NOW);

    expect(preview.mappings).toHaveLength(approvedStudentAiWorkshopContract.rules.length);
    expect(countStatuses(preview.mappings)).toEqual({
      direct: 5,
      transformed: 2,
      unsupported: 1,
      needs_decision: 1,
    });
    expect(preview.mappings.some((entry) => "confidence" in entry)).toBe(false);
  });

  it("preserves rule IDs in order and matches the expected per-rule statuses", async () => {
    const preview = await mapContract(approvedStudentAiWorkshopContract, orbitCapabilities, NOW);
    expect(preview.mappings.map((entry) => entry.ruleId)).toEqual(
      approvedStudentAiWorkshopContract.rules.map((rule) => rule.id),
    );
    for (const entry of preview.mappings) {
      expect(entry.status).toBe(
        expectedStudentAiWorkshopMapping[
          entry.ruleId as keyof typeof expectedStudentAiWorkshopMapping
        ],
      );
    }
  });

  it("transforms the 24-hour reminder into a 1-day reminder", async () => {
    const preview = await mapContract(approvedStudentAiWorkshopContract, orbitCapabilities, NOW);
    const reminder = preview.mappings.find((entry) => entry.ruleId === "rule-reminder");
    expect(reminder).toMatchObject({
      status: "transformed",
      targetCapability: "notifications.reminder.offset",
      proposedValue: 1,
      transformation: { id: "hours-to-whole-days" },
    });
  });

  it("transforms the attendee accessibility note into Orbit's venue note", async () => {
    const preview = await mapContract(approvedStudentAiWorkshopContract, orbitCapabilities, NOW);
    const note = preview.mappings.find((entry) => entry.ruleId === "rule-accessibility");
    expect(note).toMatchObject({
      status: "transformed",
      targetCapability: "accessibility.venue_note",
      proposedValue: "Explain that the venue entrance has steps",
      transformation: { id: "attendee-note-to-venue-note" },
    });
  });

  it("classifies the dietary question as unsupported with a reason, never omitting it", async () => {
    const preview = await mapContract(approvedStudentAiWorkshopContract, orbitCapabilities, NOW);
    const dietary = preview.mappings.find((entry) => entry.ruleId === "rule-dietary");
    expect(dietary?.status).toBe("unsupported");
    expect(dietary?.reason).toBeTruthy();
  });

  it("classifies the native waitlist as needs_decision with both Orbit alternatives", async () => {
    const preview = await mapContract(approvedStudentAiWorkshopContract, orbitCapabilities, NOW);
    const overflow = preview.mappings.find((entry) => entry.ruleId === "rule-overflow");
    expect(overflow?.status).toBe("needs_decision");
    expect(overflow?.alternatives?.map((alternative) => alternative.id)).toEqual([
      "close_registration",
      "external_form",
    ]);
    for (const alternative of overflow?.alternatives ?? []) {
      expect(alternative.label).toBeTruthy();
      expect(alternative.consequence).toBeTruthy();
    }
  });

  it("maps the publication approval boundary as direct against a human-only action", async () => {
    const preview = await mapContract(approvedStudentAiWorkshopContract, orbitCapabilities, NOW);
    const publish = preview.mappings.find((entry) => entry.ruleId === "rule-publish");
    expect(publish).toMatchObject({
      status: "direct",
      targetCapability: "event.publish",
    });
  });

  it("produces the same preview hash for identical canonical inputs", async () => {
    const first = await mapContract(approvedStudentAiWorkshopContract, orbitCapabilities, NOW);
    const second = await mapContract(
      approvedStudentAiWorkshopContract,
      orbitCapabilities,
      "2026-08-30T09:30:00.000Z",
    );
    expect(first.previewHash).toBe(second.previewHash);
    expect(first.previewHash).toMatch(/^[0-9a-f]{64}$/);
    expect(first.createdAt).not.toBe(second.createdAt);
  });

  it("changes the hash when the contract revision changes", async () => {
    const baseline = await mapContract(approvedStudentAiWorkshopContract, orbitCapabilities, NOW);
    const revised = structuredClone(approvedStudentAiWorkshopContract);
    revised.revision = 2;
    const preview = await mapContract(revised, orbitCapabilities, NOW);
    expect(preview.previewHash).not.toBe(baseline.previewHash);
  });

  it("changes the hash when the capability version changes", async () => {
    const baseline = await mapContract(approvedStudentAiWorkshopContract, orbitCapabilities, NOW);
    const preview = await mapContract(
      approvedStudentAiWorkshopContract,
      { ...orbitCapabilities, version: "orbit-event-v2" },
      NOW,
    );
    expect(preview.previewHash).not.toBe(baseline.previewHash);
  });

  it("rejects a contract that is not approved", async () => {
    await expect(
      mapContract(proposedStudentAiWorkshopContract, orbitCapabilities, NOW),
    ).rejects.toThrow(/approved/i);
  });

  it("rejects an invalid capability manifest", async () => {
    await expect(
      mapContract(
        approvedStudentAiWorkshopContract,
        {
          ...orbitCapabilities,
          humanOnlyActions: ["pricing.change"],
        } as unknown as typeof orbitCapabilities,
        NOW,
      ),
    ).rejects.toThrow(/manifest/i);
  });

  it("does not map rules the human excluded", async () => {
    const resolved = structuredClone(proposedStudentAiWorkshopContract);
    resolved.rules = resolved.rules.map((rule) => ({
      ...rule,
      humanStatus: rule.id === "rule-dietary" ? ("excluded" as const) : ("approved" as const),
    }));
    const contract = approveContractByHuman(resolved, "2026-08-29T00:30:00.000Z");
    const preview = await mapContract(contract, orbitCapabilities, NOW);
    expect(preview.mappings).toHaveLength(contract.rules.length - 1);
    expect(preview.mappings.some((entry) => entry.ruleId === "rule-dietary")).toBe(false);
  });
});

describe("computePreviewHash", () => {
  it("ignores createdAt so a re-timestamped preview keeps its hash", async () => {
    const preview = await mapContract(approvedStudentAiWorkshopContract, orbitCapabilities, NOW);
    const { previewHash, ...withoutHash } = preview;
    const recomputed = await computePreviewHash({
      ...withoutHash,
      createdAt: "2027-01-01T00:00:00.000Z",
    });
    expect(recomputed).toBe(previewHash);
  });
});

describe("stableStringify", () => {
  it("sorts object keys recursively while preserving array order", () => {
    expect(stableStringify({ b: 1, a: { d: [2, 1], c: 3 } })).toBe('{"a":{"c":3,"d":[2,1]},"b":1}');
  });
});
