import { getDatasetDefinition, getDefaultDatasetId } from "@/lib/querylens/datasets"
import {
  normalizePhase1Text,
  resolvePhase1Scope,
} from "@/lib/querylens/server/parser"
import type {
  BreakdownDimension,
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
        "QueryLens currently supports cashflow health change questions and at-risk account breakdowns for this dataset.",
    }
  }

  const timeframe = resolveTimeframe(question)

  if (!timeframe) {
    return {
      fallbackReason:
        "Try asking about 'this week' or 'last week' so QueryLens can compare the seeded weekly windows safely.",
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
    if (!isWhatChangedIntent(normalizedQuestion)) {
      return {
        fallbackReason:
          "Cashflow health currently supports 'what changed' questions such as why the score dropped this week or last week.",
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
