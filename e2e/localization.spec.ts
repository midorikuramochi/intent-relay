import { expect, test } from "@playwright/test";
import { gotoWorkbench, invokeTool, seedDemonstration } from "./support";

test("locale is presentation-only: labels switch, WebMCP behavior does not", async ({ page }) => {
  await gotoWorkbench(page);

  // Default locale is English.
  await expect(page.getByRole("button", { name: "EN" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Reset demo" })).toBeVisible();
  await expect(page.getByRole("button", { name: "1 · Demonstrate" })).toBeVisible();
  await expect(page.getByText("Set up the event the way you normally would")).toBeVisible();

  // The agent workflow starts in English…
  await seedDemonstration(page);
  const inspectedEn = await invokeTool(page, "inspect_source_demonstration", {});
  expect(inspectedEn.ok).toBe(true);

  // …and switching to Japanese visibly changes representative labels.
  await page.getByRole("button", { name: "日本語" }).click();
  await expect(page.getByRole("button", { name: "日本語" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("button", { name: "デモをリセット" })).toBeVisible();
  await expect(page.getByRole("button", { name: "1 · 実演" })).toBeVisible();
  await expect(page.getByText("公開には人間の承認が必要です")).toBeVisible();

  // The exact same agent tools answer identically in Japanese.
  const inspectedJa = await invokeTool(page, "inspect_source_demonstration", {});
  expect(inspectedJa.ok).toBe(true);
  expect(inspectedJa.data?.trace).toEqual(inspectedEn.data?.trace);
  const publishAttempt = await invokeTool(page, "publish_event", {});
  expect(publishAttempt.ok).toBe(false);
  expect(publishAttempt.error?.message).toContain("no tool named");

  // The selection persists across a reload (independent of the demo session).
  await page.reload();
  await expect(page.getByText("E2E TEST ADAPTER ACTIVE")).toBeVisible();
  await expect(page.getByRole("button", { name: "デモをリセット" })).toBeVisible();

  // Reset demo rotates the session but must not change the language.
  const oldSession = await page.locator(".session-code code").textContent();
  await page.getByRole("button", { name: "デモをリセット" }).click();
  await expect(page.locator(".session-code code")).not.toHaveText(oldSession ?? "");
  await expect(page.getByRole("button", { name: "デモをリセット" })).toBeVisible();
  await expect(page.getByRole("button", { name: "1 · 実演" })).toBeVisible();

  // Switching back to English works.
  await page.getByRole("button", { name: "EN" }).click();
  await expect(page.getByRole("button", { name: "Reset demo" })).toBeVisible();
  await expect(page.getByRole("button", { name: "1 · Demonstrate" })).toBeVisible();
});
