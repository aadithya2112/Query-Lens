import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/querylens/server/dataset-runtime", async () => {
  const { createMockQueryLensDatasetRuntime } = await import(
    "../helpers/querylens-runtime"
  )

  return {
    getQueryLensDatasetRuntime: async () => createMockQueryLensDatasetRuntime(),
  }
})

import ExplorerPage from "@/app/explorer/page"

describe("/explorer page", () => {
  it("renders the source context experience", async () => {
    const element = await ExplorerPage()
    const html = renderToStaticMarkup(element)

    expect(html).toContain("Source context")
    expect(html).toContain("Connected sources")
    expect(html).toContain("PostgreSQL preview")
    expect(html).toContain("MongoDB preview")
  })
})
