import { describe, expect, it } from "vitest"

import {
  aggregateMetricCapability,
  compareSlicesCapability,
  explainChangeCapability,
  profileDatasetCapability,
  retrieveContextCapability,
  type BuiltInCapabilityContext,
} from "@/lib/querylens/server/built-in-pipeline/capabilities"
import { buildBuiltInExecutionPlan } from "@/lib/querylens/server/built-in-pipeline/execution-plan"
import { planDeterministicQuery } from "@/lib/querylens/server/query-planner"
import { getQueryLensDataAccess } from "@/lib/querylens/server/repositories"
import type { QueryLensDataAccess } from "@/lib/querylens/server/repositories"

async function buildContext(question: string): Promise<BuiltInCapabilityContext> {
  const dataAccess = await getQueryLensDataAccess()
  const weeklyRows = await dataAccess.listWeeklyMetrics()
  const dateCoverage = await dataAccess.getDateCoverage()
  const plan = planDeterministicQuery(question).plan

  expect(plan).toBeDefined()

  return {
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
  }
}

describe("built-in capabilities", () => {
  it("aggregates metric rows for portfolio, region, sector, and region-sector scopes", async () => {
    const context = await buildContext(
      "Why did hospitality cashflow health drop last week in the North West?",
    )
    const targetWindow = context.executionPlan.structuredPlan.comparisonWindow.targetWindow

    const portfolio = await aggregateMetricCapability({
      context,
      window: targetWindow,
      scope: {},
    })
    const region = await aggregateMetricCapability({
      context,
      window: targetWindow,
      scope: { region: "north_west" },
    })
    const sector = await aggregateMetricCapability({
      context,
      window: targetWindow,
      scope: { sector: "hospitality" },
    })
    const regionSector = await aggregateMetricCapability({
      context,
      window: targetWindow,
      scope: { region: "north_west", sector: "hospitality" },
    })

    expect(portfolio.scopedRow?.recordType).toBe("portfolio")
    expect(region.scopedRow?.recordType).toBe("region")
    expect(sector.scopedRow?.recordType).toBe("sector")
    expect(regionSector.scopedRow?.recordType).toBe("region_sector")
    expect(portfolio.rows.length).toBeGreaterThan(region.scopedRows.length)
  })

  it("resolves timeframe and peer compare slices and handles missing rows safely", async () => {
    const timeframeContext = await buildContext(
      "Compare cashflow health this week vs last week",
    )
    const timeframeSpec = timeframeContext.executionPlan.structuredPlan.compareSpec

    expect(timeframeSpec).toBeDefined()

    const timeframe = await compareSlicesCapability({
      context: timeframeContext,
      compareSpec: timeframeSpec!,
    })

    expect(timeframe.leftRow?.recordType).toBe("portfolio")
    expect(timeframe.rightRow?.recordType).toBe("portfolio")
    expect(timeframe.timeframeLabel).toContain("vs")

    const peerContext = await buildContext(
      "Compare North West vs London & South East cashflow health last week",
    )
    const peerSpec = peerContext.executionPlan.structuredPlan.compareSpec
    const peer = await compareSlicesCapability({
      context: peerContext,
      compareSpec: peerSpec!,
    })

    expect(peer.leftRow?.regionName).toBe("North West")
    expect(peer.rightRow?.regionName).toBe("London & South East")

    const emptyContext = {
      ...timeframeContext,
      dataAccess: {
        ...timeframeContext.dataAccess,
        listDailyMetrics: async () => [],
      } as QueryLensDataAccess,
    }
    const empty = await compareSlicesCapability({
      context: emptyContext,
      compareSpec: timeframeSpec!,
    })

    expect(empty.leftRow).toBeUndefined()
    expect(empty.rightRow).toBeUndefined()
  })

  it("retrieves context events through the approved capability gate", async () => {
    const context = await buildContext("Why did SME cashflow health drop last week?")
    const window = context.executionPlan.structuredPlan.comparisonWindow.targetWindow

    const events = await retrieveContextCapability({
      context,
      requests: [{ window, scope: {} }],
    })

    expect(events.length).toBeGreaterThan(0)

    const blockedContext = {
      ...context,
      executionPlan: {
        ...context.executionPlan,
        selectedCapabilities: context.executionPlan.selectedCapabilities.filter(
          (capability) => capability !== "retrieve_context",
        ),
      },
    }

    await expect(
      retrieveContextCapability({
        context: blockedContext,
        requests: [{ window, scope: {} }],
      }),
    ).rejects.toThrow("did not approve the retrieve_context capability")
  })

  it("profiles dataset metadata for discovery", async () => {
    const context = await buildContext("What data is currently stored?")

    const profile = await profileDatasetCapability({
      context,
      plan: context.executionPlan.structuredPlan,
    })

    expect(profile.dataset.label).toBe("SME portfolio")
    expect(profile.sourceHealth.length).toBeGreaterThan(0)
    expect(profile.coverageLabel).toContain("to")
    expect(profile.catalogSections.length).toBeGreaterThan(0)
  })

  it("explains cashflow change with stable component facts", async () => {
    const context = await buildContext("Why did SME cashflow health drop last week?")
    const plan = context.executionPlan.structuredPlan
    const current = await aggregateMetricCapability({
      context,
      window: plan.comparisonWindow.targetWindow,
      scope: plan.scope,
    })
    const previous = await aggregateMetricCapability({
      context,
      window: plan.comparisonWindow.comparisonDateWindow!,
      scope: plan.scope,
    })

    const deltas = explainChangeCapability({
      context,
      current: current.scopedRow!,
      previous: previous.scopedRow!,
    })

    expect(deltas.map((delta) => delta.id)).toEqual([
      "coverage",
      "balance",
      "stress",
    ])
    expect(deltas.every((delta) => Number.isFinite(delta.weightedDelta))).toBe(true)
  })
})
