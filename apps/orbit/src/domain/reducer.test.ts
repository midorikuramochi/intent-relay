import { describe, expect, it } from "vitest";
import { orbitCapabilities } from "@intent-relay/fixtures";
import { createOrbitStore } from "./commands";
import {
  createInitialOrbitState,
  initialOrbitState,
  prepareOrbitDraft,
  publishOrbitEvent,
  reduceOrbit,
} from "./reducer";
import type { OrbitDraftPayload } from "./types";
import { loadOrbitState, saveOrbitState, storageKeyFor } from "./storage";

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

const NOW = "2026-08-29T02:00:00.000Z";

function validPayload(overrides: Partial<OrbitDraftPayload> = {}): OrbitDraftPayload {
  return {
    contractId: "contract-student-ai-workshop",
    contractRevision: 1,
    capabilityVersion: orbitCapabilities.version,
    previewHash: "a".repeat(64),
    values: {
      "event.title": "Student AI Workshop",
      "event.schedule": {
        start: "2026-09-18T18:00:00.000+09:00",
        end: "2026-09-18T20:00:00.000+09:00",
        timezone: "Asia/Tokyo",
      },
      "registration.capacity.maximum": 100,
      "ticketing.mode": "free",
      "notifications.reminder.offset": 1,
      "accessibility.venue_note": "Explain that the venue entrance has steps",
      "registration.overflow.mode": "external_form",
    },
    ...overrides,
  };
}

function withValues(values: Record<string, unknown>): unknown {
  return { ...validPayload(), values };
}

describe("prepareOrbitDraft", () => {
  it("atomically prepares a draft for a new preview hash", () => {
    const result = prepareOrbitDraft(initialOrbitState, validPayload(), NOW);
    expect(result.draft?.previewHash).toBe(validPayload().previewHash);
    expect(result.publication).toBe("draft");
  });

  it("replaces the draft atomically and increments the revision for a new hash", () => {
    const first = prepareOrbitDraft(initialOrbitState, validPayload(), NOW);
    const second = prepareOrbitDraft(
      first,
      validPayload({
        previewHash: "b".repeat(64),
        values: { ...validPayload().values, "registration.capacity.maximum": 80 },
      }),
      NOW,
    );
    expect(second.draft?.revision).toBe((first.draft?.revision ?? 0) + 1);
    expect(second.draft?.draftId).not.toBe(first.draft?.draftId);
    expect(second.draft?.values["registration.capacity.maximum"]).toBe(80);
    expect(second.draft?.previewHash).toBe("b".repeat(64));
  });

  it("is idempotent for an identical preview hash", () => {
    const first = prepareOrbitDraft(initialOrbitState, validPayload(), NOW);
    const repeated = prepareOrbitDraft(first, validPayload(), "2026-08-29T03:00:00.000Z");
    expect(repeated.draft?.draftId).toBe(first.draft?.draftId);
    expect(repeated.draft?.revision).toBe(first.draft?.revision);
    expect(repeated.publication).toBe("draft");
  });

  it("rejects a reused preview hash carrying different resolved values", () => {
    const first = prepareOrbitDraft(initialOrbitState, validPayload(), NOW);
    const divergent = withValues({
      ...validPayload().values,
      "registration.overflow.mode": "close_registration",
    });
    expect(() => prepareOrbitDraft(first, divergent, NOW)).toThrow(/different draft payload/i);
  });

  it("rejects a reused preview hash carrying different contract metadata", () => {
    const first = prepareOrbitDraft(initialOrbitState, validPayload(), NOW);
    expect(() => prepareOrbitDraft(first, validPayload({ contractRevision: 2 }), NOW)).toThrow(
      /different draft payload/i,
    );
  });

  it("keeps a published event published on an identical retry", () => {
    const drafted = prepareOrbitDraft(initialOrbitState, validPayload(), NOW);
    const published = publishOrbitEvent(drafted, NOW);
    const retried = prepareOrbitDraft(published, validPayload(), "2026-08-30T09:00:00.000Z");
    expect(retried).toEqual(published);
    expect(retried.publication).toBe("published");
    expect(retried.publishedAt).toBe(NOW);
    expect(retried.draft?.draftId).toBe(published.draft?.draftId);
    expect(retried.draft?.revision).toBe(published.draft?.revision);
  });

  it("leaves an existing valid draft untouched when an invalid replacement is rejected", () => {
    const storage = new MemoryStorage();
    const store = createOrbitStore({
      demoSessionId: "session-orbit-keep",
      storage,
      now: () => NOW,
    });
    store.dispatchOrbitCommand({ type: "prepareDraft", payload: validPayload() }, "agent");
    const kept = store.getState();
    const invalid = validPayload({ previewHash: "d".repeat(64) });
    const brokenValues = { ...invalid.values, "ticketing.mode": "donation" } as never;
    expect(() =>
      store.dispatchOrbitCommand(
        { type: "prepareDraft", payload: { ...invalid, values: brokenValues } },
        "agent",
      ),
    ).toThrow(/ticketing\.mode/);
    expect(store.getState()).toEqual(kept);
    expect(store.getState().draft?.previewHash).toBe(validPayload().previewHash);
    expect(store.getState().publication).toBe("draft");
  });

  it("rejects a value key that Orbit does not declare", () => {
    const payload = withValues({
      ...validPayload().values,
      "registration.custom_question.dietary_restrictions": "optional",
    });
    expect(() => prepareOrbitDraft(initialOrbitState, payload, NOW)).toThrow(/declare/i);
  });

  it("rejects a value whose type does not match the capability", () => {
    const payload = withValues({
      ...validPayload().values,
      "registration.capacity.maximum": "100",
    });
    expect(() => prepareOrbitDraft(initialOrbitState, payload, NOW)).toThrow(
      /registration\.capacity\.maximum/,
    );
  });

  it("rejects an enum value outside the accepted values", () => {
    const payload = withValues({ ...validPayload().values, "ticketing.mode": "donation" });
    expect(() => prepareOrbitDraft(initialOrbitState, payload, NOW)).toThrow(/ticketing\.mode/);
  });

  it("rejects a reminder that is not a whole number of days", () => {
    const payload = withValues({
      ...validPayload().values,
      "notifications.reminder.offset": 1.5,
    });
    expect(() => prepareOrbitDraft(initialOrbitState, payload, NOW)).toThrow(/whole/i);
  });

  it("rejects a payload that tries to set the publication action", () => {
    const payload = withValues({
      ...validPayload().values,
      "event.publish": "human_confirmation_required",
    });
    expect(() => prepareOrbitDraft(initialOrbitState, payload, NOW)).toThrow(/publish/i);
  });

  it("rejects a stale capability version", () => {
    const payload = validPayload({ capabilityVersion: "orbit-event-v0" });
    expect(() => prepareOrbitDraft(initialOrbitState, payload, NOW)).toThrow(/capability version/i);
  });

  it("rejects a payload missing a required field", () => {
    const values = { ...validPayload().values } as Record<string, unknown>;
    delete values["event.title"];
    expect(() => prepareOrbitDraft(initialOrbitState, withValues(values), NOW)).toThrow(
      /event\.title/,
    );
  });

  it("never results in a published state", () => {
    const drafted = prepareOrbitDraft(initialOrbitState, validPayload(), NOW);
    const published = publishOrbitEvent(drafted, NOW);
    const reprepared = prepareOrbitDraft(
      published,
      validPayload({ previewHash: "c".repeat(64) }),
      NOW,
    );
    expect(reprepared.publication).toBe("draft");
  });
});

describe("publication boundary", () => {
  it("publishes only through the human transition", () => {
    const drafted = prepareOrbitDraft(initialOrbitState, validPayload(), NOW);
    const published = reduceOrbit(drafted, { type: "publishEvent", actor: "human", now: NOW });
    expect(published.publication).toBe("published");
    expect(published.publishedAt).toBe(NOW);
  });

  it("rejects publication by a non-human actor", () => {
    const drafted = prepareOrbitDraft(initialOrbitState, validPayload(), NOW);
    expect(() => reduceOrbit(drafted, { type: "publishEvent", actor: "agent", now: NOW })).toThrow(
      /human/i,
    );
  });

  it("rejects publication without a prepared draft", () => {
    expect(() =>
      reduceOrbit(initialOrbitState, { type: "publishEvent", actor: "human", now: NOW }),
    ).toThrow(/draft/i);
  });
});

describe("session-scoped Orbit storage", () => {
  it("uses the required storage key shape", () => {
    expect(storageKeyFor("session-o1-x")).toBe("intent-relay:orbit:session-o1-x:state");
  });

  it("round-trips state through storage", () => {
    const storage = new MemoryStorage();
    const state = prepareOrbitDraft(
      createInitialOrbitState("session-orbit-1"),
      validPayload(),
      NOW,
    );
    saveOrbitState(storage, state);
    expect(loadOrbitState(storage, "session-orbit-1")).toEqual(state);
  });

  it("isolates state between demo session namespaces", () => {
    const storage = new MemoryStorage();
    saveOrbitState(
      storage,
      prepareOrbitDraft(createInitialOrbitState("session-orbit-1"), validPayload(), NOW),
    );
    expect(loadOrbitState(storage, "session-orbit-2")).toBeNull();
  });

  it("returns null for corrupt persisted state", () => {
    const storage = new MemoryStorage();
    storage.setItem(storageKeyFor("session-orbit-1"), "{broken");
    expect(loadOrbitState(storage, "session-orbit-1")).toBeNull();
  });

  it("starts clean under a new session ID and resumes the same session", () => {
    const storage = new MemoryStorage();
    const store = createOrbitStore({ demoSessionId: "session-orbit-1", storage, now: () => NOW });
    store.dispatchOrbitCommand({ type: "prepareDraft", payload: validPayload() }, "agent");
    expect(
      createOrbitStore({ demoSessionId: "session-orbit-9", storage }).getState().draft,
    ).toBeNull();
    const resumed = createOrbitStore({ demoSessionId: "session-orbit-1", storage });
    expect(resumed.getState().draft?.previewHash).toBe(validPayload().previewHash);
  });
});
