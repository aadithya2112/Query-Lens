import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  runBuiltInAnalysisPipelineMock,
  executeAgenticFallbackMock,
  retrieveContextMock,
  persistConversationMock,
} = vi.hoisted(() => ({
  runBuiltInAnalysisPipelineMock: vi.fn(),
  executeAgenticFallbackMock: vi.fn(),
  retrieveContextMock: vi.fn(async () => ({
    datasetMatches: [],
    memoryMatches: [],
    recentMessages: [],
  })),
  persistConversationMock: vi.fn(async () => undefined),
}))

vi.mock("@/lib/querylens/server/built-in-pipeline", () => ({
  runBuiltInAnalysisPipeline: runBuiltInAnalysisPipelineMock,
}))

vi.mock("@/lib/querylens/server/agentic-query", () => ({
  executeAgenticFallback: executeAgenticFallbackMock,
}))

vi.mock("@/lib/querylens/server/dataset-runtime", () => ({
  getQueryLensDatasetRuntime: vi.fn(async () => ({
    dataAccess: {
      sourceMode: "database",
      listWeeklyMetrics: vi.fn(async () => []),
      getDateCoverage: vi.fn(async () => ({
        startDate: "2026-01-12",
        endDate: "2026-04-05",
      })),
      listWeeklyAccountStress: vi.fn(async () => []),
      listDailyMetrics: vi.fn(async () => []),
      listContextEvents: vi.fn(async () => []),
      executeReadOnlySql: vi.fn(),
      executeReadOnlyMongoPipeline: vi.fn(),
    },
    profileStore: {
      getProfileSnapshot: vi.fn(async () => ({
        datasetId: "sme_portfolio",
        sourceMode: "database",
        dateCoverage: {
          startDate: "2026-01-12",
          endDate: "2026-04-05",
        },
        sourceHealth: [],
        schemaSnapshot: {
          postgres: [],
          mongodb: [],
        },
        sourceCounts: [],
      })),
      getSemanticDraft: vi.fn(async () => ({
        datasetId: "sme_portfolio",
        datasetLabel: "SME portfolio",
        description: "Synthetic SME portfolio",
        sourceMode: "database",
        timeCoverage: "2026-01-12 to 2026-04-05",
        dimensions: [],
        metrics: [],
        sources: [],
        notes: [],
      })),
    },
  })),
}))

vi.mock("@/lib/querylens/server/retrieval", () => ({
  getQueryLensRetrievalStore: vi.fn(async () => ({
    retrieveContext: retrieveContextMock,
    persistConversation: persistConversationMock,
  })),
}))

describe("analysis orchestrator routing", () => {
  beforeEach(() => {
    runBuiltInAnalysisPipelineMock.mockReset()
    executeAgenticFallbackMock.mockReset()
    retrieveContextMock.mockClear()
    persistConversationMock.mockReset()
    process.env.QUERYLENS_AI_MODE = "gemini"
    process.env.GEMINI_API_KEY = "test-key"
  })

  it("keeps leadership summaries outside the built-in pipeline", async () => {
    const { analyzeQuery } = await import(
      "@/lib/querylens/server/analysis-orchestrator"
    )

    const response = await analyzeQuery({
      question: "Summarize this for leadership",
      chatId: "leadership-route",
      action: "leadership_summary",
      followUpContext: {
        sourceAnalysis: {
          intent: "what_changed",
          headline: "Portfolio cashflow health fell 1.7 points",
          summary: "Portfolio moved down from 100 to 98.3 week over week.",
          metric: "cashflow_health_score",
          timeframe: "Last week",
          comparisonBasis: "Compared with the prior week",
          confidence: 92,
          activeScope: "Portfolio",
          drivers: [],
          evidence: [],
          assumptions: [],
          supportedFollowUps: [],
          sourceMode: "fixture",
        },
      },
    })

    expect(runBuiltInAnalysisPipelineMock).not.toHaveBeenCalled()
    expect(response.presentationMode).toBe("leadership_summary")
    expect(persistConversationMock).toHaveBeenCalledOnce()
  })

  it("routes agentic fallback after the built-in pipeline declines the question", async () => {
    runBuiltInAnalysisPipelineMock.mockResolvedValue({
      kind: "needs_agentic",
      fallbackReason: "This needs a custom live query rather than a built-in intent.",
    })
    executeAgenticFallbackMock.mockResolvedValue({
      intent: "agentic_query",
      headline: "Custom analysis completed",
      summary: "Returned 2 rows.",
      metric: "custom_query_result",
      timeframe: "Custom question",
      comparisonBasis: "Agentic fallback over approved live QueryLens sources",
      confidence: 90,
      activeScope: "Custom analysis",
      drivers: [],
      evidence: [],
      assumptions: [],
      supportedFollowUps: ["Show the trend over time"],
      sourceMode: "database",
    })

    const { analyzeQuery } = await import(
      "@/lib/querylens/server/analysis-orchestrator"
    )

    const response = await analyzeQuery({
      question: "How has cashflow health trended over time?",
      chatId: "agentic-route",
    })

    expect(runBuiltInAnalysisPipelineMock).toHaveBeenCalledOnce()
    expect(executeAgenticFallbackMock).toHaveBeenCalledOnce()
    expect(response.intent).toBe("agentic_query")
    expect(persistConversationMock).toHaveBeenCalledOnce()
  })
})
