import { z } from "zod";
import type { OrbitState } from "./types";

const SESSION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9-]{7,63}$/;

export function isValidDemoSessionId(value: string): boolean {
  return SESSION_ID_PATTERN.test(value);
}

export function parseDemoSessionId(search: string): string {
  const value = new URLSearchParams(search).get("demoSessionId");
  if (value === null || value === "") {
    throw new Error(
      "Missing demoSessionId: open Orbit Events through the Intent Relay Workbench so it can namespace this demo session",
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
  return `intent-relay:orbit:${demoSessionId}:state`;
}

const draftValuesSchema = z
  .object({
    "event.title": z.string().min(1),
    "event.schedule": z.strictObject({
      start: z.string().min(1),
      end: z.string().min(1),
      timezone: z.string().min(1),
    }),
    "registration.capacity.maximum": z.number().positive(),
    "ticketing.mode": z.enum(["free", "paid"]),
    "notifications.reminder.offset": z.number().positive().optional(),
    "accessibility.venue_note": z.string().min(1).optional(),
    "registration.overflow.mode": z.enum(["close_registration", "external_form"]).optional(),
  })
  .strict();

const persistedOrbitStateSchema = z.strictObject({
  demoSessionId: z.string().min(1),
  capabilityVersion: z.string().min(1),
  draft: z
    .strictObject({
      draftId: z.string().min(1),
      revision: z.number().int().positive(),
      previewHash: z.string().regex(/^[0-9a-f]{64}$/),
      contractId: z.string().min(1),
      contractRevision: z.number().int().positive(),
      values: draftValuesSchema,
      receivedAt: z.string().min(1),
    })
    .nullable(),
  publication: z.enum(["none", "draft", "published"]),
  publishedAt: z.string().min(1).optional(),
});

export function loadOrbitState(storage: Storage, demoSessionId: string): OrbitState | null {
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
  const result = persistedOrbitStateSchema.safeParse(parsed);
  if (!result.success || result.data.demoSessionId !== demoSessionId) {
    return null;
  }
  return result.data as OrbitState;
}

export function saveOrbitState(storage: Storage, state: OrbitState): void {
  storage.setItem(storageKeyFor(state.demoSessionId), JSON.stringify(state));
}
