import { getSampleDataset } from "@/lib/querylens/seed-data"
import { getDatasetDefinition, getDefaultDatasetId } from "@/lib/querylens/datasets"
import {
  normalizePhase1Text,
  resolvePhase1Scope,
  resolvePhase1ScopeValue,
} from "@/lib/querylens/server/parser"
import type {
  BreakdownDimension,
  CompareDimension,
  CompareSpec,
  QueryPlanResult,
  ScopeFilter,
  StructuredQueryPlan,
  SupportedTimeframe,
} from "@/lib/querylens/types"

function resolveTimeframe(question: string): SupportedTimeframe | undefined {
  const normalizedQuestion = normalizePhase1Text(question)

  if (normalizedQuestion.includes("last week")) {
    return "last_week"
  }

  if (normalizedQuestion.includes("this week")) {
    return "this_week"
  }

  return undefined
}

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

  return dataset.metrics.find((metric) =>
    metric.synonyms.some((synonym) =>
      normalizedQuestion.includes(normalizePhase1Text(synonym))
    )
  )
}

function isWhatChangedIntent(normalizedQuestion: string) {
  return /(why|what changed|drop|dropped|decline|declined|fell|fall)/.test(
    normalizedQuestion
  )
}

function isBreakdownIntent(normalizedQuestion: string) {
  return /(break down|breakdown|make up|composition|split|show|by region|by sector|by region and sector)/.test(
    normalizedQuestion
  )
}

function isCompareIntent(normalizedQuestion: string) {
  return /\b(compare|vs|versus)\b/.test(normalizedQuestion)
}

function resolveBreakdownDimension(
  normalizedQuestion: string,
  scope: ScopeFilter
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

function resolveTimeframeLabel(timeframe: SupportedTimeframe) {
  return timeframe === "this_week" ? "This week" : "Last week"
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

  const subjectMatch = normalizedQuestion.match(/compare\s+(.+?)\s+(?:vs|versus)\s+(.+)/)

  if (!subjectMatch) {
    return {}
  }

  const [, rawLeft, rawRight] = subjectMatch
  const dataset = getSampleDataset()
  const leftRegion = resolvePhase1ScopeValue(rawLeft, dataset.regions)
  const rightRegion = resolvePhase1ScopeValue(rawRight, dataset.regions)
  const leftSector = resolvePhase1ScopeValue(rawLeft, dataset.sectors)
  const rightSector = resolvePhase1ScopeValue(rawRight, dataset.sectors)

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
    const leftLabel =
      dataset.regions.find((region) => region.id === leftRegion)?.name ?? rawLeft
    const rightLabel =
      dataset.regions.find((region) => region.id === rightRegion)?.name ?? rawRight

    return {
      dimension: "region" as const,
      leftScope: { region: leftRegion },
      rightScope: { region: rightRegion },
      leftLabel,
      rightLabel,
    }
  }

  if (leftSector && rightSector) {
    const leftLabel =
      dataset.sectors.find((sector) => sector.id === leftSector)?.name ?? rawLeft
    const rightLabel =
      dataset.sectors.find((sector) => sector.id === rightSector)?.name ?? rawRight

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

function buildTimeframeCompareSpec(scope: ScopeFilter): CompareSpec | QueryPlanResult {
  if (scope.region && scope.sector) {
    return {
      fallbackReason:
        "Compare currently supports the portfolio or a single region or sector scope, not both at once.",
    }
  }

  const dataset = getSampleDataset()
  const leftLabel = "This week"
  const rightLabel = "Last week"

  const scopeLabel = scope.region
    ? dataset.regions.find((region) => region.id === scope.region)?.name
    : scope.sector
      ? dataset.sectors.find((sector) => sector.id === scope.sector)?.name
      : undefined

  return {
    mode: "timeframe",
    leftTimeframe: "this_week",
    rightTimeframe: "last_week",
    leftScope: scope,
    rightScope: scope,
    leftLabel: scopeLabel ? `${scopeLabel} · ${leftLabel}` : leftLabel,
    rightLabel: scopeLabel ? `${scopeLabel} · ${rightLabel}` : rightLabel,
  }
}

function buildPeerCompareSpec(
  question: string,
  timeframe: SupportedTimeframe,
  scopeOverride?: ScopeFilter
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
    selectedTimeframe: timeframe,
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

  if (!dataset.metrics.some((metric) => metric.id === plan.metricId)) {
    return {
      fallbackReason: `The ${dataset.label} dataset does not support that metric yet.`,
    }
  }

  const metric = dataset.metrics.find((candidate) => candidate.id === plan.metricId)

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
  scopeOverride?: ScopeFilter
): QueryPlanResult {
  const datasetId = getDefaultDatasetId()
  const normalizedQuestion = normalizePhase1Text(question)
  const metric = resolveMetric(question)

  if (!metric) {
    return {
      fallbackReason:
        "QueryLens currently supports cashflow health change and compare questions, plus at-risk account breakdowns for this dataset.",
    }
  }

  const timeframe = resolveTimeframe(question)

  if (!timeframe) {
    return {
      fallbackReason:
        "Try asking about 'this week' or 'last week' so QueryLens can compare the current weekly windows safely.",
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
      const timeframeCompare =
        normalizedQuestion.includes("this week vs last week") ||
        normalizedQuestion.includes("this week versus last week") ||
        normalizedQuestion.includes("last week vs this week") ||
        normalizedQuestion.includes("last week versus this week")

      const compareSpec = timeframeCompare
        ? buildTimeframeCompareSpec(scope)
        : buildPeerCompareSpec(question, timeframe, scopeOverride)

      if ("fallbackReason" in compareSpec) {
        return compareSpec
      }

      const resolvedCompareSpec = compareSpec as CompareSpec

      return validateQueryPlan({
        datasetId,
        rawQuestion: question,
        intent: "compare",
        metricId: "cashflow_health_score",
        timeframe: timeframeCompare ? "this_week" : timeframe,
        scope: timeframeCompare ? scope : {},
        scopeDimensions: timeframeCompare
          ? [...resolveScopeDimensions(scope)]
          : [resolvedCompareSpec.dimension ?? "portfolio"],
        comparisonWindow: {
          timeframe: timeframeCompare ? "this_week" : timeframe,
          comparisonBasis: "prior_period",
        },
        compareSpec: resolvedCompareSpec,
      })
    }

    if (!isWhatChangedIntent(normalizedQuestion)) {
      return {
        fallbackReason:
          "Cashflow health currently supports 'what changed' and compare questions for this week or last week.",
      }
    }

    return validateQueryPlan({
      datasetId,
      rawQuestion: question,
      intent: "what_changed",
      metricId: "cashflow_health_score",
      timeframe,
      scope,
      scopeDimensions: [...resolveScopeDimensions(scope)],
      comparisonWindow: {
        timeframe,
        comparisonBasis: "prior_period",
      },
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

  return validateQueryPlan({
    datasetId,
    rawQuestion: question,
    intent: "breakdown",
    metricId: "at_risk_account_count",
    timeframe,
    scope,
    scopeDimensions: [...resolveScopeDimensions(scope)],
    comparisonWindow: {
      timeframe,
      comparisonBasis: "prior_period",
    },
    breakdownDimension: resolveBreakdownDimension(normalizedQuestion, scope),
  })
}
