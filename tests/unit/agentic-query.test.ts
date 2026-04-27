import { beforeEach, describe, expect, it, vi } from "vitest"

const { geminiChatSendMock } = vi.hoisted(() => ({
  geminiChatSendMock: vi.fn(),
}))

vi.mock("@/lib/querylens/server/gemini-client", () => ({
  createGeminiChatSession: () => ({
    sendMessage: geminiChatSendMock,
  }),
}))

import { executeAgenticFallback, validateMongoPipeline, validateReadOnlySql } from "@/lib/querylens/server/agentic-query"
import type { AgenticSchemaSnapshot } from "@/lib/querylens/server/agentic-types"
import type { QueryLensDataAccess } from "@/lib/querylens/server/repositories"

function createMockDataAccess(): QueryLensDataAccess {
  return {
    sourceMode: "database",
    listWeeklyMetrics: vi.fn(async () => []),
    listDailyMetrics: vi.fn(async () => []),
    getDateCoverage: vi.fn(async () => ({
      startDate: "2026-01-12",
      endDate: "2026-04-05",
    })),
    listWeeklyAccountStress: vi.fn(async () => []),
    listContextEvents: vi.fn(async () => []),
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
}

const schemaSnapshot: AgenticSchemaSnapshot = {
  postgres: [
    {
      name: "weekly_portfolio_metrics",
      description: "Weekly cashflow health aggregates.",
      rowCount: 12,
      columns: ["week_start", "cashflow_health_score"],
    },
  ],
  mongodb: [],
}

describe("agentic query fallback", () => {
  beforeEach(() => {
    geminiChatSendMock.mockReset()
  })

  it("accepts single read-only SQL statements", () => {
    expect(
      validateReadOnlySql(
        "SELECT week_start, cashflow_health_score FROM weekly_portfolio_metrics"
      )
    ).toContain("SELECT")
  })

  it("rejects mutating or multi-statement SQL", () => {
    expect(() => validateReadOnlySql("UPDATE accounts SET segment = 'growth'")).toThrow(
      "SELECT or WITH"
    )
    expect(() =>
      validateReadOnlySql("SELECT * FROM accounts; SELECT * FROM sectors")
    ).toThrow("exactly one read-only statement")
  })

  it("rejects unsafe MongoDB pipeline operators", () => {
    expect(() =>
      validateMongoPipeline([{ $match: { severity: "high" } }, { $out: "tmp" }])
    ).toThrow("disallowed stage or operator")
  })

  it("builds a structured agentic response from a read-only SQL run", async () => {
    const dataAccess = createMockDataAccess()

    geminiChatSendMock.mockResolvedValueOnce({
      functionCalls: [
        {
          id: "call-1",
          name: "run_postgres_query",
          args: {
            title: "Weekly cashflow trend",
            reason: "Need a weekly trend to answer the user's growth question.",
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
              "The live weekly portfolio series shows a steady upward trend across the returned windows, increasing from 74.1 to 76.4 in the executed rows.",
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
                  "The returned weekly series increases from 74.1 to 76.4 across the visible window.",
              },
            ],
            primaryQueryRunId: "query-run-1",
            tableQueryRunId: "query-run-1",
            chart: {
              queryRunId: "query-run-1",
              type: "line",
              title: "Portfolio cashflow health trend",
              explanation: "A line chart best shows the week-over-week direction of change.",
              labelKey: "week_start",
              valueKey: "cashflow_health_score",
            },
          },
        },
      ],
    })

    const response = await executeAgenticFallback({
      question: "How has cashflow health trended over time?",
      dataAccess,
      schemaSnapshot,
      retrievalContext: {
        datasetMatches: [],
        memoryMatches: [],
        recentMessages: [],
      },
    })

    expect(response.intent).toBe("agentic_query")
    expect(response.metric).toBe("custom_query_result")
    expect(response.chartSpec?.type).toBe("line")
    expect(response.resultTable?.rows).toHaveLength(2)
    expect(response.queryRuns?.[0]).toMatchObject({
      language: "sql",
      sourceType: "postgres",
      title: "Weekly cashflow trend",
    })
    expect(dataAccess.executeReadOnlySql).toHaveBeenCalledOnce()
  })
})
