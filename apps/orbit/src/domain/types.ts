export interface OrbitScheduleValue {
  start: string;
  end: string;
  timezone: string;
}

/**
 * Draft values are keyed by Orbit's declared capability semantic keys, so the
 * payload stays driven by the canonical capability manifest rather than by a
 * mirror of Gather's form model.
 */
export interface OrbitDraftValues {
  "event.title": string;
  "event.schedule": OrbitScheduleValue;
  "registration.capacity.maximum": number;
  "ticketing.mode": "free" | "paid";
  "notifications.reminder.offset"?: number;
  "accessibility.venue_note"?: string;
  "registration.overflow.mode"?: "close_registration" | "external_form";
}

export interface OrbitDraftPayload {
  contractId: string;
  contractRevision: number;
  capabilityVersion: string;
  previewHash: string;
  values: OrbitDraftValues;
}

export interface OrbitDraft {
  draftId: string;
  revision: number;
  previewHash: string;
  contractId: string;
  contractRevision: number;
  values: OrbitDraftValues;
  receivedAt: string;
}

export type OrbitPublication = "none" | "draft" | "published";

export interface OrbitState {
  demoSessionId: string;
  capabilityVersion: string;
  draft: OrbitDraft | null;
  publication: OrbitPublication;
  publishedAt?: string;
}

export type OrbitCommand =
  { type: "prepareDraft"; payload: OrbitDraftPayload } | { type: "publishEvent" };

export type OrbitActor = "human" | "agent";

export type OrbitAction = OrbitCommand & { actor: OrbitActor; now: string };
