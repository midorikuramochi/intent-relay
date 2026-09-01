import { describe, expect, it } from "vitest";
import type { IntentContract } from "./types";
import { approveContractByHuman, reviseApprovedContract } from "./contractReducer";

function draftContract(): IntentContract {
  return {
    version: "0.1",
    id: "contract-1",
    revision: 1,
    domain: "event",
    status: "draft",
    source: {
      provider: "gather",
      traceId: "trace-1",
      capturedAt: "2026-08-29T00:10:00.000Z",
    },
    rules: [
      {
        id: "rule-capacity",
        kind: "constraint",
        semanticKey: "registration.capacity.maximum",
        value: 100,
        enforcement: "must",
        provenance: ["act-3"],
        humanStatus: "approved",
      },
      {
        id: "rule-publish",
        kind: "approval_boundary",
        semanticKey: "event.publish",
        value: "human_confirmation_required",
        enforcement: "human_required",
        provenance: ["act-9"],
        humanStatus: "approved",
      },
    ],
  };
}

describe("approveContractByHuman", () => {
  it("approves only through the human transition", () => {
    const approved = approveContractByHuman(draftContract(), "2026-08-29T00:00:00.000Z");
    expect(approved.status).toBe("approved");
    expect(approved.approvedAt).toBe("2026-08-29T00:00:00.000Z");
  });

  it("does not mutate the draft it approves", () => {
    const draft = draftContract();
    approveContractByHuman(draft, "2026-08-29T00:00:00.000Z");
    expect(draft.status).toBe("draft");
    expect(draft.approvedAt).toBeUndefined();
  });

  it("returns a frozen contract that cannot be mutated in place", () => {
    const approved = approveContractByHuman(draftContract(), "2026-08-29T00:00:00.000Z");
    expect(() => {
      (approved as { status: string }).status = "draft";
    }).toThrow(TypeError);
    expect(() => {
      (approved.rules[0] as { value: unknown }).value = 999;
    }).toThrow(TypeError);
    expect(approved.status).toBe("approved");
    expect(approved.rules[0]?.value).toBe(100);
  });

  it("rejects approving a contract that is not a draft", () => {
    const approved = approveContractByHuman(draftContract(), "2026-08-29T00:00:00.000Z");
    expect(() => approveContractByHuman(approved, "2026-08-29T01:00:00.000Z")).toThrow(/draft/i);
  });

  it("rejects an invalid approval timestamp", () => {
    expect(() => approveContractByHuman(draftContract(), "yesterday")).toThrow(/timestamp/i);
  });

  it("rejects approval while at least one rule remains proposed", () => {
    const draft = draftContract();
    const withProposedRule: IntentContract = {
      ...draft,
      rules: draft.rules.map((rule, index) =>
        index === 0 ? { ...rule, humanStatus: "proposed" } : rule,
      ),
    };
    expect(() => approveContractByHuman(withProposedRule, "2026-08-29T00:00:00.000Z")).toThrow(
      /proposed/i,
    );
  });

  it("approves when every rule is approved or excluded", () => {
    const draft = draftContract();
    const withExcludedRule: IntentContract = {
      ...draft,
      rules: draft.rules.map((rule, index) =>
        index === 0 ? { ...rule, humanStatus: "excluded" } : rule,
      ),
    };
    const approved = approveContractByHuman(withExcludedRule, "2026-08-29T00:00:00.000Z");
    expect(approved.status).toBe("approved");
    expect(approved.rules[0]?.humanStatus).toBe("excluded");
    expect(approved.rules[1]?.humanStatus).toBe("approved");
  });
});

describe("reviseApprovedContract", () => {
  it("returns a new draft with an incremented revision and no approval timestamp", () => {
    const approved = approveContractByHuman(draftContract(), "2026-08-29T00:00:00.000Z");
    const revised = reviseApprovedContract(approved);
    expect(revised.revision).toBe(approved.revision + 1);
    expect(revised.status).toBe("draft");
    expect(revised.approvedAt).toBeUndefined();
    expect("approvedAt" in revised).toBe(false);
  });

  it("does not mutate the approved contract it revises", () => {
    const approved = approveContractByHuman(draftContract(), "2026-08-29T00:00:00.000Z");
    reviseApprovedContract(approved);
    expect(approved.status).toBe("approved");
    expect(approved.revision).toBe(1);
    expect(approved.approvedAt).toBe("2026-08-29T00:00:00.000Z");
  });

  it("preserves approval-boundary rules in the revision", () => {
    const approved = approveContractByHuman(draftContract(), "2026-08-29T00:00:00.000Z");
    const revised = reviseApprovedContract(approved);
    const boundary = revised.rules.find((rule) => rule.kind === "approval_boundary");
    expect(boundary).toMatchObject({
      id: "rule-publish",
      semanticKey: "event.publish",
      enforcement: "human_required",
    });
    expect(revised.rules).toHaveLength(approved.rules.length);
  });

  it("rejects revising a contract that is not approved", () => {
    expect(() => reviseApprovedContract(draftContract())).toThrow(/approved/i);
  });

  it("returns a frozen revision", () => {
    const approved = approveContractByHuman(draftContract(), "2026-08-29T00:00:00.000Z");
    const revised = reviseApprovedContract(approved);
    expect(() => {
      (revised as { revision: number }).revision = 99;
    }).toThrow(TypeError);
    expect(revised.revision).toBe(2);
  });
});
