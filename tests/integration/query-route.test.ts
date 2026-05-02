import { auth } from "@clerk/nextjs/server"
import { vi, type Mock } from "vitest"

import { POST } from "@/app/api/query/route"

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

const authMock = auth as unknown as Mock

describe("/api/query", () => {
  beforeEach(() => {
    authMock.mockResolvedValue({ userId: "test-clerk-user" })
    persistedMessagesByChat.clear()
    retrieveContextMock.mockClear()
    persistConversationMock.mockClear()
  })

  it("rejects unauthenticated requests", async () => {
    authMock.mockResolvedValueOnce({ userId: null })

    const request = new Request("http://localhost/api/query", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question: "Why did SME cashflow health drop last week?",
        chatId: "route-unauthenticated",
      }),
    })

    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(401)
    expect(payload.error).toBe("Not authenticated.")
  })

  it("rejects requests without a Convex chat id", async () => {
    const request = new Request("http://localhost/api/query", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question: "Why did SME cashflow health drop last week?",
      }),
    })

    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.error).toBe("Invalid query payload.")
  })

  it("returns an honest fallback when interactive Gemini planning is unavailable", async () => {
    process.env.QUERYLENS_AI_MODE = "auto"
    delete process.env.GEMINI_API_KEY

    const request = new Request("http://localhost/api/query", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question: "Why did SME cashflow health drop last week?",
        chatId: "route-gemini-unavailable",
      }),
    })

    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.fallback).toBe(true)
    expect(payload.summary).toContain("needs Gemini enabled")
  })

  it("returns a grounded analysis for the flagship question", async () => {
    const request = new Request("http://localhost/api/query", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question: "Why did SME cashflow health drop last week?",
        chatId: "route-flagship",
      }),
    })

    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.metric).toBe("cashflow_health_score")
    expect(payload.sourceMode).toBe("database")
    expect(payload.fallback).not.toBe(true)
    expect(payload.trust?.overall?.score).toBe(payload.confidence)
    expect(payload.headline.toLowerCase()).toContain("fell")
    expect(payload.drivers.length).toBeGreaterThanOrEqual(2)
    expect(payload.evidence.some((item: { sourceType: string }) => item.sourceType === "postgres")).toBe(true)
    expect(payload.evidence.some((item: { sourceType: string }) => item.sourceType === "mongodb")).toBe(true)
  })

  it("returns a guided fallback for unsupported questions", async () => {
    const request = new Request("http://localhost/api/query", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question: "Why did revenue drop last month?",
        chatId: "route-unsupported",
      }),
    })

    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.fallback).toBe(true)
    expect(payload.summary).toContain("cashflow health")
  })

  it("returns a grounded breakdown for at-risk accounts", async () => {
    const request = new Request("http://localhost/api/query", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question: "What makes up at-risk accounts by region and sector last week?",
        chatId: "route-breakdown",
      }),
    })

    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.metric).toBe("at_risk_account_count")
    expect(payload.sourceMode).toBe("database")
    expect(payload.fallback).not.toBe(true)
    expect(payload.trust?.overall?.score).toBe(payload.confidence)
    expect(payload.headline.toLowerCase()).toContain("at-risk")
    expect(payload.drivers.length).toBeGreaterThanOrEqual(1)
    expect(payload.evidence.some((item: { sourceType: string }) => item.sourceType === "postgres")).toBe(true)
  })

  it("returns a grounded custom-range what-changed response when the dates differ from the predefined prompt", async () => {
    const request = new Request("http://localhost/api/query", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question: "Why did SME cashflow health drop from 2026-04-02 to 2026-04-08?",
        chatId: "route-custom-range",
      }),
    })

    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.metric).toBe("cashflow_health_score")
    expect(payload.fallback).not.toBe(true)
    expect(payload.timeframe).toContain("Selected range")
    expect(payload.supportedFollowUps.some((item: string) => item.includes("2026-04-02"))).toBe(true)
  })

  it("returns a grounded timeframe compare for cashflow health", async () => {
    const request = new Request("http://localhost/api/query", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question: "Compare cashflow health this week vs last week",
        chatId: "route-timeframe-compare",
      }),
    })

    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.metric).toBe("cashflow_health_score")
    expect(payload.fallback).not.toBe(true)
    expect(payload.comparisonSummary?.mode).toBe("timeframe")
    expect(payload.comparisonSummary?.leftLabel).toContain("This week")
    expect(payload.evidence.some((item: { sourceType: string }) => item.sourceType === "postgres")).toBe(true)
    expect(payload.evidence.some((item: { sourceType: string }) => item.sourceType === "mongodb")).toBe(true)
  })

  it("returns a guided fallback with exact coverage dates for out-of-range requests", async () => {
    const request = new Request("http://localhost/api/query", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question: "Why did cashflow health drop from 2025-01-01 to 2025-01-07?",
        chatId: "route-out-of-range",
      }),
    })

    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.fallback).toBe(true)
    expect(payload.summary).toContain("2026")
    expect(payload.summary).toContain("Apr 12, 2026")
  })

  it("returns a grounded discovery response for broad metadata questions", async () => {
    const request = new Request("http://localhost/api/query", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question: "What data is currently stored?",
        chatId: "route-discovery",
      }),
    })

    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.intent).toBe("discovery")
    expect(payload.metric).toBe("dataset_catalog")
    expect(payload.trust?.components?.dataCoverage?.score).toBeGreaterThanOrEqual(80)
    expect(payload.discoverySummary?.datasetLabel).toBe("SME portfolio")
    expect(payload.catalogSections?.length).toBeGreaterThan(0)
  })

  it("uses chatId to retain conversational memory across discovery turns", async () => {
    const firstRequest = new Request("http://localhost/api/query", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question: "What data is currently stored?",
        chatId: "route-memory",
      }),
    })

    await POST(firstRequest)

    const secondRequest = new Request("http://localhost/api/query", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question: "What metrics are available?",
        chatId: "route-memory",
      }),
    })

    const response = await POST(secondRequest)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.intent).toBe("discovery")
    expect(payload.conversationContextUsed).toBe(true)
    expect(payload.retrievalTrace?.recentMessagesCount).toBeGreaterThan(0)
  })

  it("returns a grounded region peer compare for cashflow health", async () => {
    const request = new Request("http://localhost/api/query", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question: "Compare North West vs London & South East cashflow health last week",
        chatId: "route-region-compare",
      }),
    })

    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.metric).toBe("cashflow_health_score")
    expect(payload.fallback).not.toBe(true)
    expect(payload.comparisonSummary?.mode).toBe("peer")
    expect(payload.comparisonSummary?.leftLabel).toBe("North West")
    expect(payload.comparisonSummary?.rightLabel).toBe("London & South East")
  })

  it("returns a grounded sector peer compare for cashflow health", async () => {
    const request = new Request("http://localhost/api/query", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question: "Compare hospitality vs retail cashflow health this week",
        chatId: "route-sector-compare",
      }),
    })

    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.metric).toBe("cashflow_health_score")
    expect(payload.fallback).not.toBe(true)
    expect(payload.comparisonSummary?.mode).toBe("peer")
    expect(payload.comparisonSummary?.leftLabel).toBe("Hospitality")
    expect(payload.comparisonSummary?.rightLabel).toBe("Retail")
  })

  afterEach(() => {
    process.env.QUERYLENS_AI_MODE = "deterministic"
    delete process.env.GEMINI_API_KEY
  })
})
