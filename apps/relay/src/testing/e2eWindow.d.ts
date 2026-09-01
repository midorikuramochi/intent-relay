import type { IntentContract } from "@intent-relay/contracts";
import type { ToolResult } from "@intent-relay/protocol";

declare global {
  interface Window {
    __INTENT_RELAY_E2E__?: {
      invokeTool(name: string, input: unknown): Promise<ToolResult<unknown>>;
      fixtures: { readonly proposedContract: IntentContract };
      activeContractId(): string | null;
      activePreviewHash(): string | null;
    };
  }
}

export {};
