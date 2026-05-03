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
import type { AgenticSchemaSnapshot, AgenticSourceCatalog } from "@/lib/querylens/server/agentic-types"
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
  csv: [],
}

const sourceCatalog: AgenticSourceCatalog = {
  entries: [
    {
      id: "built_in_postgres",
      sourceType: "postgres",
      label: "Built-in Postgres facts",
      description: "Approved built-in QueryLens Postgres tables.",
      recordCount: 12,
      objectCount: schemaSnapshot.postgres.length,
      queryable: true,
    },
    {
      id: "built_in_mongodb",
      sourceType: "mongodb",
      label: "Built-in Mongo context",
      description: "Approved built-in QueryLens MongoDB collections.",
      recordCount: 0,
      objectCount: 0,
      queryable: true,
    },
  ],
  schema: schemaSnapshot,
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
      sourceCatalog,
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

  it("rejects cross-source SQL by blocking non-approved tables", async () => {
    const dataAccess = createMockDataAccess()

    geminiChatSendMock.mockResolvedValueOnce({
      functionCalls: [
        {
          id: "call-1",
          name: "run_postgres_query",
          args: {
            title: "Join built-in and csv",
            reason: "Need to combine two source families.",
            statement:
              "SELECT * FROM weekly_portfolio_metrics JOIN csv_uploaded_sales ON true",
          },
        },
      ],
    })
    geminiChatSendMock.mockResolvedValueOnce({
      functionCalls: [
        {
          id: "call-2",
          name: "reject_agentic_response",
          args: {
            reason:
              "Cross-source joins are not allowed across built-in and uploaded CSV families.",
          },
        },
      ],
    })

    const response = await executeAgenticFallback({
      question: "Combine built-in and uploaded CSV rows in one query",
      dataAccess,
      sourceCatalog,
      retrievalContext: {
        datasetMatches: [],
        memoryMatches: [],
        recentMessages: [],
      },
    })

    expect(response.fallback).toBe(true)
    expect(dataAccess.executeReadOnlySql).not.toHaveBeenCalled()
    expect(response.summary).toContain("Cross-source joins are not allowed")
  })

  it("keeps execution trace ids unique for same-tool parallel requests", async () => {
    const dataAccess = createMockDataAccess()

    geminiChatSendMock.mockResolvedValueOnce({
      functionCalls: [
        {
          id: "call-a",
          name: "run_postgres_query",
          args: {
            title: "Trend window A",
            reason: "Need trend window A.",
            statement:
              "SELECT week_start, cashflow_health_score FROM weekly_portfolio_metrics WHERE record_type = 'portfolio' ORDER BY week_start LIMIT 2",
          },
        },
        {
          id: "call-b",
          name: "run_postgres_query",
          args: {
            title: "Trend window B",
            reason: "Need trend window B.",
            statement:
              "SELECT week_start, cashflow_health_score FROM weekly_portfolio_metrics WHERE record_type = 'portfolio' ORDER BY week_start DESC LIMIT 2",
          },
        },
      ],
    })
    geminiChatSendMock.mockResolvedValueOnce({
      functionCalls: [
        {
          id: "call-c",
          name: "reject_agentic_response",
          args: {
            reason: "Stopping after sampling two windows.",
          },
        },
      ],
    })

    const response = await executeAgenticFallback({
      question: "Hi",
      dataAccess,
      sourceCatalog,
      retrievalContext: {
        datasetMatches: [],
        memoryMatches: [],
        recentMessages: [],
      },
    })

    const requestEntryIds =
      response.executionTrace?.entries
        .filter((entry) => entry.id.startsWith("tool_call.request.1.run_postgres_query."))
        .map((entry) => entry.id) ?? []

    expect(requestEntryIds).toHaveLength(2)
    expect(new Set(requestEntryIds).size).toBe(2)
  })

  it("returns a partial grounded answer when read budget is reached after completed reads", async () => {
    const dataAccess = createMockDataAccess()
    const makeQueryCall = (id: string, title: string) => ({
      id,
      name: "run_postgres_query",
      args: {
        title,
        reason: `Need ${title.toLowerCase()} for the custom question.`,
        statement:
          "SELECT week_start, cashflow_health_score FROM weekly_portfolio_metrics ORDER BY week_start LIMIT 2",
      },
    })

    geminiChatSendMock.mockResolvedValueOnce({
      functionCalls: [
        makeQueryCall("call-1", "Read one"),
        makeQueryCall("call-2", "Read two"),
        makeQueryCall("call-3", "Read three"),
        makeQueryCall("call-4", "Read four"),
      ],
    })
    geminiChatSendMock.mockResolvedValueOnce({
      functionCalls: [makeQueryCall("call-5", "Read five")],
    })

    const response = await executeAgenticFallback({
      question: "Give me a broad custom analysis",
      dataAccess,
      sourceCatalog,
      retrievalContext: {
        datasetMatches: [],
        memoryMatches: [],
        recentMessages: [],
      },
    })

    expect(response.fallback).not.toBe(true)
    expect(response.headline).toContain("partial evidence")
    expect(response.queryRuns).toHaveLength(4)
    expect(response.resultTable?.rows).toHaveLength(2)
    expect(response.trust?.limitationNotes.join(" ")).toContain("completed reads only")
    expect(dataAccess.executeReadOnlySql).toHaveBeenCalledTimes(4)
  })
})
