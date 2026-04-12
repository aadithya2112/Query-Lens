import { expect, test } from "@playwright/test"

test("renders the source context route with source summaries and previews", async ({
  page,
}) => {
  await page.goto("/explorer")

  await expect(page.getByText("Source context")).toBeVisible()
  await expect(page.getByText("Connected sources")).toBeVisible()
  await expect(page.getByText("PostgreSQL preview")).toBeVisible()
  await expect(page.getByText("MongoDB preview")).toBeVisible()
})
