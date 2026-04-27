import { expect, test } from "@playwright/test"

test("renders the phase-1 vertical slice and answers the flagship question", async ({
  page,
}) => {
  await page.goto("/")

  await expect(
    page.getByRole("heading", { name: "Talk to Data. Brilliantly simple." })
  ).toBeVisible()
  await page.getByRole("link", { name: "Launch Workspace" }).click()

  await expect(page.getByPlaceholder("Ask a question...")).toBeVisible({
    timeout: 30_000,
  })
  await expect(
    page.getByText("Why did SME cashflow health drop last week?").first(),
  ).toBeVisible()
  await expect(page.getByText("Evidence and corroboration")).toBeVisible()

  const input = page.getByPlaceholder("Ask a question...")
  await input.fill("Why did SME cashflow health drop last week?")
  await input.press("Enter")

  await expect(page.getByText(/cashflow health/i).first()).toBeVisible()
  await expect(page.getByText("Top drivers")).toBeVisible()
  await expect(page.getByText("Assumptions")).toBeVisible()
})
