import { expect, test, type Page } from "@playwright/test";
import {
  activeContractId,
  activePreviewHash,
  approveAllRulesAndContract,
  gotoWorkbench,
  inspectCompatibilityForActiveContract,
  invokeTool,
  saveProposedContract,
  seedDemonstration,
} from "./support";

async function reachApprovedPreview(
  page: Page,
): Promise<{ contractId: string | null; previewHash: string | null }> {
  await gotoWorkbench(page);
  await seedDemonstration(page);
  await invokeTool(page, "inspect_source_demonstration", {});
  await saveProposedContract(page);
  await approveAllRulesAndContract(page);
  await inspectCompatibilityForActiveContract(page);
  return {
    contractId: await activeContractId(page),
    previewHash: await activePreviewHash(page),
  };
}

test("unresolved Human Queue blocks preparation and says so in the UI", async ({ page }) => {
  const { contractId, previewHash } = await reachApprovedPreview(page);
  await expect(page.getByText(/decision\(s\) must be resolved/)).toBeVisible();
  await expect(page.getByText("The agent never chooses for you")).toBeVisible();
  const blocked = await invokeTool(page, "prepare_target_draft", { contractId, previewHash });
  expect(blocked.ok).toBe(false);
  expect(blocked.error?.code).toBe("UNRESOLVED_DECISIONS");
  await expect(page.getByText("⚑ 1 unresolved").first()).toBeVisible();
});

test("a revised contract invalidates the old preview hash", async ({ page }) => {
  const { contractId, previewHash } = await reachApprovedPreview(page);
  await page.getByRole("radio", { name: /External overflow form/ }).check();
  await page.getByRole("button", { name: "Record decision" }).click();

  await page.getByRole("button", { name: "2 · Verify Contract" }).click();
  await page.getByRole("button", { name: "Revise contract" }).click();
  await expect(page.getByText("Draft — awaiting your approval")).toBeVisible();

  const stale = await invokeTool(page, "prepare_target_draft", { contractId, previewHash });
  expect(stale.ok).toBe(false);
  expect(stale.error?.code).toBe("STALE_PREVIEW");
});

test("Reset demo rotates the session and clears the whole transfer", async ({ page }) => {
  const { contractId, previewHash } = await reachApprovedPreview(page);
  await page.getByRole("radio", { name: /External overflow form/ }).check();
  await page.getByRole("button", { name: "Record decision" }).click();
  await invokeTool(page, "prepare_target_draft", { contractId, previewHash });
  const review = await invokeTool(page, "get_transfer_review", {});
  expect(review.ok).toBe(true);

  const oldSession = await page.locator(".session-code code").textContent();
  await page.getByRole("button", { name: "Reset demo" }).click();

  await expect(page.locator(".session-code code")).not.toHaveText(oldSession ?? "");
  await expect(page.getByRole("button", { name: "Load sample demonstration" })).toBeVisible();

  // previous contract, preview, and target draft are no longer active
  await page.getByRole("button", { name: "2 · Verify Contract" }).click();
  await expect(page.getByText("No proposed contract yet")).toBeVisible();
  await page.getByRole("button", { name: "3 · Transfer" }).click();
  await expect(page.getByText("No compatibility preview yet")).toBeVisible();
  await page.getByRole("button", { name: "4 · Review" }).click();
  await expect(page.getByText("No prepared Orbit draft yet")).toBeVisible();

  const reviewAfterReset = await invokeTool(page, "get_transfer_review", {});
  expect(reviewAfterReset.ok).toBe(false);
  expect(reviewAfterReset.error?.code).toBe("DRAFT_NOT_PREPARED");

  // publication protection statement survives reset; no publish tool appears
  await expect(page.getByText("Human approval required for publication")).toBeVisible();
  const publishAttempt = await invokeTool(page, "publish_event", {});
  expect(publishAttempt.ok).toBe(false);
});
