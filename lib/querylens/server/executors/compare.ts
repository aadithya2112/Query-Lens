import { getRelativeDateWindow } from "@/lib/querylens/date-windows"
import { calculateConfidenceScore, roundTo } from "@/lib/querylens/scoring"
import {
  compareSlicesCapability,
  explainCompareGapCapability,
  retrieveContextCapability,
  type BuiltInCapabilityContext,
  type CashflowComponentGap,
} from "@/lib/querylens/server/built-in-pipeline/capabilities"
import type {
  BuiltInExecutionFailure,
  CompareExecutionPayload,
} from "@/lib/querylens/server/built-in-pipeline/types"
import type { QueryLensDataAccess } from "@/lib/querylens/server/repositories"
import type {
  CompareSpec,
  ContextEvent,
  DriverItem,
  EvidenceItem,
  ScopeFilter,
  StructuredQueryPlan,
  WeeklyMetricRow,
} from "@/lib/querylens/types"

interface CompareExecutorArgs {
  context: BuiltInCapabilityContext
  dataAccess: QueryLensDataAccess
  plan: StructuredQueryPlan
}

function describeComponentGap(gap: CashflowComponentGap, left: WeeklyMetricRow, right: WeeklyMetricRow) {
  switch (gap.id) {
    case "coverage_gap":
      return {
        id: gap.id,
        title: "Payment coverage is the widest gap",
        delta: gap.weightedGap,
        description: `${left.regionName ?? left.sectorName ?? "The left side"} ran at ${(gap.leftRatio ?? 0).toFixed(2)}x coverage versus ${(gap.rightRatio ?? 0).toFixed(2)}x on the right side.`,
      }
    case "balance_gap":
      return {
        id: gap.id,
        title: "Closing balance resilience separates the two sides",
        delta: gap.weightedGap,
        description: `The comparison closes at ${(gap.leftClosingBalance ?? 0).toLocaleString()} versus ${(gap.rightClosingBalance ?? 0).toLocaleString()}, creating a visible gap in end-of-week balance strength.`,
      }
    case "stress_gap":
      return {
        id: gap.id,
        title: "Stress indicators remain meaningfully different",
        delta: gap.weightedGap,
        description: `Low-balance share is ${((gap.leftLowBalanceShare ?? 0) * 100).toFixed(1)}% versus ${((gap.rightLowBalanceShare ?? 0) * 100).toFixed(1)}%, while overdue exposure is ${((gap.leftOverdueShare ?? 0) * 100).toFixed(1)}% versus ${((gap.rightOverdueShare ?? 0) * 100).toFixed(1)}%.`,
      }
  }
}

function buildDrivers(
  left: WeeklyMetricRow,
  right: WeeklyMetricRow,
  compareSpec: CompareSpec,
  componentGaps: CashflowComponentGap[],
): DriverItem[] {
  const leftLeads = left.cashflowHealthScore >= right.cashflowHealthScore
  const strongerLabel = leftLeads ? compareSpec.leftLabel : compareSpec.rightLabel
  const weakerLabel = leftLeads ? compareSpec.rightLabel : compareSpec.leftLabel
  const strongerRow = leftLeads ? left : right
  const weakerRow = leftLeads ? right : left

  return componentGaps
    .map((gap) => describeComponentGap(gap, strongerRow, weakerRow))
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

function buildEvidence(args: {
  compareSpec: CompareSpec
  left: WeeklyMetricRow
  right: WeeklyMetricRow
  contextEvents: ContextEvent[]
  timeframeLabel: string
  componentGaps: CashflowComponentGap[]
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

  const biggestGap = args.componentGaps
    .map((gap) => describeComponentGap(gap, args.left, args.right))
    .sort((leftGap, rightGap) => rightGap.delta - leftGap.delta)[0]

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

export async function executeComparePlan(
  args: CompareExecutorArgs
): Promise<CompareExecutionPayload | BuiltInExecutionFailure> {
  const compareSpec = args.plan.compareSpec

  if (!compareSpec) {
    return {
      kind: "failure",
      fallbackReason:
        "The compare request could not be resolved into a supported side-by-side view.",
    }
  }

  const compareSlices = await compareSlicesCapability({
    context: args.context,
    compareSpec,
  })
  const { leftRow, rightRow, timeframeLabel } = compareSlices

  if (!leftRow || !rightRow) {
    return {
      kind: "failure",
      fallbackReason:
        "The sample dataset could not resolve both sides of that comparison safely.",
    }
  }

  const comparisonSummary = buildComparisonSummary(compareSpec, leftRow, rightRow)
  const weakerScope =
    comparisonSummary.tie || comparisonSummary.winnerLabel === compareSpec.rightLabel
      ? compareSpec.leftScope
      : compareSpec.rightScope
  const contextRequests =
    compareSpec.mode === "timeframe"
      ? [
          {
            window:
              compareSlices.leftWindow ??
              getRelativeDateWindow(compareSpec.leftTimeframe ?? "this_week"),
            scope: compareSpec.leftScope,
          },
          {
            window:
              compareSlices.rightWindow ??
              getRelativeDateWindow(compareSpec.rightTimeframe ?? "last_week"),
            scope: compareSpec.rightScope,
          },
        ]
      : [
          {
            window:
              compareSlices.selectedWindow ??
              getRelativeDateWindow(compareSpec.selectedTimeframe ?? "last_week"),
            scope: weakerScope,
          },
          {
            window:
              compareSlices.selectedWindow ??
              getRelativeDateWindow(compareSpec.selectedTimeframe ?? "last_week"),
            scope:
              weakerScope.region === compareSpec.leftScope.region &&
              weakerScope.sector === compareSpec.leftScope.sector
                ? compareSpec.rightScope
                : compareSpec.leftScope,
          },
        ]
  const contextEvents = await retrieveContextCapability({
    context: args.context,
    requests: contextRequests,
  })
  const driverComponentGaps = explainCompareGapCapability({
    context: args.context,
    left: leftRow.cashflowHealthScore >= rightRow.cashflowHealthScore
      ? leftRow
      : rightRow,
    right: leftRow.cashflowHealthScore >= rightRow.cashflowHealthScore
      ? rightRow
      : leftRow,
  })
  const evidenceComponentGaps = explainCompareGapCapability({
    context: args.context,
    left: leftRow,
    right: rightRow,
  })
  const drivers = buildDrivers(
    leftRow,
    rightRow,
    compareSpec,
    driverComponentGaps,
  )
  const evidence = buildEvidence({
    compareSpec,
    left: leftRow,
    right: rightRow,
    contextEvents,
    timeframeLabel,
    componentGaps: evidenceComponentGaps,
  })
  const activeScope = `${compareSpec.leftLabel} vs ${compareSpec.rightLabel}`
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
  const weakerLabel =
    comparisonSummary.tie ||
    comparisonSummary.winnerLabel === compareSpec.rightLabel
      ? compareSpec.leftLabel
      : compareSpec.rightLabel

  return {
    kind: "success",
    intent: "compare",
    plan: args.plan,
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
    sourceMode: args.dataAccess.sourceMode,
    comparisonSummary,
    presentation: {
      targetWindow,
      comparisonWindow,
      weakerLabel,
      compareDimension: compareSpec.dimension,
    },
  }
}
