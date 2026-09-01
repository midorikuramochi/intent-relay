import type { SemanticTrace } from "@intent-relay/contracts";

export interface GatherSchedule {
  start: string;
  end: string;
  timezone: string;
}

export type GatherTicketMode = "free" | "paid";
export type GatherOverflowMode = "native_waitlist" | "close_registration";
export type GatherDietaryQuestion = "optional" | "required";

export interface GatherEventState {
  title: string | null;
  schedule: GatherSchedule | null;
  capacity: number | null;
  ticketMode: GatherTicketMode | null;
  reminderHours: number | null;
  accessibilityNote: string | null;
  overflowMode: GatherOverflowMode | null;
  dietaryQuestion: GatherDietaryQuestion | null;
  publicationReview: boolean;
  revision: number;
}

export interface GatherState {
  demoSessionId: string;
  event: GatherEventState;
  trace: SemanticTrace;
}

export type GatherCommand =
  | { type: "setTitle"; value: string }
  | { type: "setSchedule"; value: GatherSchedule }
  | { type: "setCapacity"; value: number }
  | { type: "setTicketMode"; value: GatherTicketMode }
  | { type: "setReminder"; value: number }
  | { type: "setAccessibilityNote"; value: string }
  | { type: "setOverflowMode"; value: GatherOverflowMode }
  | { type: "setDietaryQuestion"; value: GatherDietaryQuestion }
  | { type: "requirePublicationReview" }
  | { type: "completeDemonstration" };

export type GatherAction = GatherCommand & { actor: "human"; now: string };
