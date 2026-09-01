import { expect, test } from "@playwright/test";
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

test("demonstration to reviewed Orbit draft", async ({ page }) => {
  await gotoWorkbench(page);

  // Step 1: human demonstration (seeded through the visible sample control)
  await seedDemonstration(page);

  // Step 2: agent inspects the source through the real orchestrator path
  const inspection = await invokeTool(page, "inspect_source_demonstration", {});
  expect(inspection.ok).toBe(true);
  const trace = inspection.data?.trace as { completed: boolean; actions: unknown[] };
  expect(trace.completed).toBe(true);
  expect(trace.actions).toHaveLength(9);

  // Step 3: agent saves a provenance-valid draft; it stays a draft for the human
  const saved = await saveProposedContract(page);
  expect(saved.ok).toBe(true);
  expect((saved.data as { status: string }).status).toBe("draft");
  await expect(page.getByText("Draft — awaiting your approval")).toBeVisible();

  // Compatibility must be refused while the contract is still a draft
  const contractId = await activeContractId(page);
  const premature = await invokeTool(page, "inspect_target_compatibility", { contractId });
  expect(premature.ok).toBe(false);
  expect(premature.error?.code).toBe("CONTRACT_NOT_APPROVED");

  // Step 4: the human reviews every rule and approves through the visible UI
  await expect(page.getByRole("button", { name: "Approve contract" })).toBeDisabled();
  await approveAllRulesAndContract(page);
  // the contract badge carries the (locale-formatted) approval timestamp
  await expect(page.getByText(/✓ Approved .*2\d{3}/)).toBeVisible();

  // Step 5: compatibility inspection yields the canonical four-status result
  const compatibility = await inspectCompatibilityForActiveContract(page);
  expect(compatibility.ok).toBe(true);
  expect(compatibility.data?.mappingCounts).toEqual({
    direct: 5,
    transformed: 2,
    unsupported: 1,
    needs_decision: 1,
  });
  await expect(page.getByText("Needs your decision").first()).toBeVisible();
  await expect(page.getByText("Not transferable").first()).toBeVisible();
  await expect(
    page.getByText("registration.custom_question.dietary_restrictions").first(),
  ).toBeVisible();

  // Step 6: preparation is blocked while the Human Queue is unresolved
  const previewHash = await activePreviewHash(page);
  const blocked = await invokeTool(page, "prepare_target_draft", { contractId, previewHash });
  expect(blocked.ok).toBe(false);
  expect(blocked.error?.code).toBe("UNRESOLVED_DECISIONS");

  // Step 7: the human resolves the waitlist gap through the visible queue
  await page.getByRole("radio", { name: /External overflow form/ }).check();
  await page.getByRole("button", { name: "Record decision" }).click();
  await expect(page.getByText("All decisions recorded")).toBeVisible();

  // Step 8: the agent prepares the Orbit draft with the current preview hash
  const prepared = await invokeTool(page, "prepare_target_draft", { contractId, previewHash });
  expect(prepared.ok).toBe(true);
  expect((prepared.data as { publication: string }).publication).toBe("draft");
  expect(
    (prepared.data as { excludedUnsupportedRuleIds: string[] }).excludedUnsupportedRuleIds,
  ).toEqual(["rule-dietary"]);

  // Step 9: transfer review reports the calculated outcome and human decision
  const review = await invokeTool(page, "get_transfer_review", {});
  expect(review.ok).toBe(true);
  expect(review.data?.mappingCounts).toEqual({
    direct: 5,
    transformed: 2,
    unsupported: 1,
    needs_decision: 1,
  });
  expect(review.data?.publication).toBe("waiting_for_human");
  expect(
    (review.data?.humanResolutions as Array<{ alternativeId: string }>)[0]?.alternativeId,
  ).toBe("external_form");
  await expect(page.getByText("Waiting for human publication")).toBeVisible();
  await expect(page.getByText(/never through a tool/)).toBeVisible();

  // Step 10: no publish or activate tool exists anywhere on the Relay surface
  const publishAttempt = await invokeTool(page, "publish_event", {});
  expect(publishAttempt.ok).toBe(false);
  expect(publishAttempt.error?.message).toContain("no tool named");
});
