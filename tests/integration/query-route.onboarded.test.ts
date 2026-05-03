import { beforeEach, describe, expect, it, vi } from "vitest"

const { analyzeOnboardedDatasetQueryMock } = vi.hoisted(() => ({
  analyzeOnboardedDatasetQueryMock: vi.fn(),
}))

vi.mock("@/lib/querylens/server/onboarded-analysis", () => ({
  analyzeOnboardedDatasetQuery: analyzeOnboardedDatasetQueryMock,
}))

import { POST } from "@/app/api/query/route"

describe("/api/query onboarded csv routing", () => {
  beforeEach(() => {
    analyzeOnboardedDatasetQueryMock.mockReset()
  })

  it("returns the deterministic onboarded CSV response when datasetId is uploaded", async () => {
    analyzeOnboardedDatasetQueryMock.mockResolvedValue({
      intent: "aggregate",
      headline: "Revenue at a glance",
      summary: "SUM revenue is 42,100 for Uploaded Sales CSV.",
      metric: "revenue",
      timeframe: "Uploaded dataset coverage",
      comparisonBasis: "Deterministic onboarded CSV execution",
      confidence: 85,
      activeScope: "Uploaded Sales CSV",
      drivers: [],
      evidence: [],
      assumptions: [],
      supportedFollowUps: ["What data is currently stored?"],
      sourceMode: "database",
      queryRuns: [
        {
          id: "onboarded-aggregate",
          title: "SUM Revenue",
          sourceId: "csv_sales",
          sourceLabel: "Uploaded Sales CSV",
          sourceType: "postgres",
          language: "sql",
          statement: "SELECT SUM(revenue) AS value FROM csv_sales_table",
          status: "completed",
          rowCount: 1,
          summary: "SUM revenue computed over uploaded rows.",
        },
      ],
    })

    const request = new Request("http://localhost/api/query", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question: "What is total revenue?",
        datasetId: "csv_sales",
        chatId: "csv-route",
      }),
    })

    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.intent).toBe("aggregate")
    expect(payload.metric).toBe("revenue")
    expect(payload.queryRuns?.[0]?.statement).toContain("SUM(revenue)")
    expect(analyzeOnboardedDatasetQueryMock).toHaveBeenCalledWith({
      input: expect.objectContaining({
        datasetId: "csv_sales",
      }),
      executionContext: "interactive",
    })
  })
})
