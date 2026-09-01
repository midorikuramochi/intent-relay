import { describe, expect, it } from "vitest";
import { studentAiWorkshopTrace } from "@intent-relay/fixtures";
import { createGatherStore, sampleDemonstrationCommands } from "./commands";
import type { GatherCommand } from "./commands";
import { initialGatherState, reduceGather } from "./reducer";
import type { GatherAction, GatherState } from "./types";
import { loadGatherState, parseDemoSessionId, saveGatherState, storageKeyFor } from "./storage";

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

const NOW = "2026-08-29T00:00:00.000Z";

function humanAction(command: GatherCommand, now: string = NOW): GatherAction {
  return { ...command, actor: "human", now };
}

function applyAll(state: GatherState, commands: GatherCommand[]): GatherState {
  return commands.reduce((current, command) => reduceGather(current, humanAction(command)), state);
}

const NINE_COMMANDS: Array<{ command: GatherCommand; semanticKey: string; after: unknown }> = [
  {
    command: { type: "setTitle", value: "Student AI Workshop" },
    semanticKey: "event.title",
    after: "Student AI Workshop",
  },
  {
    command: {
      type: "setSchedule",
      value: {
        start: "2026-09-18T18:00:00.000+09:00",
        end: "2026-09-18T20:00:00.000+09:00",
        timezone: "Asia/Tokyo",
      },
    },
    semanticKey: "event.schedule",
    after: {
      start: "2026-09-18T18:00:00.000+09:00",
      end: "2026-09-18T20:00:00.000+09:00",
      timezone: "Asia/Tokyo",
    },
  },
  {
    command: { type: "setCapacity", value: 100 },
    semanticKey: "registration.capacity.maximum",
    after: 100,
  },
  {
    command: { type: "setTicketMode", value: "free" },
    semanticKey: "ticketing.mode",
    after: "free",
  },
  {
    command: { type: "setReminder", value: 24 },
    semanticKey: "notifications.reminder.offset",
    after: 24,
  },
  {
    command: { type: "setAccessibilityNote", value: "Explain that the venue entrance has steps" },
    semanticKey: "accessibility.attendee_note",
    after: "Explain that the venue entrance has steps",
  },
  {
    command: { type: "setOverflowMode", value: "native_waitlist" },
    semanticKey: "registration.overflow.mode",
    after: "native_waitlist",
  },
  {
    command: { type: "setDietaryQuestion", value: "optional" },
    semanticKey: "registration.custom_question.dietary_restrictions",
    after: "optional",
  },
  {
    command: { type: "requirePublicationReview" },
    semanticKey: "event.publish",
    after: "human_confirmation_required",
  },
];

describe("reduceGather", () => {
  it("records semantic before and after values for a human command", () => {
    const result = reduceGather(initialGatherState, {
      type: "setCapacity",
      value: 100,
      actor: "human",
      now: "2026-08-29T00:00:00.000Z",
    });

    expect(result.trace.actions.at(-1)).toMatchObject({
      actor: "human",
      command: "setCapacity",
      semanticKey: "registration.capacity.maximum",
      before: null,
      after: 100,
    });
  });

  it("records all nine demonstration commands with their semantic keys", () => {
    const result = applyAll(
      initialGatherState,
      NINE_COMMANDS.map((entry) => entry.command),
    );
    expect(result.trace.actions).toHaveLength(9);
    result.trace.actions.forEach((action, index) => {
      const expected = NINE_COMMANDS[index]!;
      expect(action).toMatchObject({
        actor: "human",
        command: expected.command.type,
        semanticKey: expected.semanticKey,
        before: null,
        after: expected.after,
      });
      expect(action.id).toBeTruthy();
      expect(action.timestamp).toBe(NOW);
    });
    expect(result.event.revision).toBe(9);
    expect(result.trace.eventRevision).toBe(9);
    expect(result.event.capacity).toBe(100);
    expect(result.event.publicationReview).toBe(true);
  });

  it("records the previous value as before on a repeated command", () => {
    const first = reduceGather(
      initialGatherState,
      humanAction({ type: "setCapacity", value: 100 }),
    );
    const second = reduceGather(first, humanAction({ type: "setCapacity", value: 120 }));
    expect(second.trace.actions.at(-1)).toMatchObject({ before: 100, after: 120 });
  });

  it("marks the trace complete without appending a semantic action", () => {
    const populated = reduceGather(
      initialGatherState,
      humanAction({ type: "setCapacity", value: 100 }),
    );
    const completed = reduceGather(populated, humanAction({ type: "completeDemonstration" }));
    expect(completed.trace.completed).toBe(true);
    expect(completed.trace.actions).toHaveLength(1);
    const again = reduceGather(completed, humanAction({ type: "completeDemonstration" }));
    expect(again).toEqual(completed);
  });

  it("reopens a completed trace when the demonstration is edited again", () => {
    const completed = reduceGather(
      reduceGather(initialGatherState, humanAction({ type: "setCapacity", value: 100 })),
      humanAction({ type: "completeDemonstration" }),
    );
    const edited = reduceGather(completed, humanAction({ type: "setCapacity", value: 80 }));
    expect(edited.trace.completed).toBe(false);
    expect(edited.trace.actions).toHaveLength(2);
  });

  it("does not mutate the previous state", () => {
    const snapshot = structuredClone(initialGatherState);
    reduceGather(initialGatherState, humanAction({ type: "setCapacity", value: 100 }));
    expect(initialGatherState).toEqual(snapshot);
  });

  it("rejects invalid command values", () => {
    expect(() =>
      reduceGather(initialGatherState, humanAction({ type: "setCapacity", value: 0 })),
    ).toThrow(/capacity/i);
    expect(() =>
      reduceGather(initialGatherState, humanAction({ type: "setTitle", value: "  " })),
    ).toThrow(/title/i);
    expect(() =>
      reduceGather(initialGatherState, humanAction({ type: "setReminder", value: -2 })),
    ).toThrow(/reminder/i);
  });

  it("replays the sample demonstration to match the canonical fixture semantics", () => {
    const replayed = applyAll(initialGatherState, sampleDemonstrationCommands());
    const summarize = (actions: Array<{ command: string; semanticKey: string; after: unknown }>) =>
      actions.map(({ command, semanticKey, after }) => ({ command, semanticKey, after }));
    expect(summarize(replayed.trace.actions)).toEqual(summarize(studentAiWorkshopTrace.actions));
  });
});

describe("session-scoped storage", () => {
  it("uses the required storage key shape", () => {
    expect(storageKeyFor("session-a1")).toBe("intent-relay:gather:session-a1:state");
  });

  it("round-trips state through storage", () => {
    const storage = new MemoryStorage();
    const state = reduceGather(
      initialGatherState,
      humanAction({ type: "setCapacity", value: 100 }),
    );
    saveGatherState(storage, state);
    expect(loadGatherState(storage, state.demoSessionId)).toEqual(state);
  });

  it("isolates state between demo session namespaces", () => {
    const storage = new MemoryStorage();
    const state = reduceGather(
      initialGatherState,
      humanAction({ type: "setCapacity", value: 100 }),
    );
    saveGatherState(storage, state);
    expect(loadGatherState(storage, "session-b2-other")).toBeNull();
  });

  it("returns null for corrupt persisted state", () => {
    const storage = new MemoryStorage();
    storage.setItem(storageKeyFor("session-a1"), "{not json");
    expect(loadGatherState(storage, "session-a1")).toBeNull();
    storage.setItem(storageKeyFor("session-a1"), JSON.stringify({ nonsense: true }));
    expect(loadGatherState(storage, "session-a1")).toBeNull();
  });

  it("starts clean under a new session ID after a reset", () => {
    const storage = new MemoryStorage();
    const store = createGatherStore({ demoSessionId: "session-before", storage });
    store.dispatchGatherCommand({ type: "setCapacity", value: 100 }, "human");
    const afterReset = createGatherStore({ demoSessionId: "session-after", storage });
    expect(afterReset.getState().trace.actions).toEqual([]);
    expect(afterReset.getState().event.capacity).toBeNull();
  });

  it("resumes persisted state for the same session ID", () => {
    const storage = new MemoryStorage();
    const store = createGatherStore({ demoSessionId: "session-resume", storage });
    store.dispatchGatherCommand({ type: "setCapacity", value: 100 }, "human");
    const resumed = createGatherStore({ demoSessionId: "session-resume", storage });
    expect(resumed.getState().event.capacity).toBe(100);
    expect(resumed.getState().trace.actions).toHaveLength(1);
  });
});

describe("parseDemoSessionId", () => {
  it("reads a valid session ID from the query string", () => {
    expect(parseDemoSessionId("?demoSessionId=session-ab12cd34")).toBe("session-ab12cd34");
  });

  it("rejects a missing session ID", () => {
    expect(() => parseDemoSessionId("")).toThrow(/session/i);
    expect(() => parseDemoSessionId("?other=1")).toThrow(/session/i);
  });

  it("rejects a malformed session ID", () => {
    expect(() => parseDemoSessionId("?demoSessionId=<script>")).toThrow(/session/i);
    expect(() => parseDemoSessionId("?demoSessionId=ab")).toThrow(/session/i);
  });
});
