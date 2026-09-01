import { studentAiWorkshopTrace } from "@intent-relay/fixtures";
import { createInitialGatherState, reduceGather } from "./reducer";
import { loadGatherState, saveGatherState } from "./storage";
import type { GatherCommand, GatherSchedule, GatherState } from "./types";

export type { GatherCommand } from "./types";

export interface GatherStore {
  getState(): GatherState;
  subscribe(listener: () => void): () => void;
  dispatchGatherCommand(command: GatherCommand, actor: "human"): GatherState;
}

export function createGatherStore(options: {
  demoSessionId: string;
  storage: Storage;
  now?: () => string;
}): GatherStore {
  const now = options.now ?? (() => new Date().toISOString());
  let state =
    loadGatherState(options.storage, options.demoSessionId) ??
    createInitialGatherState(options.demoSessionId);
  const listeners = new Set<() => void>();
  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispatchGatherCommand(command, actor) {
      state = reduceGather(state, { ...command, actor, now: now() });
      saveGatherState(options.storage, state);
      for (const listener of listeners) {
        listener();
      }
      return state;
    },
  };
}

/**
 * Rebuilds the canonical Student AI Workshop demonstration as ordinary domain
 * commands, sourced from the shared fixture so the sample stays single-source.
 */
export function sampleDemonstrationCommands(): GatherCommand[] {
  const afterByCommand = new Map(
    studentAiWorkshopTrace.actions.map((action) => [action.command, action.after]),
  );
  return [
    { type: "setTitle", value: afterByCommand.get("setTitle") as string },
    { type: "setSchedule", value: afterByCommand.get("setSchedule") as GatherSchedule },
    { type: "setCapacity", value: afterByCommand.get("setCapacity") as number },
    { type: "setTicketMode", value: afterByCommand.get("setTicketMode") as "free" | "paid" },
    { type: "setReminder", value: afterByCommand.get("setReminder") as number },
    {
      type: "setAccessibilityNote",
      value: afterByCommand.get("setAccessibilityNote") as string,
    },
    {
      type: "setOverflowMode",
      value: afterByCommand.get("setOverflowMode") as "native_waitlist",
    },
    {
      type: "setDietaryQuestion",
      value: afterByCommand.get("setDietaryQuestion") as "optional",
    },
    { type: "requirePublicationReview" },
  ];
}
