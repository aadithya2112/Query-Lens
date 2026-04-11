import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const geminiGenerateMock = vi.fn()

vi.mock("@/lib/querylens/server/gemini-client", () => ({
  generateGeminiResponse: geminiGenerateMock,
}))

describe("query engine provider", () => {
  beforeEach(() => {
    vi.resetModules()
    geminiGenerateMock.mockReset()
    process.env.QUERYLENS_GEMINI_MODEL = "gemini-2.5-flash"
  })

  afterEach(() => {
    process.env.QUERYLENS_AI_MODE = "deterministic"
    delete process.env.GEMINI_API_KEY
    delete process.env.QUERYLENS_GEMINI_MODEL
  })

  it("uses Gemini to produce a structured plan through the generic provider seam", async () => {
    process.env.QUERYLENS_AI_MODE = "gemini"
    process.env.GEMINI_API_KEY = "test-key"

    geminiGenerateMock.mockResolvedValue({
      functionCalls: [
        {
          name: "submit_analytics_query_plan",
          args: {
            metric: "cashflow_health_score",
            timeframe: "last_week",
            region: "North West",
          },
        },
      ],
    })

    const { getQueryEngineProvider } = await import(
      "@/lib/querylens/server/query-engine-provider"
    )

    const provider = getQueryEngineProvider({ executionContext: "interactive" })
    const result = await provider.planQuery(
      "Help me understand why North West cashflow got worse last week"
    )

    expect(result.parsed?.datasetId).toBe("sme_portfolio")
    expect(result.parsed?.metricId).toBe("cashflow_health_score")
    expect(result.parsed?.scope.region).toBe("north_west")
  })

  it("falls back to deterministic narrative when Gemini output is invalid", async () => {
    process.env.QUERYLENS_AI_MODE = "gemini"
    process.env.GEMINI_API_KEY = "test-key"

    geminiGenerateMock.mockResolvedValue({
      json: {
        headline: "",
        summary: "",
        supportedFollowUps: [],
      },
    })

    const { getQueryEngineProvider } = await import(
      "@/lib/querylens/server/query-engine-provider"
    )

    const provider = getQueryEngineProvider({ executionContext: "interactive" })
    const result = await provider.composeNarrative({
      parsed: {
        datasetId: "sme_portfolio",
        rawQuestion: "Why did SME cashflow health drop last week?",
        intent: "what_changed",
        metricId: "cashflow_health_score",
        timeframe: "last_week",
        scope: {},
        scopeDimensions: ["portfolio"],
        comparisonWindow: {
          timeframe: "last_week",
          comparisonBasis: "prior_period",
        },
      },
      activeScopeLabel: "Portfolio",
      currentScore: 98.3,
      previousScore: 100,
      drivers: [],
      contextEvents: [],
    })

    expect(result.summary).toContain("Portfolio moved down")
  })
})
