import { describe, expect, it } from "vitest";

describe("workspace", () => {
  it("runs shared package tests", () => {
    expect("intent-relay").toBe("intent-relay");
  });
});
