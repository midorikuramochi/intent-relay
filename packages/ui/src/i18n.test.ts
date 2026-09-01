import { describe, expect, it } from "vitest";
import {
  formatEventSchedule,
  formatTimestamp,
  parseLocale,
  semanticKeyLabel,
  translate,
  valueLabel,
} from "./i18n";

const SCHEDULE = {
  start: "2026-09-18T18:00:00.000+09:00",
  end: "2026-09-18T20:00:00.000+09:00",
  timezone: "Asia/Tokyo",
};

describe("parseLocale", () => {
  it("defaults to English and only accepts known locales", () => {
    expect(parseLocale(null)).toBe("en");
    expect(parseLocale(undefined)).toBe("en");
    expect(parseLocale("fr")).toBe("en");
    expect(parseLocale("ja")).toBe("ja");
    expect(parseLocale("en")).toBe("en");
  });
});

describe("translate", () => {
  it("interpolates parameters", () => {
    expect(translate("en", "relay.tools.some", { n: 5 })).toBe(
      "WebMCP · 5 agent tool(s) available",
    );
    expect(translate("ja", "queue.unresolvedBadge", { n: 1 })).toBe("⚑ 未解決 1 件");
  });

  it("keeps spec-locked English strings verbatim", () => {
    // These exact strings are asserted by the accepted Task 9 E2E suite.
    expect(translate("en", "contract.badge.draft")).toBe("◐ Draft — awaiting your approval");
    expect(translate("en", "review.waiting")).toBe("Waiting for human publication");
    expect(translate("en", "relay.publicationBadge")).toBe(
      "Human approval required for publication",
    );
    expect(translate("en", "queue.blocking", { n: 1 })).toContain("decision(s) must be resolved");
    expect(translate("en", "queue.blocking", { n: 1 })).toContain(
      "The agent never chooses for you.",
    );
  });
});

describe("semanticKeyLabel / valueLabel", () => {
  it("labels the canonical semantic keys in both locales", () => {
    expect(semanticKeyLabel("en", "event.title")).toBe("Event title");
    expect(semanticKeyLabel("ja", "registration.overflow.mode")).toBe("満員時の扱い");
    // unknown keys fall back to the raw key, never to invented text
    expect(semanticKeyLabel("en", "custom.unknown_key")).toBe("custom.unknown_key");
  });

  it("labels enum-ish raw values and returns null for unknown values", () => {
    expect(valueLabel("en", "external_form")).toBe("External overflow form");
    expect(valueLabel("ja", "external_form")).toBe("外部の追加登録フォーム");
    expect(valueLabel("en", "human_confirmation_required")).toBe("Requires your confirmation");
    expect(valueLabel("en", 42)).toBeNull();
    expect(valueLabel("en", "no_such_value")).toBeNull();
  });
});

describe("formatEventSchedule", () => {
  it("renders the English human-facing schedule without altering ISO values", () => {
    const formatted = formatEventSchedule("en", SCHEDULE);
    expect(formatted).toContain("Sep 18, 2026");
    expect(formatted).toContain("PM");
    expect(formatted).toMatch(/GMT\+9|JST/);
    expect(SCHEDULE.start).toBe("2026-09-18T18:00:00.000+09:00");
  });

  it("renders the Japanese human-facing schedule", () => {
    const formatted = formatEventSchedule("ja", SCHEDULE);
    expect(formatted).toContain("2026年9月18日");
    expect(formatted).toContain("18:00");
    expect(formatted).toContain("20:00");
  });
});

describe("formatTimestamp", () => {
  it("formats ISO timestamps per locale and passes through invalid input", () => {
    expect(formatTimestamp("en", "2026-08-30T12:00:00.000Z")).toMatch(/2026/);
    expect(formatTimestamp("ja", "2026-08-30T12:00:00.000Z")).toMatch(/2026/);
    expect(formatTimestamp("en", "not-a-date")).toBe("not-a-date");
  });
});
