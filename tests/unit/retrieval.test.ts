import { describe, expect, it } from "vitest"

import { getQueryLensDatasetRuntime } from "@/lib/querylens/server/dataset-runtime"
import { buildDatasetCatalogProfile } from "@/lib/querylens/server/profile-store"
import {
  cosineSimilarity,
  embedTexts,
  EMBEDDING_DIMENSIONS,
} from "@/lib/querylens/server/embedding-service"
import {
  buildConversationMemoryText,
  buildDatasetCatalogChunks,
  getQueryLensRetrievalStore,
} from "@/lib/querylens/server/retrieval"

describe("retrieval scaffolding", () => {
  it("builds high-signal catalog chunks from the runtime profile snapshot", async () => {
    const { profileStore } = await getQueryLensDatasetRuntime()
    const profileSnapshot = await profileStore.getProfileSnapshot()
    const chunks = buildDatasetCatalogChunks(
      buildDatasetCatalogProfile(profileSnapshot)
    )

    expect(chunks.map((chunk) => chunk.kind)).toEqual(
      expect.arrayContaining([
        "overview",
        "metrics",
        "dimensions",
        "sources",
        "time_coverage",
        "questions",
      ])
    )
    expect(chunks.find((chunk) => chunk.id === "dataset-sources")?.content).toContain(
      "records profiled",
    )
    expect(
      chunks.find((chunk) => chunk.id === "dataset-supported-questions")?.content
    ).toContain("What data is currently stored?")
  })

  it("creates deterministic embeddings when Gemini is not configured", async () => {
    const [first, second] = await embedTexts({
      texts: ["cashflow health", "cashflow health"],
      task: "query",
    })

    expect(first).toHaveLength(EMBEDDING_DIMENSIONS)
    expect(first).toEqual(second)
    expect(cosineSimilarity(first, second)).toBeGreaterThan(0.99)
  })

  it("stores and retrieves conversational memory in fixture mode", async () => {
    const store = await getQueryLensRetrievalStore()
    const chatId = "test-chat-retrieval"

    await store.persistConversation({
      chatId,
      question: "Why did SME cashflow health drop last week?",
      response: {
        intent: "what_changed",
        headline: "Portfolio cashflow health fell 1.7 points",
        summary: "Portfolio moved down from 100 to 98.3 week over week.",
        metric: "cashflow_health_score",
        timeframe: "Last week",
        comparisonBasis: "Compared with the prior week",
        confidence: 92,
        activeScope: "Portfolio",
        drivers: [],
        chartSpec: {
          type: "line",
          title: "Weekly trend",
          xKey: "label",
          yKey: "score",
          data: [],
          explanation: "Trend",
        },
        evidence: [],
        assumptions: [],
        supportedFollowUps: [],
        sourceMode: "fixture",
      },
    })

    const context = await store.retrieveContext({
      chatId,
      question: "What about hospitality there?",
    })

    expect(context.memoryMatches.length).toBeGreaterThan(0)
    expect(context.recentMessages.length).toBeGreaterThanOrEqual(2)
  })

  it("builds conversation memory text with analytical context", () => {
    const text = buildConversationMemoryText({
      chatId: "demo-chat",
      question: "What data is currently stored?",
      response: {
        intent: "discovery",
        headline: "QueryLens has one active sample dataset",
        summary: "The active dataset includes structured facts and contextual signals.",
        metric: "dataset_catalog",
        timeframe: "Dataset coverage overview",
        comparisonBasis: "Catalog summary",
        confidence: 96,
        activeScope: "SME portfolio",
        drivers: [],
        chartSpec: {
          type: "bar",
          title: "Catalog summary",
          xKey: "label",
          yKey: "value",
          data: [],
          explanation: "Catalog",
        },
        evidence: [],
        assumptions: [],
        supportedFollowUps: [],
        sourceMode: "fixture",
      },
    })

    expect(text).toContain("Intent: discovery")
    expect(text).toContain("SME portfolio")
  })
})
