import { expect, test } from "@playwright/test"

test("renders the compare slice for cashflow health", async ({ page }) => {
  await page.goto("/")
  await page.getByRole("link", { name: "Launch Workspace" }).click()

  const input = page.getByPlaceholder("Ask a question...")
  await expect(input).toBeVisible({ timeout: 30_000 })
  await input.fill("Compare cashflow health this week vs last week")
  await input.press("Enter")

  await expect(page.getByText(/leads the cashflow comparison|effectively level/i).first()).toBeVisible()
  await expect(page.getByText("Top differences")).toBeVisible()
  await expect(page.getByText("Delta")).toBeVisible()
})
