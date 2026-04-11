import { getSampleDataset } from "@/lib/querylens/seed-data"
import { planDeterministicQuery } from "@/lib/querylens/server/query-planner"
import type {
  QueryPlanResult,
  ScopeFilter,
} from "@/lib/querylens/types"

export type ParseResult = QueryPlanResult

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
  const dataset = getSampleDataset()
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

export function parsePhase1Question(
  question: string,
  scopeOverride?: ScopeFilter
): ParseResult {
  const result = planDeterministicQuery(question, scopeOverride)

  return {
    plan: result.plan,
    parsed: result.plan,
    fallbackReason: result.fallbackReason,
  }
}
