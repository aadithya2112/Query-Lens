import {
  buildPriorEqualDateWindow,
  getRelativeDateWindow,
  resolveQuestionDateWindows,
} from "@/lib/querylens/date-windows"
import {
  getDatasetDefinition,
  getDefaultDatasetId,
} from "@/lib/querylens/datasets"
import {
  getSemanticEntityLabel,
} from "@/lib/querylens/semantic-manifest"
import {
  normalizePhase1Text,
  resolvePhase1Scope,
  resolvePhase1ScopeValue,
} from "@/lib/querylens/server/parser"
import type {
  BreakdownDimension,
  CompareDimension,
  CompareSpec,
  DateWindow,
  DiscoveryFocus,
  PlannedTimeframe,
  QueryPlanResult,
  ScopeFilter,
  StructuredQueryPlan,
} from "@/lib/querylens/types"

function resolveScopeDimensions(scope: ScopeFilter) {
  if (scope.region && scope.sector) {
    return ["region", "sector"] as const
  }

  if (scope.region) {
    return ["region"] as const
  }

  if (scope.sector) {
    return ["sector"] as const
  }

  return ["portfolio"] as const
}

function resolveMetric(question: string) {
  const normalizedQuestion = normalizePhase1Text(question)
  const dataset = getDatasetDefinition()

  const directMatch = dataset.metrics.find((metric) =>
    metric.synonyms.some((synonym) =>
      normalizedQuestion.includes(normalizePhase1Text(synonym)),
    ),
  )

  if (directMatch) {
    return directMatch
  }

  if (/\bcash\s*flow\b|\bcashflow\b/.test(question.toLowerCase())) {
    return dataset.metrics.find(
      (metric) => metric.id === "cashflow_health_score",
    )
  }

  if (
    /\bat risk\b|\bat-risk\b|\brisky\b|\bstressed accounts\b/.test(
      question.toLowerCase(),
    )
  ) {
    return dataset.metrics.find(
      (metric) => metric.id === "at_risk_account_count",
    )
  }

  return undefined
}

function isWhatChangedIntent(normalizedQuestion: string) {
  return /(why|what changed|drop|dropped|decline|declined|fell|fall)/.test(
    normalizedQuestion,
  )
}

function isBreakdownIntent(normalizedQuestion: string) {
  return /(break down|breakdown|make up|composition|split|show|by region|by sector|by region and sector)/.test(
    normalizedQuestion,
  )
}

function isCompareIntent(normalizedQuestion: string) {
  return /\b(compare|vs|versus)\b/.test(normalizedQuestion)
}

function isDiscoveryIntent(normalizedQuestion: string) {
  return /(what data|type of data|data types?|what is stored|currently stored|currently used|what can i ask|what metrics|which metrics|which sources|what sources|what regions|what sectors|time range|time coverage|what data do we have|what is available|available data)/.test(
    normalizedQuestion,
  )
}

function resolveDiscoveryFocus(normalizedQuestion: string): DiscoveryFocus {
  if (/(what metrics|which metrics)/.test(normalizedQuestion)) {
    return "metrics"
  }

  if (
    /(which sources|what sources|connected sources)/.test(normalizedQuestion)
  ) {
    return "sources"
  }

  if (
    /(what regions|what sectors|dimensions|segments|categories)/.test(
      normalizedQuestion,
    )
  ) {
    return "dimensions"
  }

  if (
    /(time range|time coverage|how far back|what period)/.test(
      normalizedQuestion,
    )
  ) {
    return "time_coverage"
  }

  if (
    /(what can i ask|supported questions|examples)/.test(normalizedQuestion)
  ) {
    return "questions"
  }

  return "overview"
}

function resolveBreakdownDimension(
  normalizedQuestion: string,
  scope: ScopeFilter,
): BreakdownDimension {
  if (
    normalizedQuestion.includes("region and sector") ||
    normalizedQuestion.includes("sector and region")
  ) {
    return "region_sector"
  }

  if (normalizedQuestion.includes("by region")) {
    return "region"
  }

  if (normalizedQuestion.includes("by sector")) {
    return "sector"
  }

  if (scope.region && !scope.sector) {
    return "sector"
  }

  if (!scope.region && scope.sector) {
    return "region"
  }

  return "region_sector"
}

function resolvePlanningTimeframe(window: DateWindow): PlannedTimeframe {
  return window.relativeTimeframe ?? "custom"
}

function buildPlanComparisonWindow(
  targetWindow: DateWindow,
  comparisonDateWindow?: DateWindow,
) {
  return {
    timeframe: resolvePlanningTimeframe(targetWindow),
    comparisonBasis: "prior_period" as const,
    targetWindow,
    comparisonDateWindow,
  }
}

function getWindowDisplayLabel(window: DateWindow) {
  if (window.relativeTimeframe === "this_week") {
    return "This week"
  }

  if (window.relativeTimeframe === "last_week") {
    return "Last week"
  }

  return window.label
}

function parseCompareSubjects(question: string) {
  const normalizedQuestion = normalizePhase1Text(question)
  const match = normalizedQuestion.match(/\bvs\b|\bversus\b/g)

  if ((match?.length ?? 0) > 1) {
    return {
      fallbackReason:
        "Compare currently supports exactly two regions or exactly two sectors at a time.",
    }
  }

  const subjectMatch = normalizedQuestion.match(
    /compare\s+(.+?)\s+(?:vs|versus)\s+(.+)/,
  )

  if (!subjectMatch) {
    return {}
  }

  const [, rawLeft, rawRight] = subjectMatch
  const leftRegion = resolvePhase1ScopeValue(rawLeft, "region")
  const rightRegion = resolvePhase1ScopeValue(rawRight, "region")
  const leftSector = resolvePhase1ScopeValue(rawLeft, "sector")
  const rightSector = resolvePhase1ScopeValue(rawRight, "sector")

  if ((leftRegion && leftSector) || (rightRegion && rightSector)) {
    return {
      fallbackReason:
        "Compare does not support region-and-sector combo peer comparisons yet.",
    }
  }

  if ((leftRegion && rightSector) || (leftSector && rightRegion)) {
    return {
      fallbackReason:
        "Compare only supports region vs region or sector vs sector, not mixed dimensions.",
    }
  }

  if (leftRegion && rightRegion) {
    const leftLabel = getSemanticEntityLabel("region", leftRegion) ?? rawLeft
    const rightLabel = getSemanticEntityLabel("region", rightRegion) ?? rawRight

    return {
      dimension: "region" as const,
      leftScope: { region: leftRegion },
      rightScope: { region: rightRegion },
      leftLabel,
      rightLabel,
    }
  }

  if (leftSector && rightSector) {
    const leftLabel = getSemanticEntityLabel("sector", leftSector) ?? rawLeft
    const rightLabel = getSemanticEntityLabel("sector", rightSector) ?? rawRight

    return {
      dimension: "sector" as const,
      leftScope: { sector: leftSector },
      rightScope: { sector: rightSector },
      leftLabel,
      rightLabel,
    }
  }

  return {}
}

function buildTimeframeCompareSpec(
  scope: ScopeFilter,
  leftWindow: DateWindow,
  rightWindow: DateWindow,
): CompareSpec | QueryPlanResult {
  if (scope.region && scope.sector) {
    return {
      fallbackReason:
        "Compare currently supports the portfolio or a single region or sector scope, not both at once.",
    }
  }

  if (leftWindow.dayCount !== rightWindow.dayCount) {
    return {
      fallbackReason:
        "Timeframe compare needs two windows of the same length so QueryLens can keep the score comparison grounded.",
    }
  }

  const leftLabel = getWindowDisplayLabel(leftWindow)
  const rightLabel = getWindowDisplayLabel(rightWindow)

  const scopeLabel = scope.region
    ? getSemanticEntityLabel("region", scope.region)
    : scope.sector
      ? getSemanticEntityLabel("sector", scope.sector)
      : undefined

  return {
    mode: "timeframe",
    leftTimeframe: leftWindow.relativeTimeframe,
    rightTimeframe: rightWindow.relativeTimeframe,
    leftWindow,
    rightWindow,
    leftScope: scope,
    rightScope: scope,
    leftLabel: scopeLabel ? `${scopeLabel} · ${leftLabel}` : leftLabel,
    rightLabel: scopeLabel ? `${scopeLabel} · ${rightLabel}` : rightLabel,
  }
}

function buildPeerCompareSpec(
  question: string,
  selectedWindow: DateWindow,
  scopeOverride?: ScopeFilter,
): CompareSpec | QueryPlanResult {
  if (scopeOverride?.region || scopeOverride?.sector) {
    return {
      fallbackReason:
        "Peer compare does not support an extra scope override on top of the two compared peers.",
    }
  }

  const parsed = parseCompareSubjects(question)

  if ("fallbackReason" in parsed) {
    return parsed
  }

  if (
    !parsed.dimension ||
    !parsed.leftScope ||
    !parsed.rightScope ||
    !parsed.leftLabel ||
    !parsed.rightLabel
  ) {
    return {
      fallbackReason:
        "Compare currently supports exactly two regions or exactly two sectors in one selected week.",
    }
  }

  return {
    mode: "peer",
    dimension: parsed.dimension as CompareDimension,
    selectedTimeframe: selectedWindow.relativeTimeframe,
    selectedWindow,
    leftScope: parsed.leftScope,
    rightScope: parsed.rightScope,
    leftLabel: parsed.leftLabel,
    rightLabel: parsed.rightLabel,
  }
}

export function validateQueryPlan(plan: StructuredQueryPlan): QueryPlanResult {
  const dataset = getDatasetDefinition(plan.datasetId)

  if (!dataset.supportedIntentIds.includes(plan.intent)) {
    return {
      fallbackReason: `The ${dataset.label} dataset does not support that intent yet.`,
    }
  }

  if (plan.intent === "discovery") {
    return {
      plan,
      parsed: plan,
    }
  }

  if (!dataset.metrics.some((metric) => metric.id === plan.metricId)) {
    return {
      fallbackReason: `The ${dataset.label} dataset does not support that metric yet.`,
    }
  }

  const metric = dataset.metrics.find(
    (candidate) => candidate.id === plan.metricId,
  )

  if (metric && !metric.supportedIntents.includes(plan.intent)) {
    return {
      fallbackReason: `The ${metric.label} metric does not support the ${plan.intent.replace("_", " ")} flow yet.`,
    }
  }

  if (!dataset.supportedTimeframes.includes(plan.timeframe)) {
    return {
      fallbackReason: `The ${dataset.label} dataset does not support that timeframe yet.`,
    }
  }

  if (plan.intent === "breakdown" && !plan.breakdownDimension) {
    return {
      fallbackReason:
        "Breakdown questions need a region, sector, or region-and-sector view.",
    }
  }

  if (plan.intent === "compare" && !plan.compareSpec) {
    return {
      fallbackReason:
        "Compare questions need either a this-week-vs-last-week view or two peers from the same dimension.",
    }
  }

  return {
    plan,
    parsed: plan,
  }
}

export function planDeterministicQuery(
  question: string,
  scopeOverride?: ScopeFilter,
): QueryPlanResult {
  const datasetId = getDefaultDatasetId()
  const normalizedQuestion = normalizePhase1Text(question)
  const metric = resolveMetric(question)
  const resolvedDateWindows = resolveQuestionDateWindows(question)
  const primaryWindow = resolvedDateWindows.primaryWindow
  const compareWindows = resolvedDateWindows.compareWindows
  const discoveryWindow = getRelativeDateWindow("this_week")

  if (isDiscoveryIntent(normalizedQuestion)) {
    return validateQueryPlan({
      datasetId,
      rawQuestion: question,
      intent: "discovery",
      metricId: "dataset_catalog",
      dateWindow: discoveryWindow,
      timeframe: "this_week",
      scope: {},
      scopeDimensions: ["portfolio"],
      comparisonWindow: buildPlanComparisonWindow(discoveryWindow),
      discoveryFocus: resolveDiscoveryFocus(normalizedQuestion),
    })
  }

  if (!metric) {
    return {
      fallbackReason:
        "QueryLens currently supports cashflow health change and compare questions, plus at-risk account breakdowns for this dataset.",
    }
  }

  if (!primaryWindow && !compareWindows) {
    return {
      fallbackReason:
        "Try asking about an exact date, a date range, 'week of ...', 'this week', or 'last week' so QueryLens can resolve the analysis window safely.",
    }
  }

  const questionScope = resolvePhase1Scope({
    region: normalizedQuestion,
    sector: normalizedQuestion,
  }).scope
  const overrideScope = resolvePhase1Scope(scopeOverride ?? {}).scope
  const scope = {
    ...questionScope,
    ...overrideScope,
  }

  if (metric.id === "cashflow_health_score") {
    if (isCompareIntent(normalizedQuestion)) {
      const timeframeCompare = Boolean(compareWindows)
      const compareSpec = compareWindows
        ? buildTimeframeCompareSpec(
            scope,
            compareWindows.leftWindow,
            compareWindows.rightWindow,
          )
        : primaryWindow
          ? buildPeerCompareSpec(question, primaryWindow, scopeOverride)
          : {
              fallbackReason:
                "Compare questions need either two explicit date windows or one selected window for the peer comparison.",
            }

      if ("fallbackReason" in compareSpec) {
        return compareSpec
      }

      const resolvedCompareSpec = compareSpec as CompareSpec
      const planDateWindow = compareWindows?.leftWindow ?? primaryWindow
      const planComparisonDateWindow =
        compareWindows?.rightWindow ??
        (primaryWindow ? buildPriorEqualDateWindow(primaryWindow) : undefined)

      if (!planDateWindow) {
        return {
          fallbackReason:
            "Compare questions need either two explicit date windows or one selected window for the peer comparison.",
        }
      }

      return validateQueryPlan({
        datasetId,
        rawQuestion: question,
        intent: "compare",
        metricId: "cashflow_health_score",
        dateWindow: planDateWindow,
        timeframe: resolvePlanningTimeframe(planDateWindow),
        scope: timeframeCompare ? scope : {},
        scopeDimensions: timeframeCompare
          ? [...resolveScopeDimensions(scope)]
          : [resolvedCompareSpec.dimension ?? "portfolio"],
        comparisonWindow: buildPlanComparisonWindow(
          planDateWindow,
          planComparisonDateWindow,
        ),
        compareSpec: resolvedCompareSpec,
      })
    }

    if (!isWhatChangedIntent(normalizedQuestion)) {
      return {
        fallbackReason:
          "Cashflow health currently supports 'what changed' and compare questions for this week or last week.",
      }
    }

    if (!primaryWindow) {
      return {
        fallbackReason:
          "Try asking about an exact date, a date range, 'week of ...', 'this week', or 'last week' so QueryLens can resolve the analysis window safely.",
      }
    }

    return validateQueryPlan({
      datasetId,
      rawQuestion: question,
      intent: "what_changed",
      metricId: "cashflow_health_score",
      dateWindow: primaryWindow,
      timeframe: resolvePlanningTimeframe(primaryWindow),
      scope,
      scopeDimensions: [...resolveScopeDimensions(scope)],
      comparisonWindow: buildPlanComparisonWindow(
        primaryWindow,
        buildPriorEqualDateWindow(primaryWindow),
      ),
    })
  }

  if (!isBreakdownIntent(normalizedQuestion)) {
    return {
      fallbackReason:
        "At-risk accounts currently support breakdown questions such as showing the split by region, sector, or region and sector.",
    }
  }

  if (scope.region && scope.sector) {
    return {
      fallbackReason:
        "For a useful breakdown, apply either a region filter or a sector filter, not both at once.",
    }
  }

  if (!primaryWindow) {
    return {
      fallbackReason:
        "Try asking about an exact date, a date range, 'week of ...', 'this week', or 'last week' so QueryLens can resolve the analysis window safely.",
    }
  }

  return validateQueryPlan({
    datasetId,
    rawQuestion: question,
    intent: "breakdown",
    metricId: "at_risk_account_count",
    dateWindow: primaryWindow,
    timeframe: resolvePlanningTimeframe(primaryWindow),
    scope,
    scopeDimensions: [...resolveScopeDimensions(scope)],
    comparisonWindow: buildPlanComparisonWindow(
      primaryWindow,
      buildPriorEqualDateWindow(primaryWindow),
    ),
    breakdownDimension: resolveBreakdownDimension(normalizedQuestion, scope),
  })
}
