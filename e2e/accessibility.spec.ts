import { expect, test, type Page } from "@playwright/test";
import {
  gotoWorkbench,
  inspectCompatibilityForActiveContract,
  invokeTool,
  saveProposedContract,
  seedDemonstration,
} from "./support";

async function seedToQueue(page: Page): Promise<void> {
  await gotoWorkbench(page);
  await seedDemonstration(page);
  await invokeTool(page, "inspect_source_demonstration", {});
  await saveProposedContract(page);
}

async function tabTo(page: Page, accessibleName: string | RegExp): Promise<boolean> {
  for (let i = 0; i < 120; i += 1) {
    const focused = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement | null;
      if (element === null) {
        return "";
      }
      return (element.getAttribute("aria-label") ?? element.textContent?.trim() ?? "").slice(
        0,
        120,
      );
    });
    const matches =
      typeof accessibleName === "string"
        ? focused === accessibleName
        : accessibleName.test(focused);
    if (matches) {
      return true;
    }
    await page.keyboard.press("Tab");
  }
  return false;
}

test("iframes carry identifying titles and controls have accessible names", async ({ page }) => {
  await page.goto("/workbench?e2e=1");
  await expect(page.locator('iframe[title="Gather source provider"]')).toBeAttached();
  await expect(page.locator('iframe[title="Orbit destination provider"]')).toBeAttached();

  for (const name of [
    "Reset demo",
    "Load sample demonstration",
    "1 · Demonstrate",
    "2 · Verify Contract",
    "3 · Transfer",
    "4 · Review",
  ]) {
    await expect(page.getByRole("button", { name })).toBeVisible();
  }

  const unnamedButtons = await page.evaluate(
    () =>
      [...document.querySelectorAll("button")].filter(
        (button) => (button.getAttribute("aria-label") ?? button.textContent?.trim() ?? "") === "",
      ).length,
  );
  expect(unnamedButtons).toBe(0);
});

test("provider and mapping states are communicated with text, not color alone", async ({
  page,
}) => {
  await seedToQueue(page);
  await expect(page.getByText("● Connected").first()).toBeVisible();
  await expect(page.getByText("◐ Draft — awaiting your approval")).toBeVisible();
  await expect(page.getByText("? Proposed").first()).toBeVisible();

  for (let i = 0; i < 9; i += 1) {
    await page.getByRole("button", { name: "Approve rule", disabled: false }).first().click();
  }
  await page.getByRole("button", { name: "Approve contract" }).click();
  await inspectCompatibilityForActiveContract(page);
  // the 5/2/1/1 strip communicates preserved with icon + count + label
  await expect(page.getByText("✓ 5").first()).toBeVisible();
  await expect(page.getByText("Preserved").first()).toBeVisible();
  // non-trivial rows keep visible text+icon stamps in the evidence list
  await expect(page.getByText("↻ Adapted").first()).toBeVisible();
  await expect(page.getByText("✕ Not transferable").first()).toBeVisible();
  await expect(page.getByText("⚑ Needs your decision").first()).toBeVisible();
});

test("rule review and the Human Queue are keyboard-operable", async ({ page }) => {
  await seedToQueue(page);

  // approve the first rule with the keyboard
  expect(await tabTo(page, "Approve rule")).toBe(true);
  await page.keyboard.press("Enter");
  await expect(page.getByText("✓ Approved").first()).toBeVisible();

  // finish approval (mouse for speed), reach the Human Queue
  for (let i = 0; i < 8; i += 1) {
    await page.getByRole("button", { name: "Approve rule", disabled: false }).first().click();
  }
  await page.getByRole("button", { name: "Approve contract" }).click();
  await inspectCompatibilityForActiveContract(page);

  // choose the alternative and record it entirely with the keyboard
  await page.getByRole("radio", { name: /Close registration/ }).focus();
  await page.keyboard.press("ArrowDown");
  const checked = await page.getByRole("radio", { name: /External overflow form/ }).isChecked();
  expect(checked).toBe(true);
  expect(await tabTo(page, "Record decision")).toBe(true);
  await page.keyboard.press("Enter");
  await expect(page.getByText("All decisions recorded")).toBeVisible();
});

test.describe("reduced motion", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  test("the workflow still operates under prefers-reduced-motion", async ({ page }) => {
    await seedToQueue(page);
    await expect(page.getByText("Draft — awaiting your approval")).toBeVisible();
    await page.getByRole("button", { name: "Approve rule", disabled: false }).first().click();
    await expect(page.getByText("✓ Approved").first()).toBeVisible();
  });
});
