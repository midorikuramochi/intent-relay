import type { SemanticAction } from "@intent-relay/contracts";
import type { GatherAction, GatherEventState, GatherState } from "./types";

export function createInitialGatherState(demoSessionId: string): GatherState {
  return {
    demoSessionId,
    event: {
      title: null,
      schedule: null,
      capacity: null,
      ticketMode: null,
      reminderHours: null,
      accessibilityNote: null,
      overflowMode: null,
      dietaryQuestion: null,
      publicationReview: false,
      revision: 0,
    },
    trace: {
      id: `trace-${demoSessionId}`,
      eventRevision: 0,
      completed: false,
      actions: [],
    },
  };
}

export const initialGatherState: GatherState = createInitialGatherState("session-fixture");

interface SemanticUpdate {
  semanticKey: string;
  before: unknown;
  after: unknown;
  event: GatherEventState;
}

function requirePositiveInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`The ${label} must be a positive whole number`);
  }
  return value;
}

function requireText(value: string, label: string): string {
  const trimmed = value.trim();
  if (trimmed === "") {
    throw new Error(`The ${label} must not be empty`);
  }
  return trimmed;
}

function semanticUpdate(event: GatherEventState, action: GatherAction): SemanticUpdate {
  switch (action.type) {
    case "setTitle": {
      const title = requireText(action.value, "title");
      return {
        semanticKey: "event.title",
        before: event.title,
        after: title,
        event: { ...event, title },
      };
    }
    case "setSchedule": {
      const schedule = {
        start: requireText(action.value.start, "schedule start"),
        end: requireText(action.value.end, "schedule end"),
        timezone: requireText(action.value.timezone, "schedule timezone"),
      };
      return {
        semanticKey: "event.schedule",
        before: event.schedule,
        after: schedule,
        event: { ...event, schedule },
      };
    }
    case "setCapacity": {
      const capacity = requirePositiveInteger(action.value, "capacity");
      return {
        semanticKey: "registration.capacity.maximum",
        before: event.capacity,
        after: capacity,
        event: { ...event, capacity },
      };
    }
    case "setTicketMode":
      return {
        semanticKey: "ticketing.mode",
        before: event.ticketMode,
        after: action.value,
        event: { ...event, ticketMode: action.value },
      };
    case "setReminder": {
      const reminderHours = requirePositiveInteger(action.value, "reminder offset");
      return {
        semanticKey: "notifications.reminder.offset",
        before: event.reminderHours,
        after: reminderHours,
        event: { ...event, reminderHours },
      };
    }
    case "setAccessibilityNote": {
      const accessibilityNote = requireText(action.value, "accessibility note");
      return {
        semanticKey: "accessibility.attendee_note",
        before: event.accessibilityNote,
        after: accessibilityNote,
        event: { ...event, accessibilityNote },
      };
    }
    case "setOverflowMode":
      return {
        semanticKey: "registration.overflow.mode",
        before: event.overflowMode,
        after: action.value,
        event: { ...event, overflowMode: action.value },
      };
    case "setDietaryQuestion":
      return {
        semanticKey: "registration.custom_question.dietary_restrictions",
        before: event.dietaryQuestion,
        after: action.value,
        event: { ...event, dietaryQuestion: action.value },
      };
    case "requirePublicationReview":
      return {
        semanticKey: "event.publish",
        before: event.publicationReview ? "human_confirmation_required" : null,
        after: "human_confirmation_required",
        event: { ...event, publicationReview: true },
      };
    case "completeDemonstration":
      throw new Error("completeDemonstration is not a semantic update");
  }
}

export function reduceGather(state: GatherState, action: GatherAction): GatherState {
  if (action.type === "completeDemonstration") {
    if (state.trace.completed) {
      return state;
    }
    return {
      ...state,
      trace: { ...state.trace, completed: true },
    };
  }

  const update = semanticUpdate(state.event, action);
  const revision = state.event.revision + 1;
  const semanticAction: SemanticAction = {
    id: `act-${String(state.trace.actions.length + 1).padStart(2, "0")}`,
    timestamp: action.now,
    actor: action.actor,
    command: action.type,
    semanticKey: update.semanticKey,
    before: update.before,
    after: update.after,
  };
  return {
    ...state,
    event: { ...update.event, revision },
    trace: {
      ...state.trace,
      eventRevision: revision,
      completed: false,
      actions: [...state.trace.actions, semanticAction],
    },
  };
}
