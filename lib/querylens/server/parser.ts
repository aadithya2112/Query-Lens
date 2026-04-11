import { getPrimaryDatasetMetricDefinition } from "@/lib/querylens/datasets"
import { getSeedDataset } from "@/lib/querylens/seed-data"
import type {
  ParsedPhase1Query,
  ScopeFilter,
  SupportedTimeframe,
} from "@/lib/querylens/types"

export interface ParseResult {
  parsed?: ParsedPhase1Query
  fallbackReason?: string
}

export function normalizePhase1Text(value: string): string {
  return value.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim()
}

export function resolvePhase1ScopeValue(
  rawValue: string | undefined,
  catalog: Array<{ id: string; name: string }>
) {
  if (!rawValue) return undefined

  const candidate = normalizePhase1Text(rawValue)
  return catalog.find((item) => {
    const idCandidate = normalizePhase1Text(item.id.replace(/_/g, " "))
    const nameCandidate = normalizePhase1Text(item.name)
    return candidate === idCandidate || candidate === nameCandidate || candidate.includes(nameCandidate)
  })?.id
}

export function resolvePhase1Scope(scope: ScopeFilter) {
  const dataset = getSeedDataset()
  const region = resolvePhase1ScopeValue(scope.region, dataset.regions)
  const sector = resolvePhase1ScopeValue(scope.sector, dataset.sectors)

  return {
    scope: {
      ...(region ? { region } : {}),
      ...(sector ? { sector } : {}),
    },
    invalidRegion: Boolean(scope.region && !region),
    invalidSector: Boolean(scope.sector && !sector),
  }
}

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

function resolveMetric(question: string): boolean {
  const normalizedQuestion = normalizePhase1Text(question)
  const metric = getPrimaryDatasetMetricDefinition()

  return metric.synonyms.some((synonym) =>
    normalizedQuestion.includes(normalizePhase1Text(synonym))
  )
}

function isSupportedIntent(question: string): boolean {
  const normalizedQuestion = normalizePhase1Text(question)
  return /(why|what changed|drop|dropped|decline|declined|fell|fall)/.test(
    normalizedQuestion
  )
}

export function parsePhase1Question(
  question: string,
  scopeOverride?: ScopeFilter
): ParseResult {
  const normalizedQuestion = normalizePhase1Text(question)

  if (!resolveMetric(question)) {
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

  return {
    parsed: {
      rawQuestion: question,
      intent: "what_changed",
      metric: "cashflow_health_score",
      timeframe,
      scope,
    },
  }
}
