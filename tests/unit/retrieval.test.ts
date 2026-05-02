import { describe, expect, it } from "vitest"

import { buildMockDatabaseProfileSnapshot } from "../helpers/querylens-runtime"
import { buildDatasetCatalogProfile } from "@/lib/querylens/server/profile-store"
import {
  cosineSimilarity,
  embedTexts,
  EMBEDDING_DIMENSIONS,
} from "@/lib/querylens/server/embedding-service"
import {
  buildConversationMemoryText,
  buildDatasetCatalogChunks,
} from "@/lib/querylens/server/retrieval"

describe("retrieval scaffolding", () => {
  it("builds high-signal catalog chunks from the runtime profile snapshot", async () => {
    const chunks = buildDatasetCatalogChunks(
      buildDatasetCatalogProfile(buildMockDatabaseProfileSnapshot())
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
        sourceMode: "database",
      },
    })

    expect(text).toContain("Intent: discovery")
    expect(text).toContain("SME portfolio")
  })
})
