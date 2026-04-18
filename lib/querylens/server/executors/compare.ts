import {
  formatContextualDateWindowLabel,
  getRelativeDateWindow,
} from "@/lib/querylens/date-windows"
import {
  buildCompareFollowUpActions,
  buildCompareFollowUps,
} from "@/lib/querylens/follow-ups"
import { calculateConfidenceScore, roundTo } from "@/lib/querylens/scoring"
import { aggregateMetricWindowRows } from "@/lib/querylens/server/range-aggregation"
import type { QueryLensDataAccess } from "@/lib/querylens/server/repositories"
import {
  buildWhatChangedFallbackResponse,
  filterRowsForScope,
} from "@/lib/querylens/server/executors/what-changed"
import type {
  CompareSpec,
  ContextEvent,
  DriverItem,
  EvidenceItem,
  Phase1AnalysisResponse,
  ScopeFilter,
  StructuredQueryPlan,
  WeeklyMetricRow,
} from "@/lib/querylens/types"

interface CompareExecutorArgs {
  dataAccess: QueryLensDataAccess
  plan: StructuredQueryPlan
  weeklyRows: WeeklyMetricRow[]
  composeNarrative: unknown
}

function getMetricComponentGaps(left: WeeklyMetricRow, right: WeeklyMetricRow) {
  return [
    {
      id: "coverage_gap",
      title: "Payment coverage is the widest gap",
      delta: roundTo(
        Math.abs(left.inflowOutflowScore - right.inflowOutflowScore) * 0.4,
        1
      ),
      description: `${left.regionName ?? left.sectorName ?? "The left side"} ran at ${(left.inboundPayments / left.outboundPayments).toFixed(2)}x coverage versus ${(right.inboundPayments / right.outboundPayments).toFixed(2)}x on the right side.`,
    },
    {
      id: "balance_gap",
      title: "Closing balance resilience separates the two sides",
      delta: roundTo(
        Math.abs(left.balanceTrendScore - right.balanceTrendScore) * 0.25,
        1
      ),
      description: `The comparison closes at ${left.closingBalance.toLocaleString()} versus ${right.closingBalance.toLocaleString()}, creating a visible gap in end-of-week balance strength.`,
    },
    {
      id: "stress_gap",
      title: "Stress indicators remain meaningfully different",
      delta: roundTo(
        Math.abs(left.lowBalanceScore - right.lowBalanceScore) * 0.2 +
          Math.abs(left.overdueScore - right.overdueScore) * 0.15,
        1
      ),
      description: `Low-balance share is ${(left.lowBalanceShare * 100).toFixed(1)}% versus ${(right.lowBalanceShare * 100).toFixed(1)}%, while overdue exposure is ${(left.overdueShare * 100).toFixed(1)}% versus ${(right.overdueShare * 100).toFixed(1)}%.`,
    },
  ]
}

function buildDrivers(
  left: WeeklyMetricRow,
  right: WeeklyMetricRow,
  compareSpec: CompareSpec
): DriverItem[] {
  const leftLeads = left.cashflowHealthScore >= right.cashflowHealthScore
  const strongerLabel = leftLeads ? compareSpec.leftLabel : compareSpec.rightLabel
  const weakerLabel = leftLeads ? compareSpec.rightLabel : compareSpec.leftLabel
  const strongerRow = leftLeads ? left : right
  const weakerRow = leftLeads ? right : left

  return getMetricComponentGaps(strongerRow, weakerRow)
    .sort((leftGap, rightGap) => rightGap.delta - leftGap.delta)
    .map((gap) => ({
      id: gap.id,
      title: `${strongerLabel} outperforms ${weakerLabel} on ${gap.title.toLowerCase()}`,
      impactLabel: `${gap.delta.toFixed(1)} pts`,
      direction: "negative" as const,
      description: gap.description,
    }))
    .slice(0, 3)
}

function buildChartSpec(compareSpec: CompareSpec, left: WeeklyMetricRow, right: WeeklyMetricRow) {
  return {
    type: "bar" as const,
    title: `${compareSpec.leftLabel} vs ${compareSpec.rightLabel} cashflow health`,
    xKey: "label" as const,
    yKey: "value" as const,
    data: [
      {
        label: compareSpec.leftLabel,
        value: roundTo(left.cashflowHealthScore, 1),
      },
      {
        label: compareSpec.rightLabel,
        value: roundTo(right.cashflowHealthScore, 1),
      },
    ],
    explanation:
      compareSpec.mode === "timeframe"
        ? "The compare view places the same scope across adjacent weekly windows side by side."
        : "The compare view places two peers from the same dimension side by side for the selected week.",
  }
}

function buildAssumptions(plan: StructuredQueryPlan) {
  const assumptions = [
    "The sample dataset uses a fixed reference date of April 11, 2026.",
    "Weeks run Monday to Sunday across the QueryLens dataset.",
  ]

  if (plan.compareSpec?.mode === "peer") {
    assumptions.push(
      "Peer compare currently supports exactly two regions or exactly two sectors in one selected week."
    )
  } else {
    assumptions.push(
      "Timeframe compare keeps the same portfolio, region, or sector scope across this week and last week."
    )
  }

  return assumptions
}

function buildComparisonSummary(
  compareSpec: CompareSpec,
  left: WeeklyMetricRow,
  right: WeeklyMetricRow
) {
  const leftValue = roundTo(left.cashflowHealthScore, 1)
  const rightValue = roundTo(right.cashflowHealthScore, 1)
  const delta = roundTo(Math.abs(leftValue - rightValue), 1)

  if (leftValue === rightValue) {
    return {
      mode: compareSpec.mode,
      leftLabel: compareSpec.leftLabel,
      leftValue,
      rightLabel: compareSpec.rightLabel,
      rightValue,
      delta,
      tie: true,
    }
  }

  return {
    mode: compareSpec.mode,
    leftLabel: compareSpec.leftLabel,
    leftValue,
    rightLabel: compareSpec.rightLabel,
    rightValue,
    delta,
    winnerLabel: leftValue > rightValue ? compareSpec.leftLabel : compareSpec.rightLabel,
  }
}

async function getCompareContextEvents(args: {
  dataAccess: QueryLensDataAccess
  compareSpec: CompareSpec
  weakerScope: ScopeFilter
}) {
  if (args.compareSpec.mode === "timeframe") {
    const leftWindow =
      args.compareSpec.leftWindow ??
      getRelativeDateWindow(args.compareSpec.leftTimeframe ?? "this_week")
    const rightWindow =
      args.compareSpec.rightWindow ??
      getRelativeDateWindow(args.compareSpec.rightTimeframe ?? "last_week")
    const leftEvents = await args.dataAccess.listContextEvents({
      targetStart: leftWindow.startDate,
      targetEnd: leftWindow.endDate,
      scope: args.compareSpec.leftScope,
    })
    const rightEvents = await args.dataAccess.listContextEvents({
      targetStart: rightWindow.startDate,
      targetEnd: rightWindow.endDate,
      scope: args.compareSpec.rightScope,
    })

    return [...leftEvents, ...rightEvents]
  }

  const selectedWindow =
    args.compareSpec.selectedWindow ??
    getRelativeDateWindow(args.compareSpec.selectedTimeframe ?? "last_week")
  const weakerEvents = await args.dataAccess.listContextEvents({
    targetStart: selectedWindow.startDate,
    targetEnd: selectedWindow.endDate,
    scope: args.weakerScope,
  })
  const strongerScope =
    args.weakerScope.region === args.compareSpec.leftScope.region &&
    args.weakerScope.sector === args.compareSpec.leftScope.sector
      ? args.compareSpec.rightScope
      : args.compareSpec.leftScope
  const strongerEvents = await args.dataAccess.listContextEvents({
    targetStart: selectedWindow.startDate,
    targetEnd: selectedWindow.endDate,
    scope: strongerScope,
  })

  return [...weakerEvents, ...strongerEvents]
}

function buildEvidence(args: {
  compareSpec: CompareSpec
  left: WeeklyMetricRow
  right: WeeklyMetricRow
  contextEvents: ContextEvent[]
  timeframeLabel: string
}) {
  const comparisonSummary = buildComparisonSummary(
    args.compareSpec,
    args.left,
    args.right
  )
  const evidence: EvidenceItem[] = [
    {
      sourceType: "postgres",
      sourceName: "weekly_portfolio_metrics",
      timeRange: args.timeframeLabel,
      scope: `${args.compareSpec.leftLabel} vs ${args.compareSpec.rightLabel}`,
      supportingFact: `${args.compareSpec.leftLabel} scored ${comparisonSummary.leftValue.toFixed(1)} versus ${comparisonSummary.rightValue.toFixed(1)} for ${args.compareSpec.rightLabel}, a ${comparisonSummary.delta.toFixed(1)} point gap.`,
      queryTemplateId: "cashflow_compare_overview_v1",
    },
  ]

  const biggestGap = getMetricComponentGaps(args.left, args.right).sort(
    (leftGap, rightGap) => rightGap.delta - leftGap.delta
  )[0]

  if (biggestGap) {
    evidence.push({
      sourceType: "postgres",
      sourceName: "weekly_portfolio_metrics",
      timeRange: args.timeframeLabel,
      scope: `${args.compareSpec.leftLabel} vs ${args.compareSpec.rightLabel}`,
      supportingFact: biggestGap.description,
      queryTemplateId: "cashflow_compare_driver_v1",
    })
  }

  args.contextEvents.slice(0, 2).forEach((event) => {
    evidence.push({
      sourceType: "mongodb",
      sourceName: event.collection,
      timeRange: args.timeframeLabel,
      scope:
        event.regionName && event.sectorName
          ? `${event.regionName} / ${event.sectorName}`
          : event.regionName ?? event.sectorName ?? "Portfolio",
      supportingFact: `${event.summary} ${event.detail}`,
      queryTemplateId: `context_${event.collection}_compare_v1`,
    })
  })

  return evidence
}

async function getRowsForCompare(
  dataAccess: QueryLensDataAccess,
  compareSpec: CompareSpec
): Promise<{ leftRow?: WeeklyMetricRow; rightRow?: WeeklyMetricRow; timeframeLabel: string }> {
  if (compareSpec.mode === "timeframe") {
    const leftWindow =
      compareSpec.leftWindow ??
      getRelativeDateWindow(compareSpec.leftTimeframe ?? "this_week")
    const rightWindow =
      compareSpec.rightWindow ??
      getRelativeDateWindow(compareSpec.rightTimeframe ?? "last_week")
    const [leftDailyMetrics, rightDailyMetrics] = await Promise.all([
      dataAccess.listDailyMetrics({
        startDate: leftWindow.startDate,
        endDate: leftWindow.endDate,
        scope: compareSpec.leftScope,
      }),
      dataAccess.listDailyMetrics({
        startDate: rightWindow.startDate,
        endDate: rightWindow.endDate,
        scope: compareSpec.rightScope,
      }),
    ])
    const leftRows = aggregateMetricWindowRows({
      dailyMetrics: leftDailyMetrics,
      startDate: leftWindow.startDate,
      endDate: leftWindow.endDate,
    })
    const rightRows = aggregateMetricWindowRows({
      dailyMetrics: rightDailyMetrics,
      startDate: rightWindow.startDate,
      endDate: rightWindow.endDate,
    })

    return {
      leftRow: filterRowsForScope(leftRows, compareSpec.leftScope)[0],
      rightRow: filterRowsForScope(rightRows, compareSpec.rightScope)[0],
      timeframeLabel: `${leftWindow.label} vs ${rightWindow.label}`,
    }
  }

  const selectedWindow =
    compareSpec.selectedWindow ??
    getRelativeDateWindow(compareSpec.selectedTimeframe ?? "last_week")
  const [leftDailyMetrics, rightDailyMetrics] = await Promise.all([
    dataAccess.listDailyMetrics({
      startDate: selectedWindow.startDate,
      endDate: selectedWindow.endDate,
      scope: compareSpec.leftScope,
    }),
    dataAccess.listDailyMetrics({
      startDate: selectedWindow.startDate,
      endDate: selectedWindow.endDate,
      scope: compareSpec.rightScope,
    }),
  ])
  const leftRows = aggregateMetricWindowRows({
    dailyMetrics: leftDailyMetrics,
    startDate: selectedWindow.startDate,
    endDate: selectedWindow.endDate,
  })
  const rightRows = aggregateMetricWindowRows({
    dailyMetrics: rightDailyMetrics,
    startDate: selectedWindow.startDate,
    endDate: selectedWindow.endDate,
  })

  return {
    leftRow: filterRowsForScope(leftRows, compareSpec.leftScope)[0],
    rightRow: filterRowsForScope(rightRows, compareSpec.rightScope)[0],
    timeframeLabel:
      compareSpec.mode === "peer"
        ? formatContextualDateWindowLabel(selectedWindow)
        : selectedWindow.label,
  }
}

export async function executeComparePlan(
  args: CompareExecutorArgs
): Promise<Phase1AnalysisResponse> {
  const compareSpec = args.plan.compareSpec

  if (!compareSpec) {
    return buildWhatChangedFallbackResponse({
      fallbackReason:
        "The compare request could not be resolved into a supported side-by-side view.",
      sourceMode: args.dataAccess.sourceMode,
      rows: args.weeklyRows,
    })
  }

  const { leftRow, rightRow, timeframeLabel } = await getRowsForCompare(
    args.dataAccess,
    compareSpec
  )

  if (!leftRow || !rightRow) {
    return buildWhatChangedFallbackResponse({
      fallbackReason:
        "The sample dataset could not resolve both sides of that comparison safely.",
      sourceMode: args.dataAccess.sourceMode,
      rows: args.weeklyRows,
    })
  }

  const comparisonSummary = buildComparisonSummary(compareSpec, leftRow, rightRow)
  const weakerScope =
    comparisonSummary.tie || comparisonSummary.winnerLabel === compareSpec.rightLabel
      ? compareSpec.leftScope
      : compareSpec.rightScope
  const contextEvents = await getCompareContextEvents({
    dataAccess: args.dataAccess,
    compareSpec,
    weakerScope,
  })
  const drivers = buildDrivers(leftRow, rightRow, compareSpec)
  const evidence = buildEvidence({
    compareSpec,
    left: leftRow,
    right: rightRow,
    contextEvents,
    timeframeLabel,
  })
  const activeScope = `${compareSpec.leftLabel} vs ${compareSpec.rightLabel}`
  const headline = comparisonSummary.tie
    ? `${compareSpec.leftLabel} and ${compareSpec.rightLabel} are effectively level`
    : `${comparisonSummary.winnerLabel} leads the cashflow comparison`
  const summary = comparisonSummary.tie
    ? `${compareSpec.leftLabel} and ${compareSpec.rightLabel} both scored ${comparisonSummary.leftValue.toFixed(1)} in the selected compare view, so the main differences come from component mix rather than the headline score. QueryLens therefore focuses the explanation on which grounded components still separate the two sides even though the headline metric is level.`
    : `${comparisonSummary.winnerLabel} leads by ${comparisonSummary.delta.toFixed(1)} points in the selected compare view. QueryLens highlights where payment coverage, balance resilience, and stress indicators create the clearest separation. The comparison stays anchored to the validated windows and scopes defined in this side-by-side view.`
  const targetWindow =
    compareSpec.mode === "timeframe"
      ? compareSpec.leftWindow ??
        getRelativeDateWindow(compareSpec.leftTimeframe ?? "this_week")
      : compareSpec.selectedWindow ??
        getRelativeDateWindow(compareSpec.selectedTimeframe ?? "last_week")
  const comparisonWindow =
    compareSpec.mode === "timeframe"
      ? compareSpec.rightWindow ??
        getRelativeDateWindow(compareSpec.rightTimeframe ?? "last_week")
      : undefined

  return {
    intent: "compare",
    headline,
    summary,
    metric: "cashflow_health_score",
    timeframe: timeframeLabel,
    comparisonBasis:
      compareSpec.mode === "timeframe"
        ? "Side-by-side cashflow health comparison across adjacent weekly windows"
        : "Side-by-side cashflow health comparison across two peers in the same selected week",
    confidence: calculateConfidenceScore({
      evidenceCount: evidence.length,
      driverCount: drivers.length,
      hasCrossSourceEvidence: evidence.some((item) => item.sourceType === "mongodb"),
      fallback: false,
    }),
    activeScope,
    drivers,
    chartSpec: buildChartSpec(compareSpec, leftRow, rightRow),
    evidence,
    assumptions: buildAssumptions(args.plan),
    supportedFollowUps: buildCompareFollowUps({
      targetWindow,
      comparisonWindow,
    }),
    followUpActions: buildCompareFollowUpActions({
      targetWindow,
      weakerLabel:
        comparisonSummary.tie ||
        comparisonSummary.winnerLabel === compareSpec.rightLabel
          ? compareSpec.leftLabel
          : compareSpec.rightLabel,
      compareDimension: compareSpec.dimension,
    }),
    comparisonSummary,
    sourceMode: args.dataAccess.sourceMode,
  }
}
