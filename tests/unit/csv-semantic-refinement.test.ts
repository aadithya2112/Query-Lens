import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const {
  generateStructuredDataMock,
  configState,
} = vi.hoisted(() => ({
  generateStructuredDataMock: vi.fn(),
  configState: {
    reasoningProvider: "openrouter" as "openrouter" | "gemini" | "deterministic",
    apiKey: undefined as string | undefined,
    openrouterApiKey: "test-openrouter-key" as string | undefined,
  },
}))

vi.mock("@/lib/querylens/server/ai-config", () => ({
  getQueryLensAiConfig: () => ({
    mode: "auto",
    apiKey: configState.apiKey,
    openrouterApiKey: configState.openrouterApiKey,
    model: "gemini-2.5-flash",
    openrouterModel: "deepseek/deepseek-v4-pro",
    reasoningProvider: configState.reasoningProvider,
  }),
}))

vi.mock("@/lib/querylens/server/reasoning-provider", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/lib/querylens/server/reasoning-provider")>()

  return {
    ...original,
    generateStructuredData: generateStructuredDataMock,
  }
})

import {
  refineSemanticDraft,
} from "@/lib/querylens/server/csv-onboarding"
import { ReasoningProviderError } from "@/lib/querylens/server/reasoning-provider"
import type { CsvColumnProfile, DatasetSemanticDraft } from "@/lib/querylens/types"

const draft: DatasetSemanticDraft = {
  datasetId: "csv_sales",
  datasetLabel: "CSV Sales",
  description: "CSV Sales imported from CSV onboarding.",
  sourceMode: "database",
  timeCoverage: "2026-04-01 to 2026-04-10",
  dimensions: [
    {
      id: "region",
      label: "Region",
      columnId: "region",
      synonyms: ["region"],
    },
  ],
  metrics: [
    {
      id: "revenue",
      label: "Revenue",
      description: "Aggregated view of revenue.",
      supportedIntents: ["aggregate", "trend", "discovery"],
      aggregation: "sum",
      columnId: "revenue",
      synonyms: ["revenue"],
      exampleQuestions: ["What is the total revenue?"],
    },
  ],
  sources: [
    {
      id: "postgres",
      label: "Onboarded CSV facts",
      type: "postgres",
      description: "Stored in QueryLens Postgres.",
      recordCount: 12,
    },
  ],
  notes: ["Heuristic draft."],
}

const columns: CsvColumnProfile[] = [
  {
    name: "date",
    normalizedName: "date",
    label: "Date",
    type: "date",
    nullRatio: 0,
    distinctCount: 10,
    sampleValues: ["2026-04-01", "2026-04-02"],
    isIdentifier: false,
    isDimension: false,
    isMeasure: false,
    isTimeField: true,
  },
  {
    name: "revenue",
    normalizedName: "revenue",
    label: "Revenue",
    type: "number",
    nullRatio: 0,
    distinctCount: 12,
    sampleValues: [12450.5, 13110],
    isIdentifier: false,
    isDimension: false,
    isMeasure: true,
    isTimeField: false,
  },
]

describe("refineSemanticDraft", () => {
  beforeEach(() => {
    generateStructuredDataMock.mockReset()
    configState.reasoningProvider = "openrouter"
    configState.apiKey = undefined
    configState.openrouterApiKey = "test-openrouter-key"
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("falls back to the heuristic draft for retryable provider failures", async () => {
    generateStructuredDataMock.mockRejectedValueOnce(
      new ReasoningProviderError({
        message: "Rate limited",
        status: 429,
        code: "rate_limited",
        retryable: true,
      }),
    )

    const result = await refineSemanticDraft({
      filename: "sales.csv",
      draft,
      columns,
    })

    expect(result).toEqual(draft)
  })

  it("falls back to the heuristic draft when semantic refinement times out", async () => {
    vi.useFakeTimers()
    configState.reasoningProvider = "gemini"
    configState.apiKey = "test-gemini-key"
    configState.openrouterApiKey = undefined
    generateStructuredDataMock.mockImplementation(
      () => new Promise(() => undefined),
    )

    const resultPromise = refineSemanticDraft({
      filename: "sales.csv",
      draft,
      columns,
    })

    await vi.advanceTimersByTimeAsync(12_000)

    await expect(resultPromise).resolves.toEqual(draft)
  })
})
