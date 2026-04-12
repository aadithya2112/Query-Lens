import {
  buildPriorEqualDateWindow,
  formatContextualDateWindowLabel,
  formatPriorPeriodComparisonLabel,
} from "@/lib/querylens/date-windows"
import { buildWhatChangedFollowUps } from "@/lib/querylens/follow-ups"
import { formatWeekLabel, getSampleDataset } from "@/lib/querylens/seed-data"
import {
  calculateConfidenceScore,
  calculateWeightedDriverImpact,
  roundTo,
} from "@/lib/querylens/scoring"
import { DEFAULT_FLAGSHIP_QUESTION } from "@/lib/querylens/server/analysis-provider"
import { aggregateMetricWindowRows } from "@/lib/querylens/server/range-aggregation"
import type { QueryLensDataAccess } from "@/lib/querylens/server/repositories"
import type {
  ContextEvent,
  DriverItem,
  EvidenceItem,
  Phase1AnalysisResponse,
  ScopeFilter,
  StructuredQueryPlan,
  WeeklyMetricRow,
} from "@/lib/querylens/types"

interface WhatChangedExecutorArgs {
  dataAccess: QueryLensDataAccess
  plan: StructuredQueryPlan
  weeklyRows: WeeklyMetricRow[]
  composeNarrative: (input: {
    parsed: StructuredQueryPlan
    activeScopeLabel: string
    currentScore: number
    previousScore: number
    drivers: DriverItem[]
    contextEvents: ContextEvent[]
    allowedFollowUps: string[]
  }) => Promise<
    Pick<Phase1AnalysisResponse, "headline" | "summary" | "supportedFollowUps">
  >
}

export function getScopeLabel(scope: ScopeFilter) {
  const dataset = getSampleDataset()
  const regionName = scope.region
    ? dataset.regions.find((region) => region.id === scope.region)?.name
    : undefined
  const sectorName = scope.sector
    ? dataset.sectors.find((sector) => sector.id === scope.sector)?.name
    : undefined

  if (regionName && sectorName) {
    return `${regionName} / ${sectorName}`
  }

  if (regionName) {
    return regionName
  }

  if (sectorName) {
    return sectorName
  }

  return "Portfolio"
}

export function filterRowsForScope(rows: WeeklyMetricRow[], scope: ScopeFilter) {
  if (scope.region && scope.sector) {
    return rows.filter(
      (row) =>
        row.recordType === "region_sector" &&
        row.regionId === scope.region &&
        row.sectorId === scope.sector
    )
  }

  if (scope.region) {
    return rows.filter(
      (row) => row.recordType === "region" && row.regionId === scope.region
    )
  }

  if (scope.sector) {
    return rows.filter(
      (row) => row.recordType === "sector" && row.sectorId === scope.sector
    )
  }

  return rows.filter((row) => row.recordType === "portfolio")
}

function filterRegionSectorRows(rows: WeeklyMetricRow[], scope: ScopeFilter) {
  return rows.filter((row) => {
    if (row.recordType !== "region_sector") {
      return false
    }

    if (scope.region && row.regionId !== scope.region) {
      return false
    }

    if (scope.sector && row.sectorId !== scope.sector) {
      return false
    }

    return true
  })
}

function buildDrivers(
  current: WeeklyMetricRow,
  previous: WeeklyMetricRow,
  regionSectorRows: WeeklyMetricRow[]
): DriverItem[] {
  const componentDrivers: DriverItem[] = [
    {
      id: "coverage",
      title: "Payment coverage weakened",
      impactLabel: `${calculateWeightedDriverImpact(
        previous.inflowOutflowScore,
        current.inflowOutflowScore,
        0.4
      ).toFixed(1)} pts`,
      direction:
        current.inflowOutflowScore - previous.inflowOutflowScore < 0 ? "negative" : "positive",
      description: `Inflow coverage moved from ${(previous.inboundPayments / previous.outboundPayments).toFixed(2)}x to ${(current.inboundPayments / current.outboundPayments).toFixed(2)}x, reducing the weighted score contribution from cash coverage.`,
    },
    {
      id: "balance",
      title: "Closing balances ended the week softer",
      impactLabel: `${calculateWeightedDriverImpact(
        previous.balanceTrendScore,
        current.balanceTrendScore,
        0.25
      ).toFixed(1)} pts`,
      direction:
        current.balanceTrendScore - previous.balanceTrendScore < 0 ? "negative" : "positive",
      description: `The closing balance position shifted from ${previous.closingBalance.toLocaleString()} to ${current.closingBalance.toLocaleString()}, weakening the week-end balance trend.`,
    },
    {
      id: "stress",
      title: "Stress indicators widened",
      impactLabel: `${roundTo(
        calculateWeightedDriverImpact(previous.lowBalanceScore, current.lowBalanceScore, 0.2) +
          calculateWeightedDriverImpact(previous.overdueScore, current.overdueScore, 0.15)
      ).toFixed(1)} pts`,
      direction:
        current.lowBalanceScore + current.overdueScore <
        previous.lowBalanceScore + previous.overdueScore
          ? "negative"
          : "positive",
      description: `Low-balance days rose from ${(previous.lowBalanceShare * 100).toFixed(1)}% to ${(current.lowBalanceShare * 100).toFixed(1)}%, while overdue exposure moved from ${(previous.overdueShare * 100).toFixed(1)}% to ${(current.overdueShare * 100).toFixed(1)}%.`,
    },
  ]

  const regionSectorDeltas = filterRegionSectorRows(regionSectorRows, {
    region: current.regionId ?? undefined,
    sector: current.sectorId ?? undefined,
  })

  const regionSectorDriver = regionSectorDeltas
    .map((row) => {
      const prior = regionSectorRows.find(
        (candidate) =>
          candidate.weekStart !== row.weekStart &&
          candidate.regionId === row.regionId &&
          candidate.sectorId === row.sectorId
      )
      return { row, prior }
    })
    .filter(
      (candidate): candidate is { row: WeeklyMetricRow; prior: WeeklyMetricRow } =>
        Boolean(candidate.prior)
    )
    .map(({ row, prior }) => ({
      row,
      delta: roundTo(row.cashflowHealthScore - prior.cashflowHealthScore),
    }))
    .sort((left, right) => left.delta - right.delta)[0]

  const rankedDrivers = [...componentDrivers].sort(
    (left, right) => parseFloat(left.impactLabel) - parseFloat(right.impactLabel)
  )
  const drivers = rankedDrivers
    .filter((driver) => driver.direction === "negative")
    .slice(0, 2)

  if (drivers.length < 2) {
    rankedDrivers.forEach((driver) => {
      if (drivers.length >= 2) {
        return
      }

      if (!drivers.some((candidate) => candidate.id === driver.id)) {
        drivers.push(driver)
      }
    })
  }

  if (regionSectorDriver) {
    drivers.push({
      id: "region_sector",
      title: `${regionSectorDriver.row.regionName} ${regionSectorDriver.row.sectorName} was the biggest local drag`,
      impactLabel: `${regionSectorDriver.delta.toFixed(1)} pts`,
      direction: regionSectorDriver.delta < 0 ? "negative" : "positive",
      description: `${regionSectorDriver.row.regionName} ${regionSectorDriver.row.sectorName} moved to ${regionSectorDriver.row.cashflowHealthScore.toFixed(1)}, the weakest region-sector movement in the target window.`,
    })
  }

  return drivers
}

function buildEvidence(args: {
  current: WeeklyMetricRow
  previous: WeeklyMetricRow
  regionSectorRows: WeeklyMetricRow[]
  contextEvents: ContextEvent[]
  timeframeLabel: string
  activeScopeLabel: string
}): EvidenceItem[] {
  const evidence: EvidenceItem[] = [
    {
      sourceType: "postgres",
      sourceName: "weekly_portfolio_metrics",
      timeRange: args.timeframeLabel,
      scope: args.activeScopeLabel,
      supportingFact: `${args.activeScopeLabel} cashflow health moved from ${args.previous.cashflowHealthScore.toFixed(1)} to ${args.current.cashflowHealthScore.toFixed(1)} week over week.`,
      queryTemplateId: "weekly_metric_delta_v1",
    },
  ]

  const worstRegionSector = filterRegionSectorRows(args.regionSectorRows, {})
    .map((row) => {
      const prior = args.regionSectorRows.find(
        (candidate) =>
          candidate.weekStart === args.previous.weekStart &&
          candidate.regionId === row.regionId &&
          candidate.sectorId === row.sectorId
      )
      return prior
        ? {
            row,
            delta: roundTo(row.cashflowHealthScore - prior.cashflowHealthScore),
          }
        : undefined
    })
    .filter((candidate): candidate is { row: WeeklyMetricRow; delta: number } => Boolean(candidate))
    .sort((left, right) => left.delta - right.delta)[0]

  if (worstRegionSector) {
    evidence.push({
      sourceType: "postgres",
      sourceName: "weekly_portfolio_metrics",
      timeRange: args.timeframeLabel,
      scope: `${worstRegionSector.row.regionName} / ${worstRegionSector.row.sectorName}`,
      supportingFact: `${worstRegionSector.row.regionName} ${worstRegionSector.row.sectorName} fell ${Math.abs(
        worstRegionSector.delta
      ).toFixed(1)} points week over week and showed the sharpest local decline.`,
      queryTemplateId: "region_sector_driver_v1",
    })
  }

  args.contextEvents.slice(0, 3).forEach((event) => {
    evidence.push({
      sourceType: "mongodb",
      sourceName: event.collection,
      timeRange: args.timeframeLabel,
      scope:
        event.regionName && event.sectorName
          ? `${event.regionName} / ${event.sectorName}`
          : event.regionName ?? event.sectorName ?? "Portfolio",
      supportingFact: `${event.summary} ${event.detail}`,
      queryTemplateId: `context_${event.collection}_v1`,
    })
  })

  return evidence
}

function buildAssumptions(scope: ScopeFilter) {
  const assumptions = [
    "The sample dataset uses a fixed reference date of April 11, 2026.",
    "Weeks run Monday to Sunday across the phase-1 dataset.",
  ]

  if (!scope.region && !scope.sector) {
    assumptions.push("No additional region or sector filter was applied.")
  }

  return assumptions
}

export function buildWhatChangedChartSpec(
  rows: WeeklyMetricRow[],
  activeScopeLabel: string
) {
  const series = rows.map((row) => ({
    label: formatWeekLabel(row.weekStart),
    weekStart: row.weekStart,
    weekEnd: row.weekEnd,
    score: row.cashflowHealthScore,
  }))

  return {
    type: "line" as const,
    title: `${activeScopeLabel} cashflow health over the last 12 weeks`,
    xKey: "label" as const,
    yKey: "score" as const,
    data: series,
    explanation:
      "The chart tracks the sample dataset's weekly cashflow health score so the drop can be read in context, not as a one-off number.",
  }
}

export function buildWhatChangedFallbackResponse(args: {
  fallbackReason: string
  sourceMode: "database" | "fixture"
  rows: WeeklyMetricRow[]
}): Phase1AnalysisResponse {
  return {
    intent: "what_changed",
    headline: "QueryLens could not complete that request safely",
    summary: args.fallbackReason,
    metric: "cashflow_health_score",
    timeframe: "Ask about this week or last week",
    comparisonBasis: "The current sample dataset supports grounded weekly analysis over adjacent windows",
    confidence: calculateConfidenceScore({
      evidenceCount: 0,
      driverCount: 0,
      hasCrossSourceEvidence: false,
      fallback: true,
    }),
    activeScope: "Portfolio",
    drivers: [],
    chartSpec: buildWhatChangedChartSpec(filterRowsForScope(args.rows, {}), "Portfolio"),
    evidence: [],
    assumptions: [
      "QueryLens stays within the current sample dataset, supported metrics, and validated weekly windows.",
    ],
    supportedFollowUps: [
      DEFAULT_FLAGSHIP_QUESTION,
      "What makes up at-risk accounts by region and sector last week?",
      "Compare cashflow health this week vs last week",
      "Compare North West vs London & South East cashflow health last week",
    ],
    fallback: true,
    sourceMode: args.sourceMode,
  }
}

export async function executeWhatChangedPlan(
  args: WhatChangedExecutorArgs
): Promise<Phase1AnalysisResponse> {
  const activeScopeLabel = getScopeLabel(args.plan.scope)
  const historicalScopedRows = filterRowsForScope(args.weeklyRows, args.plan.scope)
  const targetWindow = args.plan.comparisonWindow.targetWindow
  const comparisonDateWindow =
    args.plan.comparisonWindow.comparisonDateWindow ??
    buildPriorEqualDateWindow(targetWindow)
  const [targetDailyMetrics, comparisonDailyMetrics] = await Promise.all([
    args.dataAccess.listDailyMetrics({
      startDate: targetWindow.startDate,
      endDate: targetWindow.endDate,
      scope: args.plan.scope,
    }),
    comparisonDateWindow
      ? args.dataAccess.listDailyMetrics({
          startDate: comparisonDateWindow.startDate,
          endDate: comparisonDateWindow.endDate,
          scope: args.plan.scope,
        })
      : Promise.resolve([]),
  ])
  const targetRows = aggregateMetricWindowRows({
    dailyMetrics: targetDailyMetrics,
    startDate: targetWindow.startDate,
    endDate: targetWindow.endDate,
  })
  const comparisonRows = comparisonDateWindow
    ? aggregateMetricWindowRows({
        dailyMetrics: comparisonDailyMetrics,
        startDate: comparisonDateWindow.startDate,
        endDate: comparisonDateWindow.endDate,
      })
    : []
  const current = filterRowsForScope(targetRows, args.plan.scope)[0]
  const previous = filterRowsForScope(comparisonRows, args.plan.scope)[0]

  if (!current || !previous) {
    return buildWhatChangedFallbackResponse({
      fallbackReason:
        "The sample dataset could not resolve both comparison windows for that question.",
      sourceMode: args.dataAccess.sourceMode,
      rows: args.weeklyRows,
    })
  }

  const regionSectorRows = [...targetRows, ...comparisonRows].filter(
    (row) => row.recordType === "region_sector"
  )
  const contextEvents = await args.dataAccess.listContextEvents({
    targetStart: targetWindow.startDate,
    targetEnd: targetWindow.endDate,
    scope: args.plan.scope,
  })
  const timeframeLabel = formatContextualDateWindowLabel(targetWindow)
  const comparisonLabel = comparisonDateWindow
    ? formatPriorPeriodComparisonLabel(targetWindow, comparisonDateWindow)
    : "Compared with the immediately preceding validated period"
  const drivers = buildDrivers(current, previous, regionSectorRows)
  const evidence = buildEvidence({
    current,
    previous,
    regionSectorRows,
    contextEvents,
    timeframeLabel,
    activeScopeLabel,
  })
  const confidence = calculateConfidenceScore({
    evidenceCount: evidence.length,
    driverCount: drivers.length,
    hasCrossSourceEvidence: evidence.some((item) => item.sourceType === "mongodb"),
  })
  const chartSpec = buildWhatChangedChartSpec(historicalScopedRows, activeScopeLabel)
  const allowedFollowUps = buildWhatChangedFollowUps({
    targetWindow,
    comparisonWindow: comparisonDateWindow,
  })
  const narrative = await args.composeNarrative({
    parsed: args.plan,
    activeScopeLabel,
    currentScore: current.cashflowHealthScore,
    previousScore: previous.cashflowHealthScore,
    drivers,
    contextEvents,
    allowedFollowUps,
  })

  return {
    intent: "what_changed",
    headline: narrative.headline,
    summary: narrative.summary,
    metric: args.plan.metricId,
    timeframe: timeframeLabel,
    comparisonBasis: comparisonLabel,
    confidence,
    activeScope: activeScopeLabel,
    drivers,
    chartSpec,
    evidence,
    assumptions: buildAssumptions(args.plan.scope),
    supportedFollowUps: narrative.supportedFollowUps,
    sourceMode: args.dataAccess.sourceMode,
  }
}
