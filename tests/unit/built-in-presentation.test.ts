import { describe, expect, it } from "vitest"

import { buildBuiltInExecutionPlan } from "@/lib/querylens/server/built-in-pipeline/execution-plan"
import { getQueryLensDatasetRuntime } from "@/lib/querylens/server/dataset-runtime"
import { planDeterministicQuery } from "@/lib/querylens/server/query-planner"

describe("built-in presentation stage", () => {
  it("presents what-changed execution data through the narrative composer and enrichment layer", async () => {
    const { dataAccess, profileStore } = await getQueryLensDatasetRuntime()
    const weeklyRows = await dataAccess.listWeeklyMetrics()
    const dateCoverage = await dataAccess.getDateCoverage()
    const profileSnapshot = await profileStore.getProfileSnapshot()
    const { executeBuiltInPlan } = await import(
      "@/lib/querylens/server/built-in-pipeline/execution"
    )
    const { presentBuiltInExecution } = await import(
      "@/lib/querylens/server/built-in-pipeline/presentation"
    )

    const execution = await executeBuiltInPlan({
      executionPlan: buildBuiltInExecutionPlan({
        plan: planDeterministicQuery("Why did SME cashflow health drop last week?")
          .plan!,
        dateCoverage,
      }),
      dataAccess,
      profileSnapshot,
      weeklyRows,
      retrievalContext: {
        datasetMatches: [],
        memoryMatches: [],
        recentMessages: [],
      },
    })

    expect(execution.kind).toBe("success")
    if (execution.kind !== "success") {
      return
    }

    const response = await presentBuiltInExecution({
      execution,
      retrievalContext: {
        datasetMatches: [],
        memoryMatches: [],
        recentMessages: [],
      },
      inputQuestion: "Why did SME cashflow health drop last week?",
      interpretation: {
        mode: "direct",
        explanation: "QueryLens matched your request directly to a supported analytics flow.",
      },
      executionContext: "bootstrap",
    })

    expect(response.headline).toContain("cashflow health fell")
    expect(response.summary).toContain("immediately preceding grounded period")
    expect(response.followUpActions?.length).toBeGreaterThan(0)
    expect(response.trustArtifacts?.howProduced.length).toBeGreaterThan(0)
    expect(response.interpretation?.mode).toBe("direct")
    expect(response.executionTrace?.entries.some((entry) => entry.stage === "dispatch")).toBe(true)
  })

  it("presents compare, breakdown, and discovery execution results without recomputing grounded artifacts", async () => {
    const { dataAccess, profileStore } = await getQueryLensDatasetRuntime()
    const weeklyRows = await dataAccess.listWeeklyMetrics()
    const dateCoverage = await dataAccess.getDateCoverage()
    const profileSnapshot = await profileStore.getProfileSnapshot()
    const { executeBuiltInPlan } = await import(
      "@/lib/querylens/server/built-in-pipeline/execution"
    )
    const { presentBuiltInExecution } = await import(
      "@/lib/querylens/server/built-in-pipeline/presentation"
    )

    const questions = [
      "Compare cashflow health this week vs last week",
      "What makes up at-risk accounts by region and sector last week?",
      "What data is currently stored?",
    ]

    for (const question of questions) {
      const execution = await executeBuiltInPlan({
        executionPlan: buildBuiltInExecutionPlan({
          plan: planDeterministicQuery(question).plan!,
          dateCoverage,
        }),
        dataAccess,
        profileSnapshot,
        weeklyRows,
        retrievalContext: {
          datasetMatches: [],
          memoryMatches: [],
          recentMessages: [],
        },
      })

      expect(execution.kind).toBe("success")
      if (execution.kind !== "success") {
        continue
      }

      const response = await presentBuiltInExecution({
        execution,
        retrievalContext: {
          datasetMatches: [],
          memoryMatches: [],
          recentMessages: [],
        },
        inputQuestion: question,
        interpretation: {
          mode: "direct",
          explanation: "QueryLens matched your request directly to a supported analytics flow.",
        },
        executionContext: "bootstrap",
      })

      expect(response.evidence.length).toBeGreaterThanOrEqual(1)
      expect(response.trustArtifacts?.sourcesUsed.length).toBeGreaterThanOrEqual(1)
      expect(response.followUpActions?.length).toBeGreaterThan(0)
      expect(response.executionTrace?.entries.length).toBeGreaterThan(0)
    }
  })

  it("enriches shared fallback responses only in the presentation layer", async () => {
    const { dataAccess } = await getQueryLensDatasetRuntime()
    const weeklyRows = await dataAccess.listWeeklyMetrics()
    const { presentBuiltInFallback } = await import(
      "@/lib/querylens/server/built-in-pipeline/presentation"
    )

    const response = presentBuiltInFallback({
      fallbackReason: "Unsupported question.",
      sourceMode: dataAccess.sourceMode,
      weeklyRows,
      retrievalContext: {
        datasetMatches: [],
        memoryMatches: [],
        recentMessages: [],
      },
      inputQuestion: "Unsupported question.",
      interpretation: {
        mode: "fallback",
        explanation:
          "QueryLens could not safely translate that request into one of the currently supported built-in analytics flows.",
      },
      executionTrace: {
        planId: "test-fallback",
        entries: [
          {
            id: "fallback.test",
            stage: "fallback",
            status: "fallback",
            message: "Unsupported question.",
          },
        ],
      },
    })

    expect(response.fallback).toBe(true)
    expect(response.followUpActions?.length).toBeGreaterThan(0)
    expect(response.interpretation?.mode).toBe("fallback")
    expect(response.retrievalTrace?.recentMessagesCount).toBe(0)
    expect(response.executionTrace?.entries[0]?.stage).toBe("fallback")
  })
})
