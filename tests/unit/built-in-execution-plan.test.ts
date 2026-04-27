import { describe, expect, it } from "vitest"

import { buildBuiltInExecutionPlan } from "@/lib/querylens/server/built-in-pipeline/execution-plan"
import { planDeterministicQuery } from "@/lib/querylens/server/query-planner"
import type { StructuredQueryPlan } from "@/lib/querylens/types"

const dateCoverage = {
  startDate: "2026-01-18",
  endDate: "2026-04-12",
}

describe("built-in execution plan", () => {
  it("approves execution plans for each shipped built-in intent", () => {
    const questions = [
      ["Why did SME cashflow health drop last week?", "what_changed"],
      [
        "What makes up at-risk accounts by region and sector last week?",
        "breakdown",
      ],
      ["Compare cashflow health this week vs last week", "compare"],
      ["What data is currently stored?", "discovery"],
    ] as const

    for (const [question, intent] of questions) {
      const structuredPlan = planDeterministicQuery(question).plan

      expect(structuredPlan).toBeDefined()

      const executionPlan = buildBuiltInExecutionPlan({
        plan: structuredPlan!,
        dateCoverage,
      })

      expect(executionPlan.intent).toBe(intent)
      expect(executionPlan.validation.status).toBe("approved")
      expect(executionPlan.structuredPlan).toBe(structuredPlan)
      expect(executionPlan.trace.entries.some((entry) => entry.stage === "validation")).toBe(true)
    }
  })

  it("labels capabilities and sources by intent without changing executor behavior", () => {
    const whatChangedPlan = buildBuiltInExecutionPlan({
      plan: planDeterministicQuery("Why did SME cashflow health drop last week?")
        .plan!,
      dateCoverage,
    })
    const discoveryPlan = buildBuiltInExecutionPlan({
      plan: planDeterministicQuery("What data is currently stored?").plan!,
      dateCoverage,
    })
    const comparePlan = buildBuiltInExecutionPlan({
      plan: planDeterministicQuery("Compare cashflow health this week vs last week")
        .plan!,
      dateCoverage,
    })
    const breakdownPlan = buildBuiltInExecutionPlan({
      plan: planDeterministicQuery(
        "What makes up at-risk accounts by region and sector last week?",
      ).plan!,
      dateCoverage,
    })

    expect(whatChangedPlan.selectedCapabilities).toEqual([
      "aggregate_metric",
      "explain_change",
      "retrieve_context",
    ])
    expect(whatChangedPlan.allowedSources).toEqual(["postgres", "mongodb"])
    expect(comparePlan.selectedCapabilities).toEqual([
      "aggregate_metric",
      "compare_slices",
      "explain_change",
      "retrieve_context",
    ])
    expect(comparePlan.allowedSources).toEqual(["postgres", "mongodb"])
    expect(breakdownPlan.selectedCapabilities).toEqual([
      "aggregate_metric",
      "retrieve_context",
    ])
    expect(breakdownPlan.allowedSources).toEqual(["postgres", "mongodb"])
    expect(discoveryPlan.selectedCapabilities).toEqual([
      "profile_dataset",
      "retrieve_context",
    ])
    expect(discoveryPlan.allowedSources).toEqual([
      "manifest",
      "postgres",
      "mongodb",
    ])
  })

  it("rejects unsupported metric and timeframe plans with fallback-safe validation", () => {
    const basePlan = planDeterministicQuery(
      "Why did SME cashflow health drop last week?",
    ).plan!
    const invalidPlan = {
      ...basePlan,
      metricId: "dataset_catalog",
      timeframe: "last_month",
    } as unknown as StructuredQueryPlan

    const executionPlan = buildBuiltInExecutionPlan({
      plan: invalidPlan,
      dateCoverage,
    })

    expect(executionPlan.validation.status).toBe("rejected")
    expect(executionPlan.validation.results.some((result) => result.status === "failed")).toBe(true)
    expect(executionPlan.fallbackPolicy.builtInFallback).toBe(true)
    expect(executionPlan.trace.entries.some((entry) => entry.stage === "fallback")).toBe(true)
  })

  it("rejects out-of-coverage windows with the existing fallback wording", () => {
    const structuredPlan = planDeterministicQuery(
      "Why did SME cashflow health drop from 2020-01-01 to 2020-01-07?",
    ).plan ?? {
      datasetId: "sme_portfolio",
      rawQuestion: "Why did SME cashflow health drop from 2020-01-01 to 2020-01-07?",
      intent: "what_changed",
      metricId: "cashflow_health_score",
      timeframe: "custom",
      dateWindow: {
        startDate: "2020-01-01",
        endDate: "2020-01-07",
        dayCount: 7,
        label: "Jan 1 - Jan 7, 2020",
      },
      scope: {},
      scopeDimensions: ["portfolio"],
      comparisonWindow: {
        timeframe: "custom",
        comparisonBasis: "prior_period",
        targetWindow: {
          startDate: "2020-01-01",
          endDate: "2020-01-07",
          dayCount: 7,
          label: "Jan 1 - Jan 7, 2020",
        },
      },
    } as StructuredQueryPlan

    const executionPlan = buildBuiltInExecutionPlan({
      plan: structuredPlan,
      dateCoverage,
    })

    expect(executionPlan.validation.status).toBe("rejected")
    expect(executionPlan.validation.fallbackReason).toContain(
      "That request falls outside the dataset coverage window",
    )
  })
})
