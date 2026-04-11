import { expect, test } from "@playwright/test"

test("renders the explorer route and swaps previews from the SQL workbench", async ({
  page,
}) => {
  await page.goto("/explorer")

  await expect(page.getByText("Database explorer")).toBeVisible()
  await expect(page.getByText("Unified source browser")).toBeVisible()
  await expect(page.getByRole("button", { name: "Run mock query" })).toBeVisible()

  await page.getByRole("button", { name: "Order status summary" }).click()
  await page.getByRole("button", { name: "Run mock query" }).click()

  await expect(page.getByText("SQL result")).toBeVisible()
  await expect(page.getByText("order_status_rollup")).toBeVisible()
})
