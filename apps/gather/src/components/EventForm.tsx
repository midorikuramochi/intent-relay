import { useEffect, useState, type ReactNode } from "react";
import { useI18n } from "@intent-relay/ui";
import { sampleDemonstrationCommands, type GatherCommand } from "../domain/commands";
import type { GatherEventState } from "../domain/types";

interface EventFormProps {
  event: GatherEventState;
  completed: boolean;
  dispatch: (command: GatherCommand) => void;
  onComplete: () => void;
}

const TIMEZONE_OFFSETS: Record<string, string> = {
  "Asia/Tokyo": "+09:00",
  UTC: "Z",
};

function composeIso(local: string, timezone: string): string {
  const offset = TIMEZONE_OFFSETS[timezone] ?? "Z";
  const normalized = local.length === 16 ? `${local}:00.000` : `${local}.000`;
  return `${normalized}${offset}`;
}

function localPart(iso: string | undefined): string {
  return iso === undefined ? "" : iso.slice(0, 16);
}

function Field({ label, children }: { label: string; children: ReactNode }): ReactNode {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

function CommitTextInput({
  label,
  value,
  placeholder,
  multiline,
  onCommit,
}: {
  label: string;
  value: string;
  placeholder?: string;
  multiline?: boolean;
  onCommit: (next: string) => void;
}): ReactNode {
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    setDraft(value);
  }, [value]);
  const commit = (): void => {
    const trimmed = draft.trim();
    if (trimmed !== "" && trimmed !== value) {
      onCommit(trimmed);
    }
  };
  return (
    <Field label={label}>
      {multiline === true ? (
        <textarea
          value={draft}
          placeholder={placeholder}
          rows={2}
          onChange={(eventArg) => setDraft(eventArg.target.value)}
          onBlur={commit}
        />
      ) : (
        <input
          type="text"
          value={draft}
          placeholder={placeholder}
          onChange={(eventArg) => setDraft(eventArg.target.value)}
          onBlur={commit}
        />
      )}
    </Field>
  );
}

function CommitNumberInput({
  label,
  value,
  min,
  onCommit,
}: {
  label: string;
  value: number | null;
  min: number;
  onCommit: (next: number) => void;
}): ReactNode {
  const [draft, setDraft] = useState(value === null ? "" : String(value));
  useEffect(() => {
    setDraft(value === null ? "" : String(value));
  }, [value]);
  const commit = (): void => {
    const parsed = Number(draft);
    if (Number.isInteger(parsed) && parsed >= min && parsed !== value) {
      onCommit(parsed);
    }
  };
  return (
    <Field label={label}>
      <input
        type="number"
        min={min}
        value={draft}
        onChange={(eventArg) => setDraft(eventArg.target.value)}
        onBlur={commit}
      />
    </Field>
  );
}

export function EventForm({ event, completed, dispatch, onComplete }: EventFormProps): ReactNode {
  const { t } = useI18n();
  const [scheduleDraft, setScheduleDraft] = useState({
    start: localPart(event.schedule?.start),
    end: localPart(event.schedule?.end),
    timezone: event.schedule?.timezone ?? "Asia/Tokyo",
  });
  useEffect(() => {
    setScheduleDraft({
      start: localPart(event.schedule?.start),
      end: localPart(event.schedule?.end),
      timezone: event.schedule?.timezone ?? "Asia/Tokyo",
    });
  }, [event.schedule]);

  const commitSchedule = (draft: typeof scheduleDraft): void => {
    if (draft.start === "" || draft.end === "") {
      return;
    }
    const next = {
      start: composeIso(draft.start, draft.timezone),
      end: composeIso(draft.end, draft.timezone),
      timezone: draft.timezone,
    };
    if (
      next.start !== event.schedule?.start ||
      next.end !== event.schedule?.end ||
      next.timezone !== event.schedule?.timezone
    ) {
      dispatch({ type: "setSchedule", value: next });
    }
  };

  const replaySample = (): void => {
    for (const command of sampleDemonstrationCommands()) {
      dispatch(command);
    }
  };

  return (
    <section className="panel" aria-labelledby="event-form-heading">
      <div className="panel-header">
        <h2 id="event-form-heading">{t("gather.form.heading")}</h2>
        <span className="badge badge-sample">{t("common.sample")}</span>
      </div>

      <div className="toolbar">
        <button type="button" onClick={replaySample}>
          {t("gather.replay")}
        </button>
        <button type="button" onClick={onComplete} disabled={completed}>
          {completed ? t("gather.completed") : t("gather.complete")}
        </button>
      </div>

      <CommitTextInput
        label={t("gather.field.title")}
        value={event.title ?? ""}
        placeholder="Student AI Workshop"
        onCommit={(next) => dispatch({ type: "setTitle", value: next })}
      />

      <fieldset className="field-group">
        <legend>{t("gather.field.schedule")}</legend>
        <Field label={t("gather.field.starts")}>
          <input
            type="datetime-local"
            value={scheduleDraft.start}
            onChange={(eventArg) =>
              setScheduleDraft({ ...scheduleDraft, start: eventArg.target.value })
            }
            onBlur={() => commitSchedule(scheduleDraft)}
          />
        </Field>
        <Field label={t("gather.field.ends")}>
          <input
            type="datetime-local"
            value={scheduleDraft.end}
            onChange={(eventArg) =>
              setScheduleDraft({ ...scheduleDraft, end: eventArg.target.value })
            }
            onBlur={() => commitSchedule(scheduleDraft)}
          />
        </Field>
        <Field label={t("gather.field.timezone")}>
          <select
            value={scheduleDraft.timezone}
            onChange={(eventArg) => {
              const next = { ...scheduleDraft, timezone: eventArg.target.value };
              setScheduleDraft(next);
              commitSchedule(next);
            }}
          >
            <option value="Asia/Tokyo">Asia/Tokyo</option>
            <option value="UTC">UTC</option>
          </select>
        </Field>
      </fieldset>

      <CommitNumberInput
        label={t("gather.field.capacity")}
        value={event.capacity}
        min={1}
        onCommit={(next) => dispatch({ type: "setCapacity", value: next })}
      />

      <fieldset className="field-group">
        <legend>{t("gather.field.admission")}</legend>
        <div className="radio-row" role="radiogroup" aria-label="Ticket mode">
          {(["free", "paid"] as const).map((mode) => (
            <label key={mode} className="radio">
              <input
                type="radio"
                name="ticket-mode"
                checked={event.ticketMode === mode}
                onChange={() => dispatch({ type: "setTicketMode", value: mode })}
              />
              <span>{mode === "free" ? t("gather.field.free") : t("gather.field.paid")}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <CommitNumberInput
        label={t("gather.field.reminder")}
        value={event.reminderHours}
        min={1}
        onCommit={(next) => dispatch({ type: "setReminder", value: next })}
      />

      <CommitTextInput
        label={t("gather.field.note")}
        value={event.accessibilityNote ?? ""}
        placeholder="Explain that the venue entrance has steps"
        multiline
        onCommit={(next) => dispatch({ type: "setAccessibilityNote", value: next })}
      />

      <Field label={t("gather.field.overflow")}>
        <select
          value={event.overflowMode ?? ""}
          onChange={(eventArg) => {
            const value = eventArg.target.value;
            if (value === "native_waitlist" || value === "close_registration") {
              dispatch({ type: "setOverflowMode", value });
            }
          }}
        >
          <option value="" disabled>
            {t("gather.field.overflow.placeholder")}
          </option>
          <option value="native_waitlist">{t("gather.field.overflow.waitlist")}</option>
          <option value="close_registration">{t("gather.field.overflow.close")}</option>
        </select>
      </Field>

      <Field label={t("gather.field.dietary")}>
        <select
          value={event.dietaryQuestion ?? ""}
          onChange={(eventArg) => {
            const value = eventArg.target.value;
            if (value === "optional" || value === "required") {
              dispatch({ type: "setDietaryQuestion", value });
            }
          }}
        >
          <option value="" disabled>
            {t("gather.field.dietary.placeholder")}
          </option>
          <option value="optional">{t("gather.field.dietary.optional")}</option>
          <option value="required">{t("gather.field.dietary.required")}</option>
        </select>
      </Field>

      <label className="checkbox">
        <input
          type="checkbox"
          checked={event.publicationReview}
          disabled={event.publicationReview}
          onChange={(eventArg) => {
            if (eventArg.target.checked) {
              dispatch({ type: "requirePublicationReview" });
            }
          }}
        />
        <span>{t("gather.field.publication")}</span>
      </label>
    </section>
  );
}
