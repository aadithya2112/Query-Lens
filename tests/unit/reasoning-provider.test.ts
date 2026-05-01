import { afterEach, describe, expect, it, vi } from "vitest"
import { z } from "zod"

import {
  generateStructuredData,
  isReasoningProviderError,
  mapReasoningProviderErrorToImportCode,
} from "@/lib/querylens/server/reasoning-provider"

describe("reasoning provider", () => {
  afterEach(() => {
    delete process.env.QUERYLENS_MODEL_PROVIDER
    delete process.env.OPENROUTER_API_KEY
    vi.unstubAllGlobals()
  })

  it("classifies OpenRouter 429 responses as retryable rate limits", async () => {
    process.env.QUERYLENS_MODEL_PROVIDER = "openrouter"
    process.env.OPENROUTER_API_KEY = "test-key"

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => JSON.stringify({ error: { message: "rate limited" } }),
      })
    )

    await expect(
      generateStructuredData(
        {
          prompt: "hello",
          responseJsonSchema: {
            type: "object",
            properties: {
              answer: { type: "string" },
            },
          },
          schemaName: "test_schema",
        },
        z.object({ answer: z.string() })
      )
    ).rejects.toSatisfy((error: unknown) => {
      expect(isReasoningProviderError(error)).toBe(true)
      if (!isReasoningProviderError(error)) {
        return false
      }

      expect(error.status).toBe(429)
      expect(error.code).toBe("rate_limited")
      expect(error.retryable).toBe(true)
      expect(mapReasoningProviderErrorToImportCode(error)).toBe(
        "openrouter_rate_limited"
      )
      return true
    })
  })

  it("classifies OpenRouter auth failures as non-retryable", async () => {
    process.env.QUERYLENS_MODEL_PROVIDER = "openrouter"
    process.env.OPENROUTER_API_KEY = "test-key"

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ error: { message: "unauthorized" } }),
      })
    )

    await expect(
      generateStructuredData({
        prompt: "hello",
        responseJsonSchema: {
          type: "object",
          properties: {
            answer: { type: "string" },
          },
        },
        schemaName: "test_schema",
      })
    ).rejects.toSatisfy((error: unknown) => {
      expect(isReasoningProviderError(error)).toBe(true)
      if (!isReasoningProviderError(error)) {
        return false
      }

      expect(error.code).toBe("auth_failed")
      expect(error.retryable).toBe(false)
      expect(mapReasoningProviderErrorToImportCode(error)).toBe(
        "openrouter_auth_failed"
      )
      return true
    })
  })
})
