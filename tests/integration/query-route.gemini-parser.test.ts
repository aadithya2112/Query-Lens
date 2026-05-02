import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { geminiChatSendMock, geminiGenerateMock } = vi.hoisted(() => ({
  geminiChatSendMock: vi.fn(),
  geminiGenerateMock: vi.fn(),
}))
import { POST } from "@/app/api/query/route"

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
      retrieveContext: async () => ({
        datasetMatches: [],
        memoryMatches: [],
        recentMessages: [],
      }),
      persistConversation: async () => undefined,
    })),
  }
})

vi.mock("@/lib/querylens/server/gemini-client", () => ({
  createGeminiChatSession: () => ({
    sendMessage: geminiChatSendMock,
  }),
  generateGeminiResponse: geminiGenerateMock,
}))

describe("/api/query Gemini parser mode", () => {
  beforeEach(() => {
    geminiGenerateMock.mockReset()
    process.env.QUERYLENS_AI_MODE = "gemini"
    process.env.GEMINI_API_KEY = "test-key"
    process.env.QUERYLENS_REFERENCE_DATE = "2026-04-11"
  })

  afterEach(() => {
    process.env.QUERYLENS_AI_MODE = "deterministic"
    delete process.env.GEMINI_API_KEY
  })

  it("returns a non-fallback scoped analysis for paraphrased supported questions", async () => {
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
          "Gemini tied the decline to weaker inbound coverage, added corroborating settlement issues, and framed the answer against the prior validated week.",
        supportedFollowUps: [
          "Focus on the North West contribution to last week's drop",
          "Focus on hospitality SMEs last week",
          "What changed this week instead?",
        ],
      },
    })

    const request = new Request("http://localhost/api/query", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question:
          "Help me understand why North West hospitality cashflow got worse last week",
        chatId: "gemini-parser-route",
      }),
    })

    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.fallback).not.toBe(true)
    expect(payload.activeScope).toBe("North West / Hospitality")
    expect(payload.evidence.some((item: { sourceType: string }) => item.sourceType === "postgres")).toBe(true)
    expect(payload.evidence.some((item: { sourceType: string }) => item.sourceType === "mongodb")).toBe(true)
  })
})
