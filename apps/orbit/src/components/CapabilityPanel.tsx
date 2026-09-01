import type { ReactNode } from "react";
import { orbitCapabilities } from "@intent-relay/fixtures";
import { useI18n } from "@intent-relay/ui";

export function CapabilityPanel(): ReactNode {
  const { t } = useI18n();
  return (
    <section className="card" aria-labelledby="capability-heading">
      <div className="card-head">
        <h2 id="capability-heading">{t("orbit.capabilities.heading")}</h2>
        <span className="chip chip-version">{orbitCapabilities.version}</span>
      </div>
      <p className="muted">{t("orbit.capabilities.note")}</p>
      <ul className="capability-list">
        {orbitCapabilities.capabilities.map((capability) => (
          <li key={capability.semanticKey} className="capability-item">
            <div className="capability-head">
              <code>{capability.semanticKey}</code>
              <span className="chip chip-type">{capability.valueType}</span>
            </div>
            {capability.acceptedValues !== undefined && (
              <p className="capability-detail">
                {t("orbit.capabilities.accepts")}:{" "}
                {capability.acceptedValues.map((value) => String(value)).join(" · ")}
              </p>
            )}
            {capability.constraints !== undefined && (
              <p className="capability-detail">
                {t("orbit.capabilities.constraints")}: {JSON.stringify(capability.constraints)}
              </p>
            )}
            {capability.supportedTransformations?.map((transformation) => (
              <p key={transformation.id} className="capability-detail">
                ↻ {transformation.from} → {transformation.to}: {transformation.explanation}
              </p>
            ))}
          </li>
        ))}
      </ul>
      <div className="capability-footnotes">
        <p>
          <strong>{t("orbit.capabilities.unsupported")}:</strong>{" "}
          {orbitCapabilities.unsupportedSemanticKeys.map((key) => (
            <code key={key}>{key}</code>
          ))}
        </p>
        <p>
          <strong>{t("orbit.capabilities.humanOnly")}:</strong>{" "}
          {orbitCapabilities.humanOnlyActions.map((key) => (
            <code key={key}>{key}</code>
          ))}
        </p>
      </div>
    </section>
  );
}
