import {
  buildPriorEqualDateWindow,
  formatContextualDateWindowLabel,
  formatPriorPeriodComparisonLabel,
} from "@/lib/querylens/date-windows"
import { getScopeLabel } from "@/lib/querylens/dataset-semantics"
import {
  buildCashflowHistoryChartSpec,
  filterRowsForScope,
} from "@/lib/querylens/server/built-in-pipeline/common"
import type {
  BuiltInExecutionFailure,
  WhatChangedExecutionPayload,
} from "@/lib/querylens/server/built-in-pipeline/types"
import {
  calculateConfidenceScore,
  calculateWeightedDriverImpact,
  roundTo,
} from "@/lib/querylens/scoring"
import { aggregateMetricWindowRows } from "@/lib/querylens/server/range-aggregation"
import type { QueryLensDataAccess } from "@/lib/querylens/server/repositories"
import type {
  ContextEvent,
  DriverItem,
  EvidenceItem,
  ScopeFilter,
  ScopeType,
  StructuredQueryPlan,
  WeeklyMetricRow,
} from "@/lib/querylens/types"

interface WhatChangedExecutorArgs {
  dataAccess: QueryLensDataAccess
  plan: StructuredQueryPlan
  weeklyRows: WeeklyMetricRow[]
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

function buildDeltaRanking(args: {
  targetRows: WeeklyMetricRow[]
  comparisonRows: WeeklyMetricRow[]
  recordType: ScopeType
  scope: ScopeFilter
}) {
  return args.targetRows
    .filter((row) => {
      if (row.recordType !== args.recordType) {
        return false
      }

      if (args.scope.region && row.regionId !== args.scope.region) {
        return false
      }

      if (args.scope.sector && row.sectorId !== args.scope.sector) {
        return false
      }

      return true
    })
    .map((row) => {
      const prior = args.comparisonRows.find(
        (candidate) =>
          candidate.recordType === row.recordType &&
          candidate.regionId === row.regionId &&
          candidate.sectorId === row.sectorId,
      )

      return prior
        ? {
            row,
            delta: roundTo(row.cashflowHealthScore - prior.cashflowHealthScore),
          }
        : undefined
    })
    .filter(
      (
        candidate,
      ): candidate is { row: WeeklyMetricRow; delta: number } => Boolean(candidate),
    )
    .sort((left, right) => {
      if (left.delta !== right.delta) {
        return left.delta - right.delta
      }

      return left.row.cashflowHealthScore - right.row.cashflowHealthScore
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

export async function executeWhatChangedPlan(
  args: WhatChangedExecutorArgs
): Promise<WhatChangedExecutionPayload | BuiltInExecutionFailure> {
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
    return {
      kind: "failure",
      fallbackReason:
        "The sample dataset could not resolve both comparison windows for that question.",
    }
  }

  const regionSectorRows = [...targetRows, ...comparisonRows].filter(
    (row) => row.recordType === "region_sector"
  )
  const regionRanking = buildDeltaRanking({
    targetRows,
    comparisonRows,
    recordType: "region",
    scope: {},
  })
  const sectorRanking = buildDeltaRanking({
    targetRows,
    comparisonRows,
    recordType: "sector",
    scope: {},
  })
  const scopedSectorRanking = buildDeltaRanking({
    targetRows,
    comparisonRows,
    recordType: "region_sector",
    scope: args.plan.scope.region ? { region: args.plan.scope.region } : {},
  })
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
  const chartSpec = buildCashflowHistoryChartSpec(
    historicalScopedRows,
    activeScopeLabel,
  )
  const weakestRegionLabel = !args.plan.scope.region
    ? regionRanking[0]?.row.regionName ?? undefined
    : undefined
  const weakestSectorLabel = args.plan.scope.region
    ? scopedSectorRanking[0]?.row.sectorName ?? undefined
    : !args.plan.scope.sector
      ? sectorRanking[0]?.row.sectorName ?? undefined
      : undefined
  const healthyPeerLabel = !args.plan.scope.region
    ? regionRanking
        .slice()
        .sort(
          (left, right) =>
            right.row.cashflowHealthScore - left.row.cashflowHealthScore,
      )
        .find((candidate) => candidate.row.regionName !== weakestRegionLabel)?.row
        .regionName ?? undefined
    : undefined

  return {
    kind: "success",
    intent: "what_changed",
    plan: args.plan,
    metric: args.plan.metricId,
    timeframe: timeframeLabel,
    comparisonBasis: comparisonLabel,
    confidence,
    activeScope: activeScopeLabel,
    drivers,
    chartSpec,
    evidence,
    assumptions: buildAssumptions(args.plan.scope),
    sourceMode: args.dataAccess.sourceMode,
    presentation: {
      currentScore: current.cashflowHealthScore,
      previousScore: previous.cashflowHealthScore,
      contextEvents,
      targetWindow,
      comparisonWindow: comparisonDateWindow,
      weakestRegionLabel,
      weakestSectorLabel,
      healthyPeerLabel,
    },
  }
}
