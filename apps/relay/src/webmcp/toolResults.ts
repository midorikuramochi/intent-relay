import { z } from "zod";
import {
  capabilityManifestSchema,
  toolFailure,
  type ToolFailure,
  type ToolResult,
} from "@intent-relay/protocol";
import { executeJsonTool, type ModelContextPort } from "@intent-relay/webmcp";
import type { RelayStore } from "../domain/storage";
import type { ProviderBridge } from "../providers/providerBridge";

export type RelayToolHandler = (
  args: Record<string, unknown>,
  signal?: AbortSignal,
) => Promise<ToolResult<unknown>>;

export function envelope(result: ToolResult<unknown>): string {
  return JSON.stringify(result);
}

export function isCancelled(signal?: AbortSignal): boolean {
  return signal?.aborted === true;
}

export function cancelledFailure(toolName: string): ToolFailure {
  return toolFailure("TOOL_CANCELLED", `Execution of "${toolName}" was cancelled`, true);
}

export const semanticTraceSchema = z.strictObject({
  id: z.string().min(1),
  eventRevision: z.number().int().min(0),
  completed: z.boolean(),
  actions: z.array(
    z.strictObject({
      id: z.string().min(1),
      timestamp: z.string().min(1),
      actor: z.literal("human"),
      command: z.string().min(1),
      semanticKey: z.string().min(1),
      before: z.unknown(),
      after: z.unknown(),
    }),
  ),
});

const gatherEventStateSchema = z.strictObject({
  title: z.string().nullable(),
  schedule: z.strictObject({ start: z.string(), end: z.string(), timezone: z.string() }).nullable(),
  capacity: z.number().nullable(),
  ticketMode: z.enum(["free", "paid"]).nullable(),
  reminderHours: z.number().nullable(),
  accessibilityNote: z.string().nullable(),
  overflowMode: z.enum(["native_waitlist", "close_registration"]).nullable(),
  dietaryQuestion: z.enum(["optional", "required"]).nullable(),
  publicationReview: z.boolean(),
  revision: z.number().int().min(0),
});

export const readEventStateDataSchema = z.strictObject({
  provider: z.literal("gather"),
  demoSessionId: z.string().min(1),
  eventState: gatherEventStateSchema,
  revision: z.number().int().min(0),
  completed: z.boolean(),
});

export const readSetupTraceDataSchema = z.strictObject({
  provider: z.literal("gather"),
  demoSessionId: z.string().min(1),
  trace: semanticTraceSchema,
});

export const describeCapabilitiesDataSchema = z.strictObject({
  provider: z.literal("orbit"),
  demoSessionId: z.string().min(1),
  manifest: capabilityManifestSchema,
});

export const prepareEventDraftDataSchema = z.strictObject({
  draftId: z.string().min(1),
  revision: z.number().int().positive(),
  publication: z.string().min(1),
});

export const readEventDraftDataSchema = z.strictObject({
  provider: z.literal("orbit"),
  demoSessionId: z.string().min(1),
  draft: z
    .strictObject({
      draftId: z.string().min(1),
      revision: z.number().int().positive(),
      previewHash: z.string().min(1),
      contractId: z.string().min(1),
      contractRevision: z.number().int().positive(),
      values: z.record(z.string(), z.unknown()),
      receivedAt: z.string().min(1),
    })
    .nullable(),
  publication: z.string().min(1),
});

export function providerFailure(
  provider: "gather" | "orbit",
  bridge: ProviderBridge,
  detail?: string,
): ToolFailure {
  const status = bridge.getInventory()[provider];
  const code = provider === "gather" ? "SOURCE_DISCONNECTED" : "TARGET_DISCONNECTED";
  const missing =
    status.missingTools.length > 0 ? `; missing tools: ${status.missingTools.join(", ")}` : "";
  return toolFailure(
    code,
    detail ??
      `The ${provider} provider at ${status.origin} is ${status.state}${missing}. Reconnect the provider and retry.`,
    true,
  );
}

/**
 * Executes one provider tool through the exact-origin bridge inventory and
 * validates the returned envelope data at the cross-origin trust boundary.
 */
export async function executeProvider<T>(
  deps: { port: ModelContextPort; bridge: ProviderBridge; store: RelayStore },
  provider: "gather" | "orbit",
  toolName: string,
  input: unknown,
  signal: AbortSignal | undefined,
  dataSchema: z.ZodType<T>,
): Promise<{ ok: true; data: T } | ToolFailure> {
  const status = deps.bridge.getInventory()[provider];
  if (status.state !== "connected") {
    return providerFailure(provider, deps.bridge);
  }
  const tool = deps.bridge.toolNamed(provider, toolName);
  if (tool === undefined) {
    return providerFailure(
      provider,
      deps.bridge,
      `The ${provider} provider at ${status.origin} does not expose "${toolName}".`,
    );
  }
  const result = await executeJsonTool(deps.port, tool, input, signal);
  if (!result.ok) {
    return result;
  }
  const parsed = dataSchema.safeParse(result.data);
  if (!parsed.success) {
    return toolFailure(
      "INVALID_TOOL_RESPONSE",
      `Tool "${toolName}" at ${status.origin} returned data that does not match its contract`,
      false,
      parsed.error.issues,
    );
  }
  const answeredSession = (parsed.data as { demoSessionId?: unknown }).demoSessionId;
  const currentSession = deps.store.getState().demoSessionId;
  if (typeof answeredSession === "string" && answeredSession !== currentSession) {
    return providerFailure(
      provider,
      deps.bridge,
      `The ${provider} provider at ${status.origin} answered for demo session "${answeredSession}" but the current session is "${currentSession}"; reset the demo so both providers reload with the current session.`,
    );
  }
  return { ok: true, data: parsed.data };
}
