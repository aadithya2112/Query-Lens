import { getPrimaryMetricDefinition } from "@/lib/querylens/metric-manifest"
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

function normalize(value: string): string {
  return value.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim()
}

function resolveScopeValue(
  rawValue: string | undefined,
  catalog: Array<{ id: string; name: string }>
) {
  if (!rawValue) return undefined

  const candidate = normalize(rawValue)
  return catalog.find((item) => {
    const idCandidate = normalize(item.id.replace(/_/g, " "))
    const nameCandidate = normalize(item.name)
    return candidate === idCandidate || candidate === nameCandidate || candidate.includes(nameCandidate)
  })?.id
}

function resolveTimeframe(question: string): SupportedTimeframe | undefined {
  const normalizedQuestion = normalize(question)

  if (normalizedQuestion.includes("last week")) {
    return "last_week"
  }

  if (normalizedQuestion.includes("this week")) {
    return "this_week"
  }

  return undefined
}

function resolveMetric(question: string): boolean {
  const normalizedQuestion = normalize(question)
  const metric = getPrimaryMetricDefinition()

  return metric.synonyms.some((synonym) => normalizedQuestion.includes(normalize(synonym)))
}

function isSupportedIntent(question: string): boolean {
  const normalizedQuestion = normalize(question)
  return /(why|what changed|drop|dropped|decline|declined|fell|fall)/.test(
    normalizedQuestion
  )
}

export function parsePhase1Question(
  question: string,
  scopeOverride?: ScopeFilter
): ParseResult {
  const normalizedQuestion = normalize(question)
  const dataset = getSeedDataset()

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

  const region =
    resolveScopeValue(scopeOverride?.region, dataset.regions) ??
    resolveScopeValue(normalizedQuestion, dataset.regions)
  const sector =
    resolveScopeValue(scopeOverride?.sector, dataset.sectors) ??
    resolveScopeValue(normalizedQuestion, dataset.sectors)

  return {
    parsed: {
      rawQuestion: question,
      intent: "what_changed",
      metric: "cashflow_health_score",
      timeframe,
      scope: {
        ...(region ? { region } : {}),
        ...(sector ? { sector } : {}),
      },
    },
  }
}
