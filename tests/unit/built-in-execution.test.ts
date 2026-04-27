import { describe, expect, it } from "vitest"

import { buildBuiltInExecutionPlan } from "@/lib/querylens/server/built-in-pipeline/execution-plan"
import { planDeterministicQuery } from "@/lib/querylens/server/query-planner"
import { getQueryLensDataAccess } from "@/lib/querylens/server/repositories"

describe("built-in execution stage", () => {
  it("returns typed execution payloads for each shipped built-in intent", async () => {
    const dataAccess = await getQueryLensDataAccess()
    const weeklyRows = await dataAccess.listWeeklyMetrics()
    const dateCoverage = await dataAccess.getDateCoverage()
    const { executeBuiltInPlan } = await import(
      "@/lib/querylens/server/built-in-pipeline/execution"
    )

    const plans = [
      planDeterministicQuery("Why did SME cashflow health drop last week?").plan,
      planDeterministicQuery(
        "What makes up at-risk accounts by region and sector last week?",
      ).plan,
      planDeterministicQuery("Compare cashflow health this week vs last week").plan,
      planDeterministicQuery("What data is currently stored?").plan,
    ]

    for (const plan of plans) {
      expect(plan).toBeDefined()

      const result = await executeBuiltInPlan({
        executionPlan: buildBuiltInExecutionPlan({
          plan: plan!,
          dateCoverage,
        }),
        dataAccess,
        weeklyRows,
        retrievalContext: {
          datasetMatches: [],
          memoryMatches: [],
          recentMessages: [],
        },
      })

      expect(result.kind).toBe("success")
      if (result.kind === "success") {
        expect(result.plan.intent).toBe(result.intent)
        expect(result.metric).toBe(plan!.metricId)
        expect(result.evidence.length).toBeGreaterThanOrEqual(1)
        expect(result.executionTrace?.entries.some((entry) => entry.stage === "dispatch")).toBe(true)
      }
    }
  })

  it("fails at execution when the plan falls outside grounded coverage", async () => {
    const dataAccess = await getQueryLensDataAccess()
    const weeklyRows = await dataAccess.listWeeklyMetrics()
    const dateCoverage = await dataAccess.getDateCoverage()
    const { executeBuiltInPlan } = await import(
      "@/lib/querylens/server/built-in-pipeline/execution"
    )

    const plan = planDeterministicQuery(
      "Why did SME cashflow health drop from 2020-01-01 to 2020-01-07?",
    ).plan ?? {
      datasetId: "sme_portfolio" as const,
      rawQuestion: "Why did SME cashflow health drop from 2020-01-01 to 2020-01-07?",
      intent: "what_changed" as const,
      metricId: "cashflow_health_score" as const,
      timeframe: "custom" as const,
      dateWindow: {
        startDate: "2020-01-01",
        endDate: "2020-01-07",
        dayCount: 7,
        label: "Jan 1 - Jan 7, 2020",
      },
      scope: {},
      scopeDimensions: ["portfolio"] as const,
      comparisonWindow: {
        timeframe: "custom" as const,
        comparisonBasis: "prior_period" as const,
        targetWindow: {
          startDate: "2020-01-01",
          endDate: "2020-01-07",
          dayCount: 7,
          label: "Jan 1 - Jan 7, 2020",
        },
      },
    }

    const result = await executeBuiltInPlan({
      executionPlan: buildBuiltInExecutionPlan({
        plan,
        dateCoverage,
      }),
      dataAccess,
      weeklyRows,
      retrievalContext: {
        datasetMatches: [],
        memoryMatches: [],
        recentMessages: [],
      },
    })

    expect(result.kind).toBe("failure")
    if (result.kind === "failure") {
      expect(result.fallbackReason).toContain("coverage window")
      expect(result.interpretation?.mode).toBe("fallback")
      expect(result.executionTrace?.entries.some((entry) => entry.stage === "fallback")).toBe(true)
    }
  })

  it("returns a shared execution failure for compare plans missing compare metadata", async () => {
    const dataAccess = await getQueryLensDataAccess()
    const weeklyRows = await dataAccess.listWeeklyMetrics()
    const dateCoverage = await dataAccess.getDateCoverage()
    const { executeBuiltInPlan } = await import(
      "@/lib/querylens/server/built-in-pipeline/execution"
    )

    const result = await executeBuiltInPlan({
      executionPlan: buildBuiltInExecutionPlan({
        plan: {
          datasetId: "sme_portfolio",
          rawQuestion: "Compare cashflow health this week vs last week",
          intent: "compare",
          metricId: "cashflow_health_score",
          timeframe: "this_week",
          dateWindow: {
            startDate: "2026-04-06",
            endDate: "2026-04-12",
            dayCount: 7,
            label: "Apr 6 - 12, 2026",
            relativeTimeframe: "this_week",
          },
          scope: {},
          scopeDimensions: ["portfolio"],
          comparisonWindow: {
            timeframe: "this_week",
            comparisonBasis: "prior_period",
            targetWindow: {
              startDate: "2026-04-06",
              endDate: "2026-04-12",
              dayCount: 7,
              label: "Apr 6 - 12, 2026",
              relativeTimeframe: "this_week",
            },
          },
        },
        dateCoverage,
      }),
      dataAccess,
      weeklyRows,
      retrievalContext: {
        datasetMatches: [],
        memoryMatches: [],
        recentMessages: [],
      },
    })

    expect(result.kind).toBe("failure")
    if (result.kind === "failure") {
      expect(result.fallbackReason).toContain("side-by-side view")
    }
  })
})
