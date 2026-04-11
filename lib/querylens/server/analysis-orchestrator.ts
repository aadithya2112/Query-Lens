import type { QueryLensExecutionContext } from "@/lib/querylens/server/ai-config"
import { getQueryEngineProvider } from "@/lib/querylens/server/query-engine-provider"
import { executeBreakdownPlan } from "@/lib/querylens/server/executors/breakdown"
import {
  buildWhatChangedFallbackResponse,
  executeWhatChangedPlan,
} from "@/lib/querylens/server/executors/what-changed"
import { getQueryLensDataAccess } from "@/lib/querylens/server/repositories"
import type {
  Phase1AnalysisResponse,
  QueryRequestBody,
  QueryIntent,
  StructuredQueryPlan,
} from "@/lib/querylens/types"

interface IntentExecutor {
  execute(args: {
    plan: StructuredQueryPlan
    weeklyRows: Awaited<ReturnType<Awaited<ReturnType<typeof getQueryLensDataAccess>>["listWeeklyMetrics"]>>
    dataAccess: Awaited<ReturnType<typeof getQueryLensDataAccess>>
    composeNarrative: ReturnType<typeof getQueryEngineProvider>["composeNarrative"]
  }): Promise<Phase1AnalysisResponse>
}

const executors: Partial<Record<QueryIntent, IntentExecutor>> = {
  breakdown: {
    execute: executeBreakdownPlan,
  },
  what_changed: {
    execute: executeWhatChangedPlan,
  },
}

export async function analyzeQuery(
  input: QueryRequestBody,
  options: { executionContext?: QueryLensExecutionContext } = {}
): Promise<Phase1AnalysisResponse> {
  const dataAccess = await getQueryLensDataAccess()
  const weeklyRows = await dataAccess.listWeeklyMetrics()
  const provider = getQueryEngineProvider({
    executionContext: options.executionContext ?? "interactive",
  })
  const parseResult = await provider.planQuery(input.question, input.scope)

  if (!parseResult.parsed) {
    return buildWhatChangedFallbackResponse({
      fallbackReason:
        parseResult.fallbackReason ??
        "The question could not be matched to the phase-1 vertical slice safely.",
      sourceMode: dataAccess.sourceMode,
      rows: weeklyRows,
    })
  }

  const executor = executors[parseResult.parsed.intent]

  if (!executor) {
    return buildWhatChangedFallbackResponse({
      fallbackReason:
        "That query intent is not registered yet for the current dataset.",
      sourceMode: dataAccess.sourceMode,
      rows: weeklyRows,
    })
  }

  const response = await executor.execute({
    plan: parseResult.parsed,
    weeklyRows,
    dataAccess,
    composeNarrative: provider.composeNarrative,
  })

  return {
    ...response,
    metric: response.metric ?? parseResult.parsed.metricId,
  }
}
