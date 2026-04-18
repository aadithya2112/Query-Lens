import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { geminiChatSendMock, geminiGenerateMock } = vi.hoisted(() => ({
  geminiChatSendMock: vi.fn(),
  geminiGenerateMock: vi.fn(),
}))
const TEST_TIMEOUT = 15_000

vi.mock("@/lib/querylens/server/gemini-client", () => ({
  createGeminiChatSession: () => ({
    sendMessage: geminiChatSendMock,
  }),
  generateGeminiResponse: geminiGenerateMock,
}))

function buildWhatChangedPlan() {
  return {
    datasetId: "sme_portfolio" as const,
    rawQuestion: "Why did SME cashflow health drop last week?",
    intent: "what_changed" as const,
    metricId: "cashflow_health_score" as const,
    timeframe: "last_week" as const,
    dateWindow: {
      startDate: "2026-03-30",
      endDate: "2026-04-05",
      dayCount: 7,
      label: "Mar 30, 2026 - Apr 5, 2026",
      relativeTimeframe: "last_week" as const,
    },
    scope: {},
    scopeDimensions: ["portfolio"] as const,
    comparisonWindow: {
      timeframe: "last_week" as const,
      comparisonBasis: "prior_period" as const,
      targetWindow: {
        startDate: "2026-03-30",
        endDate: "2026-04-05",
        dayCount: 7,
        label: "Mar 30, 2026 - Apr 5, 2026",
        relativeTimeframe: "last_week" as const,
      },
      comparisonDateWindow: {
        startDate: "2026-03-23",
        endDate: "2026-03-29",
        dayCount: 7,
        label: "Mar 23 - 29, 2026",
      },
    },
  }
}

describe("query engine provider", () => {
  beforeEach(() => {
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
            intent: "what_changed",
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
  }, TEST_TIMEOUT)

  it("returns a model-unavailable failure when interactive Gemini planning is required but not configured", async () => {
    process.env.QUERYLENS_AI_MODE = "auto"

    const { getQueryEngineProvider } = await import(
      "@/lib/querylens/server/query-engine-provider"
    )

    const provider = getQueryEngineProvider({ executionContext: "interactive" })
    const result = await provider.planQuery("Why did SME cashflow health drop last week?")

    expect(geminiGenerateMock).not.toHaveBeenCalled()
    expect(result.parsed).toBeUndefined()
    expect(result.failureKind).toBe("model_unavailable")
    expect(result.fallbackReason).toContain("needs Gemini enabled")
  }, TEST_TIMEOUT)

  it("normalizes Gemini compare plans through the generic provider seam", async () => {
    process.env.QUERYLENS_AI_MODE = "gemini"
    process.env.GEMINI_API_KEY = "test-key"

    geminiGenerateMock.mockResolvedValue({
      functionCalls: [
        {
          name: "submit_analytics_query_plan",
          args: {
            intent: "compare",
            metric: "cashflow_health_score",
            timeframe: "last_week",
            compareMode: "peer",
            compareDimension: "region",
            leftEntity: "North West",
            rightEntity: "London & South East",
          },
        },
      ],
    })

    const { getQueryEngineProvider } = await import(
      "@/lib/querylens/server/query-engine-provider"
    )

    const provider = getQueryEngineProvider({ executionContext: "interactive" })
    const result = await provider.planQuery(
      "Compare North West vs London & South East cashflow health last week"
    )

    expect(result.parsed?.intent).toBe("compare")
    expect(result.parsed?.compareSpec).toMatchObject({
      mode: "peer",
      dimension: "region",
      leftLabel: "North West",
      rightLabel: "London & South East",
    })
  }, TEST_TIMEOUT)

  it("returns a guided failure when Gemini intent metadata does not match deterministic parsing", async () => {
    process.env.QUERYLENS_AI_MODE = "gemini"
    process.env.GEMINI_API_KEY = "test-key"

    geminiGenerateMock.mockResolvedValue({
      functionCalls: [
        {
          name: "submit_analytics_query_plan",
          args: {
            intent: "compare",
            metric: "cashflow_health_score",
            compareMode: "peer",
          },
        },
      ],
    })

    const { getQueryEngineProvider } = await import(
      "@/lib/querylens/server/query-engine-provider"
    )

    const provider = getQueryEngineProvider({ executionContext: "interactive" })
    const result = await provider.planQuery("Why did North West cashflow health drop last week?")

    expect(result.parsed).toBeUndefined()
    expect(result.failureKind).toBe("guided_failure")
    expect(result.fallbackReason).toContain("could not validate Gemini")
  }, TEST_TIMEOUT)

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
      parsed: buildWhatChangedPlan(),
      activeScopeLabel: "Portfolio",
      currentScore: 98.3,
      previousScore: 100,
      drivers: [],
      contextEvents: [],
      allowedFollowUps: [
        "Focus on the North West contribution to last week's drop",
        "Focus on hospitality SMEs last week",
        "What changed this week instead?",
      ],
    })

    expect(result.summary).toContain("Portfolio moved down")
    expect(result.summary).toContain("immediately preceding grounded period")
  }, TEST_TIMEOUT)
})
