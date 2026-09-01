import {
  approveContractByHuman,
  type IntentContract,
  type IntentRule,
  type SemanticTrace,
} from "@intent-relay/contracts";
import type { MappingStatus } from "@intent-relay/protocol";

export const STUDENT_AI_WORKSHOP_TRACE_ID = "trace-student-ai-workshop";
export const STUDENT_AI_WORKSHOP_CONTRACT_ID = "contract-student-ai-workshop";

const traceEntries = [
  { command: "setTitle", semanticKey: "event.title", after: "Student AI Workshop" },
  {
    command: "setSchedule",
    semanticKey: "event.schedule",
    after: {
      start: "2026-09-18T18:00:00.000+09:00",
      end: "2026-09-18T20:00:00.000+09:00",
      timezone: "Asia/Tokyo",
    },
  },
  { command: "setCapacity", semanticKey: "registration.capacity.maximum", after: 100 },
  { command: "setTicketMode", semanticKey: "ticketing.mode", after: "free" },
  { command: "setReminder", semanticKey: "notifications.reminder.offset", after: 24 },
  {
    command: "setAccessibilityNote",
    semanticKey: "accessibility.attendee_note",
    after: "Explain that the venue entrance has steps",
  },
  {
    command: "setOverflowMode",
    semanticKey: "registration.overflow.mode",
    after: "native_waitlist",
  },
  {
    command: "setDietaryQuestion",
    semanticKey: "registration.custom_question.dietary_restrictions",
    after: "optional",
  },
  {
    command: "requirePublicationReview",
    semanticKey: "event.publish",
    after: "human_confirmation_required",
  },
] as const;

export const studentAiWorkshopTrace: SemanticTrace = {
  id: STUDENT_AI_WORKSHOP_TRACE_ID,
  eventRevision: traceEntries.length,
  completed: true,
  actions: traceEntries.map((entry, index) => ({
    id: `gather-act-${String(index + 1).padStart(2, "0")}`,
    timestamp: `2026-08-29T00:0${index}:00.000Z`,
    actor: "human",
    command: entry.command,
    semanticKey: entry.semanticKey,
    before: null,
    after: entry.after,
  })),
};

const proposedRules: IntentRule[] = [
  {
    id: "rule-title",
    kind: "context",
    semanticKey: "event.title",
    value: "Student AI Workshop",
    enforcement: "inform",
    provenance: ["gather-act-01"],
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
    provenance: ["gather-act-02"],
    humanStatus: "proposed",
  },
  {
    id: "rule-capacity",
    kind: "constraint",
    semanticKey: "registration.capacity.maximum",
    value: 100,
    enforcement: "must",
    provenance: ["gather-act-03"],
    humanStatus: "proposed",
  },
  {
    id: "rule-ticketing",
    kind: "constraint",
    semanticKey: "ticketing.mode",
    value: "free",
    enforcement: "must",
    provenance: ["gather-act-04"],
    humanStatus: "proposed",
  },
  {
    id: "rule-reminder",
    kind: "preference",
    semanticKey: "notifications.reminder.offset",
    value: 24,
    unit: "hours",
    enforcement: "prefer",
    provenance: ["gather-act-05"],
    humanStatus: "proposed",
  },
  {
    id: "rule-accessibility",
    kind: "conditional",
    semanticKey: "accessibility.attendee_note",
    value: "Explain that the venue entrance has steps",
    enforcement: "must",
    provenance: ["gather-act-06"],
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
    provenance: ["gather-act-07"],
    humanStatus: "proposed",
  },
  {
    id: "rule-dietary",
    kind: "preference",
    semanticKey: "registration.custom_question.dietary_restrictions",
    value: "optional",
    enforcement: "prefer",
    provenance: ["gather-act-08"],
    humanStatus: "proposed",
  },
  {
    id: "rule-publish",
    kind: "approval_boundary",
    semanticKey: "event.publish",
    value: "human_confirmation_required",
    enforcement: "human_required",
    provenance: ["gather-act-09"],
    humanStatus: "proposed",
  },
];

export const proposedStudentAiWorkshopContract: IntentContract = {
  version: "0.1",
  id: STUDENT_AI_WORKSHOP_CONTRACT_ID,
  revision: 1,
  domain: "event",
  status: "draft",
  source: {
    provider: "gather",
    traceId: STUDENT_AI_WORKSHOP_TRACE_ID,
    capturedAt: "2026-08-29T00:10:00.000Z",
  },
  rules: proposedRules,
};

export const approvedStudentAiWorkshopContract: IntentContract = approveContractByHuman(
  {
    ...proposedStudentAiWorkshopContract,
    rules: proposedRules.map((rule) => ({ ...rule, humanStatus: "approved" as const })),
  },
  "2026-08-29T00:20:00.000Z",
);

export const expectedStudentAiWorkshopMapping: Record<string, MappingStatus> = {
  "rule-title": "direct",
  "rule-schedule": "direct",
  "rule-capacity": "direct",
  "rule-ticketing": "direct",
  "rule-publish": "direct",
  "rule-reminder": "transformed",
  "rule-accessibility": "transformed",
  "rule-dietary": "unsupported",
  "rule-overflow": "needs_decision",
};
