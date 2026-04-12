import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  geminiChatSendMock,
  geminiGenerateMock,
  mockDataAccess,
  persistConversationMock,
  retrieveContextMock,
} = vi.hoisted(() => {
  const dataAccess = {
    sourceMode: "database" as "database" | "fixture",
    listWeeklyMetrics: vi.fn(async () => []),
    listWeeklyAccountStress: vi.fn(async () => []),
    listContextEvents: vi.fn(async () => []),
    getSourceHealth: vi.fn(async () => []),
    getAgenticSchemaSnapshot: vi.fn(async () => ({
      postgres: [
        {
          name: "weekly_portfolio_metrics",
          description: "Weekly aggregates",
          rowCount: 12,
          columns: ["week_start", "cashflow_health_score"],
        },
      ],
      mongodb: [],
    })),
    executeReadOnlySql: vi.fn(async () => ({
      rowset: {
        columns: ["week_start", "cashflow_health_score"],
        rows: [
          {
            week_start: "2026-01-12",
            cashflow_health_score: 74.1,
          },
          {
            week_start: "2026-01-19",
            cashflow_health_score: 76.4,
          },
        ],
        totalRows: 2,
        truncated: false,
      },
      summary: "Returned 2 rows.",
    })),
    executeReadOnlyMongoPipeline: vi.fn(async () => ({
      rowset: {
        columns: [],
        rows: [],
        totalRows: 0,
        truncated: false,
      },
      summary: "Returned 0 documents.",
    })),
  }

  return {
    geminiChatSendMock: vi.fn(),
    geminiGenerateMock: vi.fn(),
    mockDataAccess: dataAccess,
    persistConversationMock: vi.fn(async () => undefined),
    retrieveContextMock: vi.fn(async () => ({
      datasetMatches: [],
      memoryMatches: [],
      recentMessages: [],
    })),
  }
})

vi.mock("@/lib/querylens/server/gemini-client", () => ({
  createGeminiChatSession: () => ({
    sendMessage: geminiChatSendMock,
  }),
  generateGeminiResponse: geminiGenerateMock,
}))

vi.mock("@/lib/querylens/server/repositories", () => ({
  getQueryLensDataAccess: vi.fn(async () => mockDataAccess),
}))

vi.mock("@/lib/querylens/server/retrieval", () => ({
  getQueryLensRetrievalStore: vi.fn(async () => ({
    retrieveContext: retrieveContextMock,
    persistConversation: persistConversationMock,
  })),
}))

import { POST } from "@/app/api/query/route"

describe("/api/query agentic fallback", () => {
  beforeEach(() => {
    geminiChatSendMock.mockReset()
    geminiGenerateMock.mockReset()
    persistConversationMock.mockReset()
    retrieveContextMock.mockClear()
    mockDataAccess.listWeeklyMetrics.mockResolvedValue([])
    mockDataAccess.sourceMode = "database"

    process.env.QUERYLENS_AI_MODE = "gemini"
    process.env.GEMINI_API_KEY = "test-key"
  })

  it("routes unsupported live questions into the read-only agentic fallback", async () => {
    geminiGenerateMock.mockResolvedValueOnce({
      functionCalls: [
        {
          name: "reject_analytics_query_plan",
          args: {
            reason: "This needs a custom live query rather than a built-in intent.",
          },
        },
      ],
    })
    geminiChatSendMock.mockResolvedValueOnce({
      functionCalls: [
        {
          id: "call-1",
          name: "run_postgres_query",
          args: {
            title: "Weekly cashflow trend",
            reason: "Need the weekly trend to answer the growth question.",
            statement:
              "SELECT week_start, cashflow_health_score FROM weekly_portfolio_metrics WHERE record_type = 'portfolio' ORDER BY week_start",
          },
        },
      ],
    })
    geminiChatSendMock.mockResolvedValueOnce({
      functionCalls: [
        {
          id: "call-2",
          name: "finish_agentic_response",
          args: {
            headline: "Cashflow health has improved across the available weeks",
            summary:
              "The returned weekly portfolio series slopes upward across the visible window.",
            timeframe: "Weekly trend across available weeks",
            comparisonBasis: "Portfolio cashflow health score over time",
            activeScope: "Portfolio",
            assumptions: [
              "The answer uses the approved weekly portfolio aggregate table only.",
            ],
            supportedFollowUps: ["Break this down by region"],
            keyFindings: [
              {
                title: "Upward weekly trend",
                impactLabel: "+2.3 pts",
                direction: "positive",
                description:
                  "The visible weekly series rises from 74.1 to 76.4.",
              },
            ],
            primaryQueryRunId: "query-run-1",
            tableQueryRunId: "query-run-1",
            chart: {
              queryRunId: "query-run-1",
              type: "line",
              title: "Portfolio cashflow health trend",
              explanation: "A line chart shows the week-over-week direction clearly.",
              labelKey: "week_start",
              valueKey: "cashflow_health_score",
            },
          },
        },
      ],
    })

    const request = new Request("http://localhost/api/query", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question: "How has cashflow health trended over time?",
        chatId: "agentic-route",
      }),
    })

    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.intent).toBe("agentic_query")
    expect(payload.metric).toBe("custom_query_result")
    expect(payload.chartSpec?.type).toBe("line")
    expect(payload.queryRuns).toHaveLength(1)
    expect(payload.resultTable?.rows).toHaveLength(2)
    expect(mockDataAccess.executeReadOnlySql).toHaveBeenCalledOnce()
    expect(persistConversationMock).toHaveBeenCalledOnce()
  })

  it("returns an honest fixture-mode fallback instead of pretending live queries ran", async () => {
    mockDataAccess.sourceMode = "fixture"
    geminiGenerateMock.mockResolvedValueOnce({
      functionCalls: [
        {
          name: "reject_analytics_query_plan",
          args: {
            reason: "This needs a custom live query rather than a built-in intent.",
          },
        },
      ],
    })

    const request = new Request("http://localhost/api/query", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question: "How has cashflow health trended over time?",
      }),
    })

    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.fallback).toBe(true)
    expect(payload.summary).toContain("needs QueryLens connected to live Postgres and MongoDB")
    expect(geminiChatSendMock).not.toHaveBeenCalled()
  })
})
