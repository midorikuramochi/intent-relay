import type { ReactNode } from "react";
import { useI18n, type MessageKey } from "@intent-relay/ui";
import type { WorkbenchStep } from "../domain/types";

const STEPS: Array<{ id: WorkbenchStep; labelKey: MessageKey }> = [
  { id: "demonstrate", labelKey: "step.demonstrate" },
  { id: "verify_contract", labelKey: "step.verify" },
  { id: "transfer", labelKey: "step.transfer" },
  { id: "review", labelKey: "step.review" },
];

export function StepNavigation({
  step,
  onNavigate,
}: {
  step: WorkbenchStep;
  onNavigate: (step: WorkbenchStep) => void;
}): ReactNode {
  const { t } = useI18n();
  return (
    <nav className="step-nav" aria-label="Workbench steps">
      <ol>
        {STEPS.map((candidate) => (
          <li key={candidate.id}>
            <button
              type="button"
              aria-current={candidate.id === step ? "step" : undefined}
              className={candidate.id === step ? "step-link step-link-active" : "step-link"}
              onClick={() => onNavigate(candidate.id)}
            >
              {t(candidate.labelKey)}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
