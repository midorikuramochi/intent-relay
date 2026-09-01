import { toolFailure, toolResultSchema, type ToolResult } from "@intent-relay/protocol";
import type { DiscoveredTool, ModelContextPort } from "./modelContext";

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export async function executeJsonTool<T = unknown>(
  port: ModelContextPort,
  tool: DiscoveredTool,
  input: unknown,
  signal?: AbortSignal,
): Promise<ToolResult<T>> {
  if (signal?.aborted) {
    return toolFailure("TOOL_CANCELLED", `Execution of "${tool.name}" was cancelled`, true);
  }

  const serialized = JSON.stringify(input ?? {});
  let raw: unknown;
  try {
    raw = await port.executeTool(tool, serialized, { signal });
  } catch (error) {
    if (isAbortError(error) || signal?.aborted) {
      return toolFailure("TOOL_CANCELLED", `Execution of "${tool.name}" was cancelled`, true);
    }
    return toolFailure(
      "INVALID_TOOL_RESPONSE",
      `Tool "${tool.name}" at ${tool.origin} threw instead of returning an envelope`,
      false,
      error instanceof Error ? error.message : String(error),
    );
  }

  if (typeof raw !== "string") {
    return toolFailure(
      "INVALID_TOOL_RESPONSE",
      `Tool "${tool.name}" at ${tool.origin} returned a non-string result`,
      false,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return toolFailure(
      "INVALID_TOOL_RESPONSE",
      `Tool "${tool.name}" at ${tool.origin} returned invalid JSON`,
      false,
    );
  }

  const envelope = toolResultSchema.safeParse(parsed);
  if (!envelope.success) {
    return toolFailure(
      "INVALID_TOOL_RESPONSE",
      `Tool "${tool.name}" at ${tool.origin} returned a malformed envelope`,
      false,
      envelope.error.issues,
    );
  }
  return envelope.data as ToolResult<T>;
}
