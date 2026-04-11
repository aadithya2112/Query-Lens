import { expect, test } from "@playwright/test"

test("renders the discovery flow and restores the conversation after refresh", async ({
  page,
}) => {
  await page.goto("/")
  await page.getByRole("link", { name: "Launch Workspace" }).click()

  const input = page.getByPlaceholder("Ask a question...")
  await expect(input).toBeVisible({ timeout: 30_000 })
  await input.fill("What data is currently stored?")
  await input.press("Enter")

  await expect(page.getByText("Catalog and suggested paths")).toBeVisible()
  await expect(page.getByText("Dataset overview")).toBeVisible()

  await page.reload()

  await expect(page.getByPlaceholder("Ask a question...")).toBeVisible({
    timeout: 30_000,
  })
  await expect(page.getByText("What data is currently stored?").first()).toBeVisible()
  await expect(page.getByText("Catalog and suggested paths")).toBeVisible()
})
