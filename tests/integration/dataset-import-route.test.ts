import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { importCsvDatasetMock } = vi.hoisted(() => ({
  importCsvDatasetMock: vi.fn(),
}))

vi.mock("@/lib/querylens/server/csv-onboarding", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/querylens/server/csv-onboarding")
  >("@/lib/querylens/server/csv-onboarding")

  return {
    ...actual,
    importCsvDataset: importCsvDatasetMock,
  }
})

import { POST } from "@/app/api/datasets/import/csv/route"
import { CsvImportError } from "@/lib/querylens/server/csv-onboarding"

describe("/api/datasets/import/csv", () => {
  beforeEach(() => {
    importCsvDatasetMock.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("returns a structured 503 when OpenRouter rate limiting is exhausted", async () => {
    importCsvDatasetMock.mockRejectedValue(
      new CsvImportError({
        message:
          "OpenRouter is temporarily rate-limiting semantic refinement. Please retry in a moment.",
        code: "openrouter_rate_limited",
        retryable: true,
        provider: "openrouter",
        status: 503,
      })
    )

    const formData = new FormData()
    formData.set(
      "file",
      new File(["date,revenue\n2026-04-01,12"], "sample.csv", {
        type: "text/csv",
      })
    )

    const response = await POST(
      new Request("http://localhost/api/datasets/import/csv", {
        method: "POST",
        body: formData,
      })
    )
    const payload = await response.json()

    expect(response.status).toBe(503)
    expect(payload).toMatchObject({
      code: "openrouter_rate_limited",
      retryable: true,
      provider: "openrouter",
    })
  })
})
