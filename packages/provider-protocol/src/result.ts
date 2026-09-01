import { z } from "zod";
import { TOOL_ERROR_CODES, type ToolErrorCode } from "./errors";

export interface ToolError {
  code: ToolErrorCode;
  message: string;
  recoverable: boolean;
  details?: unknown;
}

export type ToolSuccess<T> = { ok: true; data: T };

export type ToolFailure = { ok: false; error: ToolError };

export type ToolResult<T> = ToolSuccess<T> | ToolFailure;

export function toolSuccess<T>(data: T): ToolSuccess<T> {
  return { ok: true, data };
}

export function toolFailure(
  code: ToolErrorCode,
  message: string,
  recoverable: boolean,
  details?: unknown,
): ToolFailure {
  const error: ToolError = { code, message, recoverable };
  if (details !== undefined) {
    error.details = details;
  }
  return { ok: false, error };
}

export function isToolErrorCode(value: unknown): value is ToolErrorCode {
  return typeof value === "string" && (TOOL_ERROR_CODES as readonly string[]).includes(value);
}

export const toolResultSchema = z.discriminatedUnion("ok", [
  z.strictObject({ ok: z.literal(true), data: z.unknown() }),
  z.strictObject({
    ok: z.literal(false),
    error: z.strictObject({
      code: z.enum(TOOL_ERROR_CODES),
      message: z.string().min(1),
      recoverable: z.boolean(),
      details: z.unknown().optional(),
    }),
  }),
]);
