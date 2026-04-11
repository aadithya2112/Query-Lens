import { expect, test } from "@playwright/test"

test("renders the phase-1 vertical slice and answers the flagship question", async ({
  page,
}) => {
  await page.goto("/")

  await expect(
    page.getByText("Cross-source “what changed” vertical slice")
  ).toBeVisible()
  await expect(page.getByText("Evidence and corroboration")).toBeVisible()

  const input = page.getByPlaceholder("Why did SME cashflow health drop last week?")
  await input.fill("Why did SME cashflow health drop last week?")
  await page.getByRole("button", { name: "Ask" }).click()

  await expect(page.getByText(/cashflow health/i).first()).toBeVisible()
  await expect(page.getByText("Top drivers")).toBeVisible()
  await expect(page.getByText("Assumptions")).toBeVisible()
})
