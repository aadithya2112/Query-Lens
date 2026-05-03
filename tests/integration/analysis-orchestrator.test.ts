import { vi } from "vitest"

import { analyzeQuery } from "@/lib/querylens/server/analysis-orchestrator"

const {
  persistedMessagesByChat,
  retrieveContextMock,
  persistConversationMock,
  activeCsvDataset,
} =
  vi.hoisted(() => ({
    persistedMessagesByChat: new Map<
      string,
      Array<{
        id: string
        chatId: string
        role: "user" | "assistant"
        text: string
        createdAt: string
      }>
    >(),
    retrieveContextMock: vi.fn(
      async (args: { chatId: string; question: string }) => ({
        datasetMatches: [],
        memoryMatches: [],
        recentMessages: persistedMessagesByChat.get(args.chatId) ?? [],
      }),
    ),
    persistConversationMock: vi.fn(
      async (args: {
        chatId: string
        question: string
        response: { summary: string }
      }) => {
        const current = persistedMessagesByChat.get(args.chatId) ?? []
        const createdAt = new Date().toISOString()
        persistedMessagesByChat.set(args.chatId, [
          ...current,
          {
            id: `user-${current.length + 1}`,
            chatId: args.chatId,
            role: "user",
            text: args.question,
            createdAt,
          },
          {
            id: `assistant-${current.length + 2}`,
            chatId: args.chatId,
            role: "assistant",
            text: args.response.summary,
            createdAt,
          },
        ])
      },
    ),
    activeCsvDataset: {
      id: "csv_sample",
      label: "Sample",
      description: "Uploaded sample sales CSV",
      status: "active",
      sourceKind: "csv",
      sourceMode: "database",
      tableName: "querylens_dataset_rows_csv_sample",
      rowCount: 30,
      primaryTimeField: "date",
      grain: "daily",
      manifestVersion: 1,
      createdAt: "2026-05-03T00:00:00.000Z",
      updatedAt: "2026-05-03T00:00:00.000Z",
      semanticDraft: {
        datasetId: "csv_sample",
        datasetLabel: "Sample",
        description: "Uploaded sample sales CSV",
        sourceMode: "database",
        timeCoverage: "2026-04-01 to 2026-04-03",
        dimensions: [
          {
            id: "region",
            label: "Region",
            columnId: "region",
          },
        ],
        metrics: [
          {
            id: "revenue",
            label: "Revenue",
            supportedIntents: ["aggregate", "trend", "discovery"],
            columnId: "revenue",
            exampleQuestions: ["Show revenue by region."],
          },
        ],
        sources: [],
        notes: ["CSV semantics are inferred from uploaded columns."],
      },
      profileSnapshot: undefined,
      columns: [
        {
          name: "date",
          normalizedName: "date",
          label: "Date",
          type: "date",
          nullRatio: 0,
          distinctCount: 3,
          sampleValues: ["2026-04-01"],
          isIdentifier: false,
          isDimension: true,
          isMeasure: false,
          isTimeField: true,
        },
        {
          name: "region",
          normalizedName: "region",
          label: "Region",
          type: "string",
          nullRatio: 0,
          distinctCount: 3,
          sampleValues: ["North"],
          isIdentifier: false,
          isDimension: true,
          isMeasure: false,
          isTimeField: false,
        },
        {
          name: "revenue",
          normalizedName: "revenue",
          label: "Revenue",
          type: "number",
          nullRatio: 0,
          distinctCount: 3,
          sampleValues: [120],
          isIdentifier: false,
          isDimension: false,
          isMeasure: true,
          isTimeField: false,
        },
      ],
      previewRows: {
        columns: ["date", "region", "revenue"],
        rows: [
          { date: "2026-04-01", region: "North", revenue: 120 },
          { date: "2026-04-02", region: "South", revenue: 180 },
        ],
        totalRows: 2,
        truncated: false,
      },
    },
  }))

vi.mock("@/lib/querylens/server/dataset-runtime", async () => {
  const { createMockQueryLensDatasetRuntime } = await import(
    "../helpers/querylens-runtime"
  )

  return {
    getQueryLensDatasetRuntime: vi.fn(async () =>
      createMockQueryLensDatasetRuntime(),
    ),
  }
})

vi.mock("@/lib/querylens/server/retrieval", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/lib/querylens/server/retrieval")>()

  return {
    ...original,
    getQueryLensRetrievalStore: vi.fn(async () => ({
      retrieveContext: retrieveContextMock,
      persistConversation: persistConversationMock,
    })),
  }
})

vi.mock("@/lib/querylens/server/dataset-registry", () => ({
  getOnboardedDatasetRecord: async (datasetId: string) =>
    datasetId === activeCsvDataset.id ? activeCsvDataset : undefined,
  listOnboardedDatasetRecords: async () => [activeCsvDataset],
}))

describe("analysis orchestrator", () => {
  beforeEach(() => {
    persistedMessagesByChat.clear()
    retrieveContextMock.mockClear()
    persistConversationMock.mockClear()
  })

  it("dispatches the flagship query through the what-changed executor", async () => {
    const payload = await analyzeQuery({
      question: "Why did SME cashflow health drop last week?",
    })

    expect(payload.fallback).not.toBe(true)
    expect(payload.metric).toBe("cashflow_health_score")
    expect(payload.drivers.length).toBeGreaterThanOrEqual(2)
    expect(payload.summary).toContain("immediately preceding grounded period")
    expect(payload.evidence.some((item) => item.sourceType === "postgres")).toBe(true)
    expect(payload.evidence.some((item) => item.sourceType === "mongodb")).toBe(true)
  })

  it("returns a guided fallback for unsupported questions", async () => {
    const payload = await analyzeQuery({
      question: "Why did revenue drop last month?",
    })

    expect(payload.fallback).toBe(true)
    expect(payload.summary).toContain("cashflow health")
  })

  it("dispatches breakdown questions through the new breakdown executor", async () => {
    const payload = await analyzeQuery({
      question: "What makes up at-risk accounts by region and sector last week?",
    })

    expect(payload.fallback).not.toBe(true)
    expect(payload.metric).toBe("at_risk_account_count")
    expect(payload.headline).toContain("at-risk")
    expect(payload.drivers.length).toBeGreaterThanOrEqual(1)
    expect(payload.evidence.some((item) => item.sourceType === "postgres")).toBe(true)
  })

  it("dispatches custom-range what-changed questions through the same deterministic intent", async () => {
    const payload = await analyzeQuery({
      question: "Why did SME cashflow health drop from 2026-04-02 to 2026-04-08?",
    })

    expect(payload.fallback).not.toBe(true)
    expect(payload.metric).toBe("cashflow_health_score")
    expect(payload.timeframe).toContain("Selected range")
    expect(payload.comparisonBasis).toContain("previous 7-day window")
    expect(payload.evidence.some((item) => item.sourceType === "postgres")).toBe(true)
  })

  it("dispatches timeframe compare questions through the compare executor", async () => {
    const payload = await analyzeQuery({
      question: "Compare cashflow health this week vs last week",
    })

    expect(payload.fallback).not.toBe(true)
    expect(payload.metric).toBe("cashflow_health_score")
    expect(payload.comparisonSummary?.mode).toBe("timeframe")
    expect(payload.summary).toContain("validated windows and scopes")
    expect(payload.evidence.some((item) => item.sourceType === "postgres")).toBe(true)
  })

  it("dispatches explicit custom-range compare questions through the compare executor", async () => {
    const payload = await analyzeQuery({
      question:
        "Compare cashflow health from 2026-04-02 to 2026-04-08 vs from 2026-03-26 to 2026-04-01",
    })

    expect(payload.fallback).not.toBe(true)
    expect(payload.metric).toBe("cashflow_health_score")
    expect(payload.comparisonSummary?.mode).toBe("timeframe")
    expect(payload.timeframe).toContain("2026")
  })

  it("dispatches vague metadata questions through the discovery executor", async () => {
    const payload = await analyzeQuery({
      question: "What data is currently stored?",
      chatId: "discovery-test",
    })

    expect(payload.fallback).not.toBe(true)
    expect(payload.intent).toBe("discovery")
    expect(payload.metric).toBe("dataset_catalog")
    expect(payload.discoverySummary?.datasetLabel).toBe("SME portfolio")
    expect(payload.summary).toContain("database-backed dataset boundaries")
    expect(payload.catalogSections?.length).toBeGreaterThan(0)
    expect(payload.evidence.length).toBeGreaterThan(0)
  })

  it("dispatches current data and context wording through the discovery executor", async () => {
    const payload = await analyzeQuery({
      question:
        "Explain me about the current data that's stored and the context that you have.",
      chatId: "discovery-context-test",
    })

    expect(payload.fallback).not.toBe(true)
    expect(payload.intent).toBe("discovery")
    expect(payload.metric).toBe("dataset_catalog")
    expect(payload.discoverySummary?.sourceLabels.length).toBeGreaterThan(0)
    expect(payload.trust?.overall.level).not.toBe("low")
  })

  it("answers uploaded CSV preview requests without agentic fallback", async () => {
    const payload = await analyzeQuery({
      question: "Show me the data in csv",
      chatId: "csv-preview-test",
    })

    expect(payload.fallback).not.toBe(true)
    expect(payload.intent).toBe("discovery")
    expect(payload.headline).toContain("CSV preview")
    expect(payload.resultTable?.columns).toEqual(["date", "region", "revenue"])
    expect(payload.executionTrace?.entries.some((entry) => entry.stage === "fallback")).not.toBe(
      true,
    )
  })

  it("answers source and table breakdown requests deterministically", async () => {
    const payload = await analyzeQuery({
      question:
        "Help me understand the data that's currently in the context, break it down by each table and source and what kind of data is stored.",
      chatId: "source-catalog-test",
    })

    expect(payload.fallback).not.toBe(true)
    expect(payload.intent).toBe("discovery")
    expect(payload.catalogSections?.some((section) => section.title.includes("Postgres"))).toBe(
      true,
    )
    expect(payload.resultTable?.rows.some((row) => row.object === "Sample")).toBe(true)
  })

  it("answers visual overview requests with a chart before agentic fallback", async () => {
    const payload = await analyzeQuery({
      question: "Visualize the data and show me the most important information",
      chatId: "visual-overview-test",
    })

    expect(payload.fallback).not.toBe(true)
    expect(payload.chartSpec).toBeDefined()
    expect(payload.metric).toBe("cashflow_health_score")
    expect(payload.drivers.length).toBeGreaterThan(0)
  })

  it("dispatches custom-range breakdown questions through the breakdown executor", async () => {
    const payload = await analyzeQuery({
      question: "Break down at-risk accounts by region from 2026-04-02 to 2026-04-08",
    })

    expect(payload.fallback).not.toBe(true)
    expect(payload.intent).toBe("breakdown")
    expect(payload.metric).toBe("at_risk_account_count")
    expect(payload.timeframe).toContain("Selected range")
    expect(payload.summary).toContain("pressure pocket")
  })

  it("persists conversational context when chatId is present", async () => {
    await analyzeQuery({
      question: "What data is currently stored?",
      chatId: "memory-test",
    })

    const followUp = await analyzeQuery({
      question: "What metrics are available?",
      chatId: "memory-test",
    })

    expect(followUp.intent).toBe("discovery")
    expect(followUp.conversationContextUsed).toBe(true)
    expect(followUp.retrievalTrace?.recentMessagesCount).toBeGreaterThan(0)
  })
})
