import { describe, expect, it } from "vitest"

import { resolveImportErrorMessage } from "@/app/onboarding/page"

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
})
