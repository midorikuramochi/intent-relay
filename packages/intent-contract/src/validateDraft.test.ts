import { describe, expect, it } from "vitest";
import type { IntentContract, IntentRule } from "./types";
import type { SemanticTrace } from "./trace";
import { validateContractDraft } from "./validateDraft";

const canonicalTrace: SemanticTrace = {
  id: "trace-1",
  eventRevision: 9,
  completed: true,
  actions: [
    "setTitle:event.title",
    "setSchedule:event.schedule",
    "setCapacity:registration.capacity.maximum",
    "setTicketMode:ticketing.mode",
    "setReminder:notifications.reminder.offset",
    "setAccessibilityNote:accessibility.attendee_note",
    "setOverflowMode:registration.overflow.mode",
    "setDietaryQuestion:registration.custom_question.dietary_restrictions",
    "requirePublicationReview:event.publish",
  ].map((entry, index) => {
    const [command, semanticKey] = entry.split(":") as [string, string];
    return {
      id: `act-${index + 1}`,
      timestamp: `2026-08-29T00:0${index}:00.000Z`,
      actor: "human" as const,
      command,
      semanticKey,
      before: null,
      after: "sample",
    };
  }),
};

const canonicalRules: IntentRule[] = [
  {
    id: "rule-title",
    kind: "context",
    semanticKey: "event.title",
    value: "Student AI Workshop",
    enforcement: "inform",
    provenance: ["act-1"],
    humanStatus: "proposed",
  },
  {
    id: "rule-schedule",
    kind: "context",
    semanticKey: "event.schedule",
    value: {
      start: "2026-09-18T18:00:00.000+09:00",
      end: "2026-09-18T20:00:00.000+09:00",
      timezone: "Asia/Tokyo",
    },
    enforcement: "inform",
    provenance: ["act-2"],
    humanStatus: "proposed",
  },
  {
    id: "rule-capacity",
    kind: "constraint",
    semanticKey: "registration.capacity.maximum",
    value: 100,
    enforcement: "must",
    provenance: ["act-3"],
    humanStatus: "proposed",
  },
  {
    id: "rule-ticketing",
    kind: "constraint",
    semanticKey: "ticketing.mode",
    value: "free",
    enforcement: "must",
    provenance: ["act-4"],
    humanStatus: "proposed",
  },
  {
    id: "rule-reminder",
    kind: "preference",
    semanticKey: "notifications.reminder.offset",
    value: 24,
    unit: "hours",
    enforcement: "prefer",
    provenance: ["act-5"],
    humanStatus: "proposed",
  },
  {
    id: "rule-accessibility",
    kind: "conditional",
    semanticKey: "accessibility.attendee_note",
    value: "Explain that the venue entrance has steps",
    enforcement: "must",
    provenance: ["act-6"],
    humanStatus: "proposed",
    condition: {
      semanticKey: "venue.entrance.has_steps",
      operator: "equals",
      value: true,
    },
  },
  {
    id: "rule-overflow",
    kind: "preference",
    semanticKey: "registration.overflow.mode",
    value: "native_waitlist",
    enforcement: "prefer",
    provenance: ["act-7"],
    humanStatus: "proposed",
  },
  {
    id: "rule-dietary",
    kind: "preference",
    semanticKey: "registration.custom_question.dietary_restrictions",
    value: "optional",
    enforcement: "prefer",
    provenance: ["act-8"],
    humanStatus: "proposed",
  },
  {
    id: "rule-publish",
    kind: "approval_boundary",
    semanticKey: "event.publish",
    value: "human_confirmation_required",
    enforcement: "human_required",
    provenance: ["act-9"],
    humanStatus: "proposed",
  },
];

const canonicalContract: IntentContract = {
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
  rules: canonicalRules,
};

function contractWithProvenance(...actionIds: string[]): IntentContract {
  return {
    ...canonicalContract,
    rules: canonicalContract.rules.map((rule, index) =>
      index === 0 ? { ...rule, provenance: actionIds } : rule,
    ),
  };
}

describe("validateContractDraft", () => {
  it("accepts a valid version 0.1 event contract", () => {
    const result = validateContractDraft(canonicalContract, canonicalTrace);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.rules).toHaveLength(9);
      expect(result.value.status).toBe("draft");
      expect(result.value.approvedAt).toBeUndefined();
    }
  });

  it("rejects an unknown contract version", () => {
    const result = validateContractDraft({ ...canonicalContract, version: "0.2" }, canonicalTrace);
    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "INVALID_CONTRACT" }),
    });
  });

  it("rejects a rule with an unknown semantic key", () => {
    const rules = canonicalContract.rules.map((rule, index) =>
      index === 0 ? { ...rule, semanticKey: "event.subtitle" } : rule,
    );
    const result = validateContractDraft({ ...canonicalContract, rules }, canonicalTrace);
    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "INVALID_CONTRACT" }),
    });
  });

  it("rejects a rule with no provenance", () => {
    const rules = canonicalContract.rules.map((rule, index) =>
      index === 0 ? { ...rule, provenance: [] } : rule,
    );
    const result = validateContractDraft({ ...canonicalContract, rules }, canonicalTrace);
    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "INVALID_CONTRACT" }),
    });
  });

  it("rejects a rule whose provenance is absent from the active trace", () => {
    const result = validateContractDraft(contractWithProvenance("missing"), canonicalTrace);
    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "UNKNOWN_PROVENANCE" }),
    });
  });

  it("rejects provenance that exists in the trace but supports a different semantic key", () => {
    const result = validateContractDraft(contractWithProvenance("act-3"), canonicalTrace);
    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "UNKNOWN_PROVENANCE" }),
    });
  });

  it("accepts additional cited actions when at least one supports the rule", () => {
    const result = validateContractDraft(contractWithProvenance("act-1", "act-3"), canonicalTrace);
    expect(result.ok).toBe(true);
  });

  it("rejects duplicate rule IDs", () => {
    const rules = canonicalContract.rules.map((rule, index) =>
      index === 1 ? { ...rule, id: canonicalContract.rules[0]!.id } : rule,
    );
    const result = validateContractDraft({ ...canonicalContract, rules }, canonicalTrace);
    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "INVALID_CONTRACT" }),
    });
  });

  it("rejects a contract citing a stale trace ID", () => {
    const staleTrace: SemanticTrace = { ...canonicalTrace, id: "trace-2" };
    const result = validateContractDraft(canonicalContract, staleTrace);
    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "STALE_TRACE" }),
    });
  });

  it("forces an agent-supplied contract to draft", () => {
    const result = validateContractDraft(
      { ...canonicalContract, status: "approved" },
      canonicalTrace,
    );
    expect(result.ok && result.value.status).toBe("draft");
  });

  it("strips an agent-supplied approval timestamp", () => {
    const result = validateContractDraft(
      { ...canonicalContract, status: "approved", approvedAt: "2026-08-29T00:00:00.000Z" },
      canonicalTrace,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.approvedAt).toBeUndefined();
      expect("approvedAt" in result.value).toBe(false);
    }
  });

  it("forces every agent-supplied rule back to the proposed human status", () => {
    const rules = canonicalContract.rules.map((rule) => ({
      ...rule,
      humanStatus: "approved" as const,
    }));
    const result = validateContractDraft({ ...canonicalContract, rules }, canonicalTrace);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.rules.every((rule) => rule.humanStatus === "proposed")).toBe(true);
    }
  });

  it("rejects unknown contract properties", () => {
    const result = validateContractDraft(
      { ...canonicalContract, confidence: 0.97 },
      canonicalTrace,
    );
    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "INVALID_CONTRACT" }),
    });
  });

  it("rejects unknown source properties", () => {
    const result = validateContractDraft(
      {
        ...canonicalContract,
        source: { ...canonicalContract.source, sessionToken: "secret" },
      },
      canonicalTrace,
    );
    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "INVALID_CONTRACT" }),
    });
  });

  it("rejects unknown condition properties", () => {
    const rules = canonicalContract.rules.map((rule) =>
      rule.kind === "conditional"
        ? { ...rule, condition: { ...rule.condition, cssSelector: "#note" } }
        : rule,
    );
    const result = validateContractDraft({ ...canonicalContract, rules }, canonicalTrace);
    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "INVALID_CONTRACT" }),
    });
  });

  it("rejects unknown rule properties", () => {
    const rules = canonicalContract.rules.map((rule, index) =>
      index === 0 ? { ...rule, cssSelector: "#title" } : rule,
    );
    const result = validateContractDraft({ ...canonicalContract, rules }, canonicalTrace);
    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "INVALID_CONTRACT" }),
    });
  });

  it("rejects a value that does not match its semantic key", () => {
    const rules = canonicalContract.rules.map((rule) =>
      rule.semanticKey === "registration.capacity.maximum" ? { ...rule, value: "100" } : rule,
    );
    const result = validateContractDraft({ ...canonicalContract, rules }, canonicalTrace);
    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "INVALID_CONTRACT" }),
    });
  });

  it("rejects a reminder offset without its duration unit", () => {
    const rules = canonicalContract.rules.map((rule) => {
      if (rule.semanticKey !== "notifications.reminder.offset") {
        return rule;
      }
      const rest = { ...rule };
      delete rest.unit;
      return rest;
    });
    const result = validateContractDraft({ ...canonicalContract, rules }, canonicalTrace);
    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "INVALID_CONTRACT" }),
    });
  });

  it("rejects a conditional rule without a condition", () => {
    const rules = canonicalContract.rules.map((rule) => {
      if (rule.kind !== "conditional") {
        return rule;
      }
      const rest = { ...rule };
      delete rest.condition;
      return rest;
    });
    const result = validateContractDraft({ ...canonicalContract, rules }, canonicalTrace);
    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "INVALID_CONTRACT" }),
    });
  });

  it("rejects an approval boundary that is not human_required", () => {
    const rules = canonicalContract.rules.map((rule) =>
      rule.kind === "approval_boundary" ? { ...rule, enforcement: "prefer" } : rule,
    );
    const result = validateContractDraft({ ...canonicalContract, rules }, canonicalTrace);
    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "INVALID_CONTRACT" }),
    });
  });

  it("rejects non-object input", () => {
    const result = validateContractDraft("not a contract", canonicalTrace);
    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "INVALID_CONTRACT" }),
    });
  });

  it("returns a frozen contract that cannot be mutated in place", () => {
    const result = validateContractDraft(canonicalContract, canonicalTrace);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const draft = result.value;
      expect(() => {
        (draft as { status: string }).status = "approved";
      }).toThrow(TypeError);
      expect(() => {
        (draft.rules as IntentRule[]).pop();
      }).toThrow(TypeError);
      expect(draft.status).toBe("draft");
      expect(draft.rules).toHaveLength(9);
    }
  });
});
