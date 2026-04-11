import { expect, test } from "@playwright/test"

test("renders the breakdown slice for at-risk accounts", async ({ page }) => {
  await page.goto("/")
  await page.getByRole("link", { name: "Launch Workspace" }).click()

  const input = page.getByPlaceholder("Ask a question...")
  await expect(input).toBeVisible({ timeout: 30_000 })
  await input.fill("What makes up at-risk accounts by region and sector last week?")
  await input.press("Enter")

  await expect(page.getByText(/at-risk/i).first()).toBeVisible()
  await expect(page.getByText("Top concentrations")).toBeVisible()
  await expect(page.getByText("daily_account_metrics").first()).toBeVisible()
})
