import { z } from "zod";
import type { GatherState } from "./types";

const SESSION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9-]{7,63}$/;

export function isValidDemoSessionId(value: string): boolean {
  return SESSION_ID_PATTERN.test(value);
}

export function parseDemoSessionId(search: string): string {
  const value = new URLSearchParams(search).get("demoSessionId");
  if (value === null || value === "") {
    throw new Error(
      "Missing demoSessionId: open Gather through the Intent Relay Workbench so it can namespace this demo session",
    );
  }
  if (!isValidDemoSessionId(value)) {
    throw new Error(
      "Malformed demoSessionId: the session ID must be 8-64 letters, digits, or hyphens",
    );
  }
  return value;
}

export function storageKeyFor(demoSessionId: string): string {
  return `intent-relay:gather:${demoSessionId}:state`;
}

const scheduleSchema = z.strictObject({
  start: z.string().min(1),
  end: z.string().min(1),
  timezone: z.string().min(1),
});

const persistedGatherStateSchema = z.strictObject({
  demoSessionId: z.string().min(1),
  event: z.strictObject({
    title: z.string().nullable(),
    schedule: scheduleSchema.nullable(),
    capacity: z.number().int().positive().nullable(),
    ticketMode: z.enum(["free", "paid"]).nullable(),
    reminderHours: z.number().int().positive().nullable(),
    accessibilityNote: z.string().nullable(),
    overflowMode: z.enum(["native_waitlist", "close_registration"]).nullable(),
    dietaryQuestion: z.enum(["optional", "required"]).nullable(),
    publicationReview: z.boolean(),
    revision: z.number().int().min(0),
  }),
  trace: z.strictObject({
    id: z.string().min(1),
    eventRevision: z.number().int().min(0),
    completed: z.boolean(),
    actions: z.array(
      z.strictObject({
        id: z.string().min(1),
        timestamp: z.string().min(1),
        actor: z.literal("human"),
        command: z.string().min(1),
        semanticKey: z.string().min(1),
        before: z.unknown(),
        after: z.unknown(),
      }),
    ),
  }),
});

export function loadGatherState(storage: Storage, demoSessionId: string): GatherState | null {
  const raw = storage.getItem(storageKeyFor(demoSessionId));
  if (raw === null) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const result = persistedGatherStateSchema.safeParse(parsed);
  if (!result.success || result.data.demoSessionId !== demoSessionId) {
    return null;
  }
  return result.data as GatherState;
}

export function saveGatherState(storage: Storage, state: GatherState): void {
  storage.setItem(storageKeyFor(state.demoSessionId), JSON.stringify(state));
}
