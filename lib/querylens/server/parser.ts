import {
  findSemanticEntityByText,
  normalizeSemanticText,
} from "@/lib/querylens/semantic-manifest"
import { planDeterministicQuery } from "@/lib/querylens/server/query-planner"
import type {
  QueryPlanResult,
  ScopeFilter,
} from "@/lib/querylens/types"

export type ParseResult = QueryPlanResult

export function normalizePhase1Text(value: string): string {
  return normalizeSemanticText(value)
}

export function resolvePhase1ScopeValue(
  rawValue: string | undefined,
  scopeType: "region" | "sector",
) {
  return findSemanticEntityByText(scopeType, rawValue)?.id
}

export function resolvePhase1Scope(scope: ScopeFilter) {
  const region = resolvePhase1ScopeValue(scope.region, "region")
  const sector = resolvePhase1ScopeValue(scope.sector, "sector")

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
