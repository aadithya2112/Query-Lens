import { getPrimaryDatasetMetricDefinition } from "@/lib/querylens/datasets"
import { formatWeekLabel, getSeedDataset } from "@/lib/querylens/seed-data"
import { getWeekWindow } from "@/lib/querylens/reference-date"
import { calculateConfidenceScore, calculateWeightedDriverImpact, roundTo } from "@/lib/querylens/scoring"
import {
  DEFAULT_FLAGSHIP_QUESTION,
  getPhase1Provider,
} from "@/lib/querylens/server/analysis-provider"
import type { QueryLensExecutionContext } from "@/lib/querylens/server/ai-config"
import { getQueryLensDataAccess } from "@/lib/querylens/server/repositories"
import type {
  ContextEvent,
  DriverItem,
  EvidenceItem,
  Phase1AnalysisResponse,
  QueryRequestBody,
  ScopeFilter,
  WeeklyMetricRow,
} from "@/lib/querylens/types"

function getScopeLabel(scope: ScopeFilter) {
  const dataset = getSeedDataset()
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

function filterRowsForScope(rows: WeeklyMetricRow[], scope: ScopeFilter) {
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
    "The seeded demo uses a fixed reference date of April 11, 2026.",
    "Weeks run Monday to Sunday across the phase-1 dataset.",
  ]

  if (!scope.region && !scope.sector) {
    assumptions.push("No additional region or sector filter was applied.")
  }

  return assumptions
}

function buildChartSpec(rows: WeeklyMetricRow[], activeScopeLabel: string) {
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
      "The chart tracks the seeded weekly cashflow health score so the drop can be read in context, not as a one-off number.",
  }
}

function buildFallbackResponse(args: {
  fallbackReason: string
  sourceMode: "database" | "fixture"
  rows: WeeklyMetricRow[]
}): Phase1AnalysisResponse {
  return {
    headline: "Phase 1 currently supports cashflow health change questions",
    summary: args.fallbackReason,
    metric: "cashflow_health_score",
    timeframe: "Ask about this week or last week",
    comparisonBasis: "Phase 1 compares one seeded weekly window against the prior week",
    confidence: calculateConfidenceScore({
      evidenceCount: 0,
      driverCount: 0,
      hasCrossSourceEvidence: false,
      fallback: true,
    }),
    activeScope: "Portfolio",
    drivers: [],
    chartSpec: buildChartSpec(filterRowsForScope(args.rows, {}), "Portfolio"),
    evidence: [],
    assumptions: [
      "Phase 1 is intentionally narrow and does not attempt unsupported metrics or time windows.",
    ],
    supportedFollowUps: [
      DEFAULT_FLAGSHIP_QUESTION,
      "Why did hospitality cashflow health drop last week?",
      "Why did North West cashflow health drop this week?",
    ],
    fallback: true,
    sourceMode: args.sourceMode,
  }
}

export async function analyzePhase1Query(
  input: QueryRequestBody,
  options: { executionContext?: QueryLensExecutionContext } = {}
): Promise<Phase1AnalysisResponse> {
  const dataAccess = await getQueryLensDataAccess()
  const metric = getPrimaryDatasetMetricDefinition()
  const weeklyRows = await dataAccess.listWeeklyMetrics()
  const provider = getPhase1Provider({
    executionContext: options.executionContext ?? "interactive",
  })
  const parseResult = await provider.parseQuestion(
    input.question,
    input.scope
  )

  if (!parseResult.parsed) {
    return buildFallbackResponse({
      fallbackReason:
        parseResult.fallbackReason ??
        "The question could not be matched to the phase-1 vertical slice safely.",
      sourceMode: dataAccess.sourceMode,
      rows: weeklyRows,
    })
  }

  const activeScopeLabel = getScopeLabel(parseResult.parsed.scope)
  const timeframe = getWeekWindow(parseResult.parsed.timeframe)
  const scopedRows = filterRowsForScope(weeklyRows, parseResult.parsed.scope)
  const current = scopedRows.find((row) => row.weekStart === timeframe.targetStart)
  const previous = scopedRows.find((row) => row.weekStart === timeframe.comparisonStart)

  if (!current || !previous) {
    return buildFallbackResponse({
      fallbackReason:
        "The seeded data could not resolve both comparison windows for that question.",
      sourceMode: dataAccess.sourceMode,
      rows: weeklyRows,
    })
  }

  const regionSectorRows = weeklyRows.filter(
    (row) =>
      row.recordType === "region_sector" &&
      (row.weekStart === timeframe.targetStart || row.weekStart === timeframe.comparisonStart)
  )
  const contextEvents = await dataAccess.listContextEvents({
    targetStart: timeframe.targetStart,
    targetEnd: timeframe.targetEnd,
    scope: parseResult.parsed.scope,
  })
  const drivers = buildDrivers(current, previous, regionSectorRows)
  const evidence = buildEvidence({
    current,
    previous,
    regionSectorRows,
    contextEvents,
    timeframeLabel: timeframe.timeframeLabel,
    activeScopeLabel,
  })
  const confidence = calculateConfidenceScore({
    evidenceCount: evidence.length,
    driverCount: drivers.length,
    hasCrossSourceEvidence: evidence.some((item) => item.sourceType === "mongodb"),
  })
  const chartSpec = buildChartSpec(scopedRows, activeScopeLabel)
  const narrative = await provider.composeNarrative({
    parsed: parseResult.parsed,
    activeScopeLabel,
    currentScore: current.cashflowHealthScore,
    previousScore: previous.cashflowHealthScore,
    drivers,
    contextEvents,
  })

  return {
    headline: narrative.headline,
    summary: narrative.summary,
    metric: metric.id,
    timeframe: timeframe.timeframeLabel,
    comparisonBasis: timeframe.comparisonLabel,
    confidence,
    activeScope: activeScopeLabel,
    drivers,
    chartSpec,
    evidence,
    assumptions: buildAssumptions(parseResult.parsed.scope),
    supportedFollowUps: narrative.supportedFollowUps,
    sourceMode: dataAccess.sourceMode,
  }
}
