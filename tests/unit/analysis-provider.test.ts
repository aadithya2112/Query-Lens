import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const geminiGenerateMock = vi.fn()

vi.mock("@/lib/querylens/server/gemini-client", () => ({
  generateGeminiResponse: geminiGenerateMock,
}))

describe("phase-1 provider selection", () => {
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

  it("uses Gemini for interactive narrative generation when enabled", async () => {
    process.env.QUERYLENS_AI_MODE = "auto"
    process.env.GEMINI_API_KEY = "test-key"

    geminiGenerateMock.mockResolvedValue({
      json: {
        headline: "Portfolio cashflow health fell 1.7 points",
        summary: "Gemini summary.",
        supportedFollowUps: [
          "Focus on the North West contribution to last week's drop",
          "Focus on hospitality SMEs last week",
          "What changed this week instead?",
        ],
      },
    })

    const { getPhase1Provider } = await import(
      "@/lib/querylens/server/analysis-provider"
    )

    const provider = getPhase1Provider({ executionContext: "interactive" })
    const result = await provider.composeNarrative({
      parsed: {
        rawQuestion: "Why did SME cashflow health drop last week?",
        intent: "what_changed",
        metric: "cashflow_health_score",
        timeframe: "last_week",
        scope: {},
      },
      activeScopeLabel: "Portfolio",
      currentScore: 98.3,
      previousScore: 100,
      drivers: [
        {
          id: "coverage",
          title: "Payment coverage weakened",
          impactLabel: "-0.7 pts",
          direction: "negative",
          description: "Coverage fell.",
        },
      ],
      contextEvents: [
        {
          id: "evt_1",
          collection: "service_incidents",
          occurredAt: "2026-04-02",
          weekStart: "2026-03-30",
          regionId: "north_west",
          sectorId: "hospitality",
          regionName: "North West",
          sectorName: "Hospitality",
          severity: "high",
          summary: "Settlement throughput degraded.",
          detail: "Weekend settlement confirmation slowed down.",
        },
      ],
    })

    expect(geminiGenerateMock).toHaveBeenCalledOnce()
    expect(result.summary).toBe("Gemini summary.")
  })

  it("falls back to deterministic narrative when the key is missing", async () => {
    process.env.QUERYLENS_AI_MODE = "auto"

    const { getPhase1Provider } = await import(
      "@/lib/querylens/server/analysis-provider"
    )

    const provider = getPhase1Provider({ executionContext: "interactive" })
    const result = await provider.composeNarrative({
      parsed: {
        rawQuestion: "Why did SME cashflow health drop last week?",
        intent: "what_changed",
        metric: "cashflow_health_score",
        timeframe: "last_week",
        scope: {},
      },
      activeScopeLabel: "Portfolio",
      currentScore: 98.3,
      previousScore: 100,
      drivers: [],
      contextEvents: [],
    })

    expect(geminiGenerateMock).not.toHaveBeenCalled()
    expect(result.summary).toContain("Portfolio moved down")
  })

  it("falls back when Gemini returns an invalid narrative payload", async () => {
    process.env.QUERYLENS_AI_MODE = "gemini"
    process.env.GEMINI_API_KEY = "test-key"

    geminiGenerateMock.mockResolvedValue({
      json: {
        headline: "Portfolio cashflow health fell 1.7 points",
        summary: "",
        supportedFollowUps: ["Unsupported follow up"],
      },
    })

    const { getPhase1Provider } = await import(
      "@/lib/querylens/server/analysis-provider"
    )

    const provider = getPhase1Provider({ executionContext: "interactive" })
    const result = await provider.composeNarrative({
      parsed: {
        rawQuestion: "Why did SME cashflow health drop last week?",
        intent: "what_changed",
        metric: "cashflow_health_score",
        timeframe: "last_week",
        scope: {},
      },
      activeScopeLabel: "Portfolio",
      currentScore: 98.3,
      previousScore: 100,
      drivers: [],
      contextEvents: [],
    })

    expect(geminiGenerateMock).toHaveBeenCalledOnce()
    expect(result.summary).toContain("Portfolio moved down")
    expect(result.supportedFollowUps).toContain("What changed this week instead?")
  })

  it("keeps bootstrap flows deterministic even when Gemini is configured", async () => {
    process.env.QUERYLENS_AI_MODE = "gemini"
    process.env.GEMINI_API_KEY = "test-key"

    const { getBootstrapPayload } = await import("@/lib/querylens/server/bootstrap")

    const payload = await getBootstrapPayload()

    expect(geminiGenerateMock).not.toHaveBeenCalled()
    expect(payload.initialAnalysis.summary).toContain("Portfolio moved down")
  })

  it("uses Gemini tool-calling to parse supported paraphrases", async () => {
    process.env.QUERYLENS_AI_MODE = "gemini"
    process.env.GEMINI_API_KEY = "test-key"

    geminiGenerateMock.mockResolvedValueOnce({
      functionCalls: [
        {
          name: "submit_analytics_query_plan",
          args: {
            metric: "cashflow_health_score",
            timeframe: "last_week",
            region: "North West",
            sector: "Hospitality",
          },
        },
      ],
    })
    geminiGenerateMock.mockResolvedValueOnce({
      json: {
        headline: "North West / Hospitality cashflow health fell 5.4 points",
        summary: "Gemini summary.",
        supportedFollowUps: [
          "Focus on the North West contribution to last week's drop",
          "Focus on hospitality SMEs last week",
          "What changed this week instead?",
        ],
      },
    })

    const { getPhase1Provider } = await import(
      "@/lib/querylens/server/analysis-provider"
    )

    const provider = getPhase1Provider({ executionContext: "interactive" })
    const result = await provider.parseQuestion(
      "Help me understand why North West hospitality cashflow got worse last week"
    )

    expect(result.parsed).toEqual({
      datasetId: "sme_portfolio",
      rawQuestion:
        "Help me understand why North West hospitality cashflow got worse last week",
      intent: "what_changed",
      metricId: "cashflow_health_score",
      timeframe: "last_week",
      scope: {
        region: "north_west",
        sector: "hospitality",
      },
      scopeDimensions: ["region", "sector"],
      comparisonWindow: {
        timeframe: "last_week",
        comparisonBasis: "prior_period",
      },
    })
  })

  it("falls back to deterministic parsing when Gemini returns invalid scope values", async () => {
    process.env.QUERYLENS_AI_MODE = "gemini"
    process.env.GEMINI_API_KEY = "test-key"

    geminiGenerateMock.mockResolvedValue({
      functionCalls: [
        {
          name: "submit_analytics_query_plan",
          args: {
            metric: "cashflow_health_score",
            timeframe: "last_week",
            region: "Atlantis",
          },
        },
      ],
    })

    const { getPhase1Provider } = await import(
      "@/lib/querylens/server/analysis-provider"
    )

    const provider = getPhase1Provider({ executionContext: "interactive" })
    const result = await provider.parseQuestion(
      "Why did cashflow health drop last week?"
    )

    expect(result.parsed?.scope).toEqual({})
  })

  it("preserves explicit scope overrides over Gemini-extracted scope", async () => {
    process.env.QUERYLENS_AI_MODE = "gemini"
    process.env.GEMINI_API_KEY = "test-key"

    geminiGenerateMock.mockResolvedValue({
      functionCalls: [
        {
          name: "submit_analytics_query_plan",
          args: {
            metric: "cashflow_health_score",
            timeframe: "this_week",
            region: "Midlands",
          },
        },
      ],
    })

    const { getPhase1Provider } = await import(
      "@/lib/querylens/server/analysis-provider"
    )

    const provider = getPhase1Provider({ executionContext: "interactive" })
    const result = await provider.parseQuestion(
      "Why did cashflow health drop this week?",
      {
        region: "North West",
      }
    )

    expect(result.parsed?.scope.region).toBe("north_west")
  })

  it("returns a guided fallback for unsupported requests when Gemini rejects them", async () => {
    process.env.QUERYLENS_AI_MODE = "gemini"
    process.env.GEMINI_API_KEY = "test-key"

    geminiGenerateMock.mockResolvedValue({
      functionCalls: [
        {
          name: "reject_analytics_query_plan",
          args: {
            reason: "Phase 1 only supports cashflow health questions for this week or last week.",
          },
        },
      ],
    })

    const { getPhase1Provider } = await import(
      "@/lib/querylens/server/analysis-provider"
    )

    const provider = getPhase1Provider({ executionContext: "interactive" })
    const result = await provider.parseQuestion("Why did revenue drop last month?")

    expect(result.parsed).toBeUndefined()
    expect(result.fallbackReason).toContain("cashflow health")
  })
})
