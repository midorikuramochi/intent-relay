import { z } from "zod";

export const EVENT_SEMANTIC_KEYS = [
  "event.title",
  "event.schedule",
  "registration.capacity.maximum",
  "ticketing.mode",
  "notifications.reminder.offset",
  "accessibility.attendee_note",
  "registration.overflow.mode",
  "registration.custom_question.dietary_restrictions",
  "event.publish",
] as const;

export type EventSemanticKey = (typeof EVENT_SEMANTIC_KEYS)[number];

const isoDateTime = z.iso.datetime({ offset: true });

const eventValueSchemas: Record<EventSemanticKey, z.ZodType> = {
  "event.title": z.string().min(1),
  "event.schedule": z.strictObject({
    start: isoDateTime,
    end: isoDateTime,
    timezone: z.string().min(1),
  }),
  "registration.capacity.maximum": z.number().int().positive(),
  "ticketing.mode": z.enum(["free", "paid"]),
  "notifications.reminder.offset": z.number().int().positive(),
  "accessibility.attendee_note": z.string().min(1),
  "registration.overflow.mode": z.enum(["native_waitlist", "close_registration", "external_form"]),
  "registration.custom_question.dietary_restrictions": z.enum(["optional", "required"]),
  "event.publish": z.literal("human_confirmation_required"),
};

const requiredUnits: Partial<Record<EventSemanticKey, readonly string[]>> = {
  "notifications.reminder.offset": ["minutes", "hours", "days"],
};

const ruleCommon = {
  id: z.string().min(1),
  semanticKey: z.enum(EVENT_SEMANTIC_KEYS),
  value: z.unknown(),
  unit: z.string().min(1).optional(),
  enforcement: z.enum(["must", "prefer", "inform", "human_required"]),
  rationale: z.string().min(1).optional(),
  provenance: z.array(z.string().min(1)).min(1),
  humanStatus: z.enum(["proposed", "approved", "excluded"]),
};

const ruleConditionSchema = z.strictObject({
  semanticKey: z.string().min(1),
  operator: z.enum(["equals", "not_equals", "exists"]),
  value: z.unknown().optional(),
});

function validateRuleValue(
  rule: { semanticKey: EventSemanticKey; value: unknown; unit?: string },
  ctx: z.RefinementCtx,
): void {
  const valueResult = eventValueSchemas[rule.semanticKey].safeParse(rule.value);
  if (!valueResult.success) {
    ctx.addIssue({
      code: "custom",
      path: ["value"],
      message: `Value does not match semantic key "${rule.semanticKey}"`,
    });
  }
  const units = requiredUnits[rule.semanticKey];
  if (units) {
    if (rule.unit === undefined || !units.includes(rule.unit)) {
      ctx.addIssue({
        code: "custom",
        path: ["unit"],
        message: `Semantic key "${rule.semanticKey}" requires a unit of: ${units.join(", ")}`,
      });
    }
  } else if (rule.unit !== undefined) {
    ctx.addIssue({
      code: "custom",
      path: ["unit"],
      message: `Semantic key "${rule.semanticKey}" does not accept a unit`,
    });
  }
}

export const intentRuleSchema = z
  .discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("context"), ...ruleCommon }),
    z.strictObject({ kind: z.literal("constraint"), ...ruleCommon }),
    z.strictObject({ kind: z.literal("preference"), ...ruleCommon }),
    z.strictObject({
      kind: z.literal("conditional"),
      ...ruleCommon,
      condition: ruleConditionSchema,
    }),
    z.strictObject({
      kind: z.literal("approval_boundary"),
      ...ruleCommon,
      enforcement: z.literal("human_required"),
    }),
  ])
  .superRefine(validateRuleValue);

export const intentContractDraftInputSchema = z.strictObject({
  version: z.literal("0.1"),
  id: z.string().min(1),
  revision: z.number().int().min(1),
  domain: z.literal("event"),
  status: z.enum(["draft", "approved"]),
  source: z.strictObject({
    provider: z.literal("gather"),
    traceId: z.string().min(1),
    capturedAt: isoDateTime,
  }),
  rules: z.array(intentRuleSchema).min(1),
  approvedAt: isoDateTime.optional(),
});

export const approvalTimestampSchema = isoDateTime;
