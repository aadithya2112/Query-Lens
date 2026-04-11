import { getDatasetDefinition, getDefaultDatasetId } from "@/lib/querylens/datasets"
import {
  normalizePhase1Text,
  resolvePhase1Scope,
} from "@/lib/querylens/server/parser"
import type {
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

function isSupportedMetric(question: string) {
  const normalizedQuestion = normalizePhase1Text(question)
  const dataset = getDatasetDefinition()
  const metric = dataset.metrics[0]

  return metric.synonyms.some((synonym) =>
    normalizedQuestion.includes(normalizePhase1Text(synonym))
  )
}

function isSupportedIntent(question: string) {
  const normalizedQuestion = normalizePhase1Text(question)
  return /(why|what changed|drop|dropped|decline|declined|fell|fall)/.test(
    normalizedQuestion
  )
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

  if (!dataset.supportedTimeframes.includes(plan.timeframe)) {
    return {
      fallbackReason: `The ${dataset.label} dataset does not support that timeframe yet.`,
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

  if (!isSupportedMetric(question)) {
    return {
      fallbackReason:
        "Phase 1 only supports questions about the cashflow health score right now.",
    }
  }

  if (!isSupportedIntent(question)) {
    return {
      fallbackReason:
        "Phase 1 is limited to 'what changed' questions such as why the score dropped this week or last week.",
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
