import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import {
  buildSourceContextHref,
  DatasetSourceContextAction,
  resolveImportErrorMessage,
} from "@/app/onboarding/page"

describe("onboarding import error messaging", () => {
  it("renders a targeted message for OpenRouter 429 responses", () => {
    expect(
      resolveImportErrorMessage({
        code: "openrouter_rate_limited",
        error: "OpenRouter request failed with 429.",
        retryable: true,
        provider: "openrouter",
      })
    ).toContain("temporarily rate-limiting semantic refinement")
  })

  it("falls back to the server error for unknown failures", () => {
    expect(
      resolveImportErrorMessage({
        code: "csv_import_failed",
        error: "Something else failed.",
        retryable: false,
      })
    ).toBe("Something else failed.")
  })

  it("builds an explorer link for newly imported CSV datasets", () => {
    expect(buildSourceContextHref("csv_sales")).toBe(
      "/explorer?datasetId=csv_sales",
    )
  })

  it("renders a source context action for an imported dataset", () => {
    const html = renderToStaticMarkup(
      createElement(DatasetSourceContextAction, { datasetId: "csv_sales" }),
    )

    expect(html).toContain("Source context")
    expect(html).toContain("/explorer?datasetId=csv_sales")
  })
})
