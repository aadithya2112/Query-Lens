import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const {
  generateStructuredDataMock,
  isReasoningProviderErrorMock,
  mapReasoningProviderErrorToImportCodeMock,
} = vi.hoisted(() => ({
  generateStructuredDataMock: vi.fn(),
  isReasoningProviderErrorMock: vi.fn(),
  mapReasoningProviderErrorToImportCodeMock: vi.fn(),
}))

vi.mock("@/lib/querylens/server/reasoning-provider", () => ({
  generateStructuredData: generateStructuredDataMock,
  isReasoningProviderError: isReasoningProviderErrorMock,
  mapReasoningProviderErrorToImportCode: mapReasoningProviderErrorToImportCodeMock,
}))

import {
  refineSemanticDraft,
} from "@/lib/querylens/server/csv-onboarding"

describe("csv onboarding refinement", () => {
  beforeEach(() => {
    generateStructuredDataMock.mockReset()
    isReasoningProviderErrorMock.mockReset()
    mapReasoningProviderErrorToImportCodeMock.mockReset()
    process.env.QUERYLENS_MODEL_PROVIDER = "openrouter"
    process.env.OPENROUTER_API_KEY = "test-key"
  })

  afterEach(() => {
    delete process.env.QUERYLENS_MODEL_PROVIDER
    delete process.env.OPENROUTER_API_KEY
    vi.restoreAllMocks()
  })

  it("retries OpenRouter refinement three total attempts for retryable 429 errors", async () => {
    const rateLimitError = {
      status: 429,
      retryable: true,
    }

    isReasoningProviderErrorMock.mockReturnValue(true)
    mapReasoningProviderErrorToImportCodeMock.mockReturnValue(
      "openrouter_rate_limited"
    )
    generateStructuredDataMock.mockRejectedValue(rateLimitError)
    vi.spyOn(globalThis, "setTimeout").mockImplementation((handler: TimerHandler) => {
      if (typeof handler === "function") {
        handler()
      }
      return 0 as unknown as ReturnType<typeof setTimeout>
    })

    const promise = refineSemanticDraft({
      filename: "sample.csv",
      draft: {
        datasetId: "csv_test",
        datasetLabel: "Sample",
        description: "Sample",
        sourceMode: "database",
        timeCoverage: "Unknown",
        dimensions: [],
        metrics: [],
        sources: [],
        notes: [],
      },
      columns: [],
    })

    await expect(promise).resolves.toMatchObject({
      datasetId: "csv_test",
      datasetLabel: "Sample",
    })
    expect(generateStructuredDataMock).toHaveBeenCalledTimes(3)
  })

  it("does not retry non-retryable provider failures", async () => {
    const authError = {
      status: 401,
      retryable: false,
    }

    isReasoningProviderErrorMock.mockReturnValue(true)
    mapReasoningProviderErrorToImportCodeMock.mockReturnValue(
      "openrouter_auth_failed"
    )
    generateStructuredDataMock.mockRejectedValue(authError)

    await expect(
      refineSemanticDraft({
        filename: "sample.csv",
        draft: {
          datasetId: "csv_test",
          datasetLabel: "Sample",
          description: "Sample",
          sourceMode: "database",
          timeCoverage: "Unknown",
          dimensions: [],
          metrics: [],
          sources: [],
          notes: [],
        },
        columns: [],
      })
    ).rejects.toMatchObject({
      code: "openrouter_auth_failed",
      retryable: false,
    })

    expect(generateStructuredDataMock).toHaveBeenCalledTimes(1)
  })
})
