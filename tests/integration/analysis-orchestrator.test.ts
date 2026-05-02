import { vi } from "vitest"

import { analyzeQuery } from "@/lib/querylens/server/analysis-orchestrator"

const { persistedMessagesByChat, retrieveContextMock, persistConversationMock } =
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
