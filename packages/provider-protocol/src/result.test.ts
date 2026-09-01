import { describe, expect, it } from "vitest";
import type { ToolErrorCode } from "./errors";
import { isToolErrorCode, toolFailure, toolResultSchema, toolSuccess } from "./result";

describe("tool result envelopes", () => {
  it("builds a success envelope", () => {
    expect(toolSuccess({ ready: true })).toEqual({ ok: true, data: { ready: true } });
  });

  it("builds a failure envelope and omits absent details", () => {
    const failure = toolFailure("TRACE_EMPTY", "No actions yet", true);
    expect(failure).toEqual({
      ok: false,
      error: { code: "TRACE_EMPTY", message: "No actions yet", recoverable: true },
    });
    expect("details" in failure.error).toBe(false);
  });

  it("constrains failure codes to the closed protocol set at the type level", () => {
    const code: ToolErrorCode = "STALE_PREVIEW";
    expect(toolFailure(code, "Preview is stale", true).error.code).toBe("STALE_PREVIEW");
    // @ts-expect-error -- codes outside ToolErrorCode must not compile
    const rejected = () => toolFailure("MADE_UP_CODE", "nope", false);
    expect(typeof rejected).toBe("function");
  });

  it("guards unknown error codes at runtime", () => {
    expect(isToolErrorCode("TOOL_CANCELLED")).toBe(true);
    expect(isToolErrorCode("MADE_UP_CODE")).toBe(false);
    expect(isToolErrorCode(42)).toBe(false);
  });

  it("accepts valid envelopes through the runtime schema", () => {
    expect(toolResultSchema.safeParse({ ok: true, data: { anything: 1 } }).success).toBe(true);
    expect(
      toolResultSchema.safeParse(toolFailure("STALE_PREVIEW", "Preview is stale", true)).success,
    ).toBe(true);
  });

  it("rejects envelopes with unknown codes or extra properties", () => {
    expect(
      toolResultSchema.safeParse({
        ok: false,
        error: { code: "MADE_UP_CODE", message: "nope", recoverable: false },
      }).success,
    ).toBe(false);
    expect(toolResultSchema.safeParse({ ok: true, data: {}, confidence: 0.9 }).success).toBe(false);
  });
});
