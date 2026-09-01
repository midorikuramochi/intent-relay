import type { CapabilityManifest } from "@intent-relay/protocol";

export const orbitCapabilities: CapabilityManifest = {
  provider: "orbit",
  version: "orbit-event-v1",
  capabilities: [
    { semanticKey: "event.title", valueType: "string" },
    { semanticKey: "event.schedule", valueType: "datetime" },
    { semanticKey: "registration.capacity.maximum", valueType: "number" },
    { semanticKey: "ticketing.mode", valueType: "enum", acceptedValues: ["free", "paid"] },
    {
      semanticKey: "notifications.reminder.offset",
      valueType: "duration",
      constraints: { unit: "days", wholeNumbersOnly: true },
      supportedTransformations: [
        {
          id: "hours-to-whole-days",
          from: "hours",
          to: "days",
          explanation: "Orbit schedules reminders in whole days.",
        },
      ],
    },
    {
      semanticKey: "accessibility.venue_note",
      valueType: "string",
      supportedTransformations: [
        {
          id: "attendee-note-to-venue-note",
          from: "accessibility.attendee_note",
          to: "accessibility.venue_note",
          explanation: "Orbit stores attendee-facing access information on its venue record.",
        },
      ],
    },
    {
      semanticKey: "registration.overflow.mode",
      valueType: "enum",
      acceptedValues: ["close_registration", "external_form"],
    },
  ],
  unsupportedSemanticKeys: ["registration.custom_question.dietary_restrictions"],
  humanOnlyActions: ["event.publish"],
};
