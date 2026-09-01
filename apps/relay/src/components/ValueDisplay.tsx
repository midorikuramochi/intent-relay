import { Fragment, type ReactNode } from "react";
import { formatEventSchedule, valueLabel, type Locale } from "@intent-relay/ui";

export interface ScheduleLike {
  start: string;
  end: string;
  timezone: string;
}

export function isSchedule(value: unknown): value is ScheduleLike {
  return (
    typeof value === "object" &&
    value !== null &&
    "start" in value &&
    "end" in value &&
    "timezone" in value
  );
}

/** Dotted technical key with soft wrap points at "." only — never mid-word. */
export function KeyCode({ value }: { value: string }): ReactNode {
  const parts = value.split(".");
  return (
    <code className="key-code">
      {parts.map((part, index) => (
        <Fragment key={`${index}-${part}`}>
          {index > 0 && (
            <>
              <wbr />.
            </>
          )}
          {part}
        </Fragment>
      ))}
    </code>
  );
}

/** Human-first rendering of a semantic value; raw values stay elsewhere. */
export function HumanValue({ locale, value }: { locale: Locale; value: unknown }): ReactNode {
  if (isSchedule(value)) {
    return <>{formatEventSchedule(locale, value)}</>;
  }
  const label = valueLabel(locale, value);
  if (label !== null) {
    return <>{label}</>;
  }
  return <>{typeof value === "string" ? value : JSON.stringify(value)}</>;
}
