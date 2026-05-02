import { afterEach, describe, expect, it } from "vitest"

import { getQueryLensAiConfig } from "@/lib/querylens/server/ai-config"

describe("ai config", () => {
  afterEach(() => {
    delete process.env.QUERYLENS_MODEL_PROVIDER
    delete process.env.OPENROUTER_API_KEY
    delete process.env.GEMINI_API_KEY
    delete process.env.QUERYLENS_OPENROUTER_MODEL
  })

  it("prefers OpenRouter as the reasoning provider when configured", () => {
    process.env.OPENROUTER_API_KEY = "openrouter-key"

    const config = getQueryLensAiConfig()

    expect(config.reasoningProvider).toBe("openrouter")
    expect(config.openrouterModel).toBe("deepseek/deepseek-v4-pro")
  })

  it("respects an explicit deterministic provider override", () => {
    process.env.OPENROUTER_API_KEY = "openrouter-key"
    process.env.QUERYLENS_MODEL_PROVIDER = "deterministic"

    const config = getQueryLensAiConfig()

    expect(config.reasoningProvider).toBe("deterministic")
  })
})
