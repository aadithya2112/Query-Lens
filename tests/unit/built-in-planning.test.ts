import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { getSampleDataset } from "@/lib/querylens/seed-data"

const { geminiGenerateMock } = vi.hoisted(() => ({
  geminiGenerateMock: vi.fn(),
}))

vi.mock("@/lib/querylens/server/gemini-client", () => ({
  generateGeminiResponse: geminiGenerateMock,
}))

const dateCoverage = {
  startDate: "2026-01-18",
  endDate: "2026-04-12",
}

describe("built-in planning stage", () => {
  beforeEach(() => {
    geminiGenerateMock.mockReset()
    process.env.QUERYLENS_GEMINI_MODEL = "gemini-2.5-flash"
    process.env.QUERYLENS_AI_MODE = "deterministic"
    delete process.env.GEMINI_API_KEY
  })

  afterEach(() => {
    process.env.QUERYLENS_AI_MODE = "deterministic"
    delete process.env.GEMINI_API_KEY
    delete process.env.QUERYLENS_GEMINI_MODEL
  })

  it("returns a direct built-in plan for supported questions", async () => {
    const { planBuiltInAnalysis } = await import(
      "@/lib/querylens/server/built-in-pipeline/planning"
    )

    const result = await planBuiltInAnalysis({
      input: {
        question: "Why did SME cashflow health drop last week?",
      },
      executionContext: "interactive",
      retrievalContext: {
        datasetMatches: [],
        memoryMatches: [],
        recentMessages: [],
      },
      weeklyRows: getSampleDataset().weeklyMetrics,
      dateCoverage,
    })

    expect(result.kind).toBe("success")
    if (result.kind === "success") {
      expect(result.plan.intent).toBe("what_changed")
      expect(result.executionPlan.intent).toBe("what_changed")
      expect(result.executionPlan.validation.status).toBe("approved")
      expect(result.interpretation.mode).toBe("direct")
    }
  })

  it("falls back to deterministic planning when Gemini does not return a usable built-in plan", async () => {
    process.env.QUERYLENS_AI_MODE = "gemini"
    process.env.GEMINI_API_KEY = "test-key"
    geminiGenerateMock.mockResolvedValue({})

    const { planBuiltInAnalysis } = await import(
      "@/lib/querylens/server/built-in-pipeline/planning"
    )

    const result = await planBuiltInAnalysis({
      input: {
        question: "Why did SME cashflow health drop last week?",
      },
      executionContext: "interactive",
      retrievalContext: {
        datasetMatches: [],
        memoryMatches: [],
        recentMessages: [],
      },
      weeklyRows: getSampleDataset().weeklyMetrics,
      dateCoverage,
    })

    expect(result.kind).toBe("success")
    if (result.kind === "success") {
      expect(result.plan.intent).toBe("what_changed")
      expect(result.interpretation.mode).toBe("direct")
    }
  })

  it("returns a guided reroute when the question asks for the weakest region", async () => {
    const { planBuiltInAnalysis } = await import(
      "@/lib/querylens/server/built-in-pipeline/planning"
    )

    const result = await planBuiltInAnalysis({
      input: {
        question: "Show me the weakest region last week",
      },
      executionContext: "interactive",
      retrievalContext: {
        datasetMatches: [],
        memoryMatches: [],
        recentMessages: [],
      },
      weeklyRows: getSampleDataset().weeklyMetrics,
      dateCoverage,
    })

    expect(result.kind).toBe("success")
    if (result.kind === "success") {
      expect(result.plan.intent).toBe("what_changed")
      expect(result.interpretation.mode).toBe("guided_reroute")
      expect(result.interpretation.resolvedQuestion).toContain("cashflow health drop")
    }
  })

  it("fails inside the built-in planner for unsupported questions without producing agentic intents", async () => {
    process.env.QUERYLENS_AI_MODE = "gemini"
    process.env.GEMINI_API_KEY = "test-key"
    geminiGenerateMock.mockResolvedValue({
      functionCalls: [
        {
          name: "reject_analytics_query_plan",
          args: {
            reason: "This needs a custom live query rather than a built-in intent.",
          },
        },
      ],
    })

    const { planBuiltInAnalysis } = await import(
      "@/lib/querylens/server/built-in-pipeline/planning"
    )

    const result = await planBuiltInAnalysis({
      input: {
        question: "How has cashflow health trended over time?",
      },
      executionContext: "interactive",
      retrievalContext: {
        datasetMatches: [],
        memoryMatches: [],
        recentMessages: [],
      },
      weeklyRows: getSampleDataset().weeklyMetrics,
      dateCoverage,
    })

    expect(result.kind).toBe("failure")
    if (result.kind === "failure") {
      expect(result.allowAgenticFallback).toBe(true)
      expect(result.interpretation.mode).toBe("fallback")
    }
  })
})
