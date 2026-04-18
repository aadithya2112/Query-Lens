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

function buildWhatChangedPlan(args: {
  rawQuestion: string
  timeframe: "this_week" | "last_week"
  scope?: {
    region?: string
    sector?: string
  }
}) {
  const targetWindow =
    args.timeframe === "this_week"
      ? {
          startDate: "2026-04-06",
          endDate: "2026-04-12",
          dayCount: 7,
          label: "Apr 6 - 12, 2026",
          relativeTimeframe: "this_week" as const,
        }
      : {
          startDate: "2026-03-30",
          endDate: "2026-04-05",
          dayCount: 7,
          label: "Mar 30, 2026 - Apr 5, 2026",
          relativeTimeframe: "last_week" as const,
        }
  const comparisonDateWindow =
    args.timeframe === "this_week"
      ? {
          startDate: "2026-03-30",
          endDate: "2026-04-05",
          dayCount: 7,
          label: "Mar 30, 2026 - Apr 5, 2026",
          relativeTimeframe: "last_week" as const,
        }
      : {
          startDate: "2026-03-23",
          endDate: "2026-03-29",
          dayCount: 7,
          label: "Mar 23 - 29, 2026",
        }

  return {
    datasetId: "sme_portfolio" as const,
    rawQuestion: args.rawQuestion,
    intent: "what_changed" as const,
    metricId: "cashflow_health_score" as const,
    timeframe: args.timeframe,
    dateWindow: targetWindow,
    scope: args.scope ?? {},
    scopeDimensions:
      args.scope?.region && args.scope?.sector
        ? (["region", "sector"] as const)
        : args.scope?.region
          ? (["region"] as const)
          : args.scope?.sector
            ? (["sector"] as const)
            : (["portfolio"] as const),
    comparisonWindow: {
      timeframe: args.timeframe,
      comparisonBasis: "prior_period" as const,
      targetWindow,
      comparisonDateWindow,
    },
  }
}

describe("phase-1 provider selection", () => {
  beforeEach(() => {
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
        summary:
          "Gemini summary ties the weekly drop to weaker payment coverage, notes the settlement issues in context, and keeps the comparison anchored to the prior validated week.",
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
      parsed: buildWhatChangedPlan({
        rawQuestion: "Why did SME cashflow health drop last week?",
        timeframe: "last_week",
      }),
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
      allowedFollowUps: [
        "Focus on the North West contribution to last week's drop",
        "Focus on hospitality SMEs last week",
        "What changed this week instead?",
      ],
    })

    expect(geminiGenerateMock).toHaveBeenCalledOnce()
    expect(result.summary).toContain("Gemini summary ties the weekly drop")
  }, TEST_TIMEOUT)

  it("falls back to deterministic narrative when the key is missing", async () => {
    process.env.QUERYLENS_AI_MODE = "auto"

    const { getPhase1Provider } = await import(
      "@/lib/querylens/server/analysis-provider"
    )

    const provider = getPhase1Provider({ executionContext: "interactive" })
    const result = await provider.composeNarrative({
      parsed: buildWhatChangedPlan({
        rawQuestion: "Why did SME cashflow health drop last week?",
        timeframe: "last_week",
      }),
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

    expect(geminiGenerateMock).not.toHaveBeenCalled()
    expect(result.summary).toContain("Portfolio moved down")
    expect(result.summary).toContain("immediately preceding grounded period")
  }, TEST_TIMEOUT)

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
      parsed: buildWhatChangedPlan({
        rawQuestion: "Why did SME cashflow health drop last week?",
        timeframe: "last_week",
      }),
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

    expect(geminiGenerateMock).toHaveBeenCalledOnce()
    expect(result.summary).toContain("Portfolio moved down")
    expect(result.summary).toContain("immediately preceding grounded period")
    expect(result.supportedFollowUps).toContain("What changed this week instead?")
  }, TEST_TIMEOUT)

  it("keeps bootstrap flows deterministic even when Gemini is configured", async () => {
    process.env.QUERYLENS_AI_MODE = "gemini"
    process.env.GEMINI_API_KEY = "test-key"

    const { getBootstrapPayload } = await import("@/lib/querylens/server/bootstrap")

    const payload = await getBootstrapPayload()

    expect(geminiGenerateMock).not.toHaveBeenCalled()
    expect(payload.initialAnalysis.summary).toContain("Portfolio moved down")
    expect(payload.initialAnalysis.summary).toContain("immediately preceding grounded period")
  }, TEST_TIMEOUT)

  it("uses Gemini tool-calling to parse supported paraphrases", async () => {
    process.env.QUERYLENS_AI_MODE = "gemini"
    process.env.GEMINI_API_KEY = "test-key"

    geminiGenerateMock.mockResolvedValueOnce({
      functionCalls: [
        {
          name: "submit_analytics_query_plan",
          args: {
            intent: "what_changed",
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
        summary:
          "Gemini summary explains that North West hospitality weakened on payment coverage, adds the settlement context, and frames the answer against the prior grounded week.",
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
      ...buildWhatChangedPlan({
        rawQuestion:
          "Help me understand why North West hospitality cashflow got worse last week",
        timeframe: "last_week",
        scope: {
          region: "north_west",
          sector: "hospitality",
        },
      }),
    })
  }, TEST_TIMEOUT)

  it("ignores unsupported Gemini scope extraction because deterministic parsing owns input resolution", async () => {
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

    expect(result.parsed).toMatchObject({
      intent: "what_changed",
      timeframe: "last_week",
      scope: {},
    })
  }, TEST_TIMEOUT)

  it("preserves explicit scope overrides over Gemini-extracted scope", async () => {
    process.env.QUERYLENS_AI_MODE = "gemini"
    process.env.GEMINI_API_KEY = "test-key"

    geminiGenerateMock.mockResolvedValue({
      functionCalls: [
        {
          name: "submit_analytics_query_plan",
          args: {
            intent: "what_changed",
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
  }, TEST_TIMEOUT)

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
  }, TEST_TIMEOUT)
})
