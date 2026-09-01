import { expect, type Page } from "@playwright/test";

// The Window facade type comes from apps/relay/src/testing/e2eWindow.d.ts,
// which e2e/tsconfig.json includes; nothing test-typed reaches production code.

export interface Envelope {
  ok: boolean;
  data?: Record<string, unknown>;
  error?: { code: string; message: string };
}

export const invokeTool = (page: Page, name: string, input: unknown): Promise<Envelope> =>
  page.evaluate(
    async ([toolName, toolInput]) =>
      (await window.__INTENT_RELAY_E2E__!.invokeTool(toolName as string, toolInput)) as Envelope,
    [name, input] as const,
  );

export const activeContractId = (page: Page): Promise<string | null> =>
  page.evaluate(() => window.__INTENT_RELAY_E2E__!.activeContractId());

export const activePreviewHash = (page: Page): Promise<string | null> =>
  page.evaluate(() => window.__INTENT_RELAY_E2E__!.activePreviewHash());

export const saveProposedContract = (page: Page): Promise<Envelope> =>
  page.evaluate(async () => {
    const facade = window.__INTENT_RELAY_E2E__!;
    return (await facade.invokeTool("save_intent_contract_draft", {
      contract: facade.fixtures.proposedContract,
    })) as Envelope;
  });

export const inspectCompatibilityForActiveContract = (page: Page): Promise<Envelope> =>
  page.evaluate(async () => {
    const facade = window.__INTENT_RELAY_E2E__!;
    return (await facade.invokeTool("inspect_target_compatibility", {
      contractId: facade.activeContractId(),
    })) as Envelope;
  });

export async function gotoWorkbench(page: Page): Promise<void> {
  await page.goto("/workbench?e2e=1");
  await expect(page.getByText("E2E TEST ADAPTER ACTIVE")).toBeVisible();
}

export async function seedDemonstration(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Load sample demonstration" }).click();
}

export async function approveAllRulesAndContract(page: Page): Promise<void> {
  for (let i = 0; i < 9; i += 1) {
    await page.getByRole("button", { name: "Approve rule", disabled: false }).first().click();
  }
  await page.getByRole("button", { name: "Approve contract" }).click();
}
