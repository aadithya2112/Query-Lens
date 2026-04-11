import type { ScopeFilter } from "@/lib/querylens/types"

import {
  DEFAULT_FLAGSHIP_QUESTION,
  deterministicQueryEngineProvider,
  getQueryEngineProvider,
  SUPPORTED_QUERY_FOLLOW_UPS as PHASE1_SUPPORTED_FOLLOW_UPS,
  type QueryEngineProvider,
} from "@/lib/querylens/server/query-engine-provider"

export { DEFAULT_FLAGSHIP_QUESTION, PHASE1_SUPPORTED_FOLLOW_UPS }

export interface Phase1Provider {
  parseQuestion: (
    question: string,
    scopeOverride?: ScopeFilter
  ) => ReturnType<QueryEngineProvider["planQuery"]>
  composeNarrative: QueryEngineProvider["composeNarrative"]
}

function adaptProvider(provider: QueryEngineProvider): Phase1Provider {
  return {
    parseQuestion: provider.planQuery,
    composeNarrative: provider.composeNarrative,
  }
}

export const deterministicPhase1Provider: Phase1Provider = adaptProvider(
  deterministicQueryEngineProvider
)

export function getPhase1Provider(args: { executionContext: "bootstrap" | "interactive" }) {
  return adaptProvider(getQueryEngineProvider(args))
}
