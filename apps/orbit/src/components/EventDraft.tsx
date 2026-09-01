import type { ReactNode } from "react";
import { formatEventSchedule, useI18n, valueLabel } from "@intent-relay/ui";
import type { OrbitState } from "../domain/types";

export function EventDraft({
  state,
  onPublish,
}: {
  state: OrbitState;
  onPublish: () => void;
}): ReactNode {
  const { locale, t } = useI18n();
  const draft = state.draft;
  const schedule = draft?.values["event.schedule"];
  const overflow = draft?.values["registration.overflow.mode"];
  return (
    <section className="card card-draft" aria-labelledby="draft-heading">
      <div className="card-head">
        <h2 id="draft-heading">{t("orbit.draft.heading")}</h2>
        <span
          className={
            state.publication === "published"
              ? "chip chip-published"
              : state.publication === "draft"
                ? "chip chip-waiting"
                : "chip chip-none"
          }
        >
          {state.publication === "published" && t("orbit.chip.published")}
          {state.publication === "draft" && t("orbit.chip.waiting")}
          {state.publication === "none" && t("orbit.chip.none")}
        </span>
      </div>

      {draft === null ? (
        <p className="muted">{t("orbit.empty")}</p>
      ) : (
        <>
          <dl className="draft-grid">
            <div>
              <dt>{t("orbit.field.name")}</dt>
              <dd>{draft.values["event.title"]}</dd>
            </div>
            <div>
              <dt>{t("orbit.field.when")}</dt>
              <dd>
                {schedule !== undefined && formatEventSchedule(locale, schedule)}
                {schedule !== undefined && (
                  <span className="raw-value">
                    {schedule.start} → {schedule.end} ({schedule.timezone})
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt>{t("orbit.field.seats")}</dt>
              <dd>
                {t("orbit.field.seatsValue", {
                  n: draft.values["registration.capacity.maximum"],
                })}
              </dd>
            </div>
            <div>
              <dt>{t("orbit.field.admission")}</dt>
              <dd>
                {draft.values["ticketing.mode"] === "free"
                  ? t("orbit.field.free")
                  : t("orbit.field.paid")}
              </dd>
            </div>
            <div>
              <dt>{t("orbit.field.reminder")}</dt>
              <dd>
                {draft.values["notifications.reminder.offset"] === undefined
                  ? t("orbit.field.reminderNone")
                  : t("orbit.field.reminderValue", {
                      n: draft.values["notifications.reminder.offset"],
                    })}
              </dd>
            </div>
            <div>
              <dt>{t("orbit.field.venueNote")}</dt>
              <dd>{draft.values["accessibility.venue_note"] ?? t("orbit.field.venueNoteNone")}</dd>
            </div>
            <div>
              <dt>{t("orbit.field.overflow")}</dt>
              <dd>
                {overflow === undefined
                  ? t("orbit.field.overflowNone")
                  : (valueLabel(locale, overflow) ?? overflow)}
                {overflow !== undefined && <span className="raw-value">{overflow}</span>}
              </dd>
            </div>
          </dl>
          <p className="draft-meta">
            Draft <code>{draft.draftId}</code> · rev {draft.revision} ·{" "}
            <code>{draft.contractId}</code> rev {draft.contractRevision} ·{" "}
            <code>{draft.previewHash.slice(0, 12)}…</code>
          </p>
        </>
      )}

      <div className="publish-row">
        <button
          type="button"
          className="publish-button"
          disabled={draft === null || state.publication === "published"}
          onClick={onPublish}
        >
          {state.publication === "published" ? t("orbit.published") : t("orbit.publish")}
        </button>
        <p className="publish-note">{t("orbit.publishNote")}</p>
      </div>
    </section>
  );
}
