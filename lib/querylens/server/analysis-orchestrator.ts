import { canUseGemini } from "@/lib/querylens/server/ai-config"
import { executeAgenticFallback } from "@/lib/querylens/server/agentic-query"
import type { QueryLensExecutionContext } from "@/lib/querylens/server/ai-config"
import { getQueryEngineProvider } from "@/lib/querylens/server/query-engine-provider"
import { executeComparePlan } from "@/lib/querylens/server/executors/compare"
import { executeBreakdownPlan } from "@/lib/querylens/server/executors/breakdown"
import { executeDiscoveryPlan } from "@/lib/querylens/server/executors/discovery"
import {
  buildWhatChangedFallbackResponse,
  executeWhatChangedPlan,
} from "@/lib/querylens/server/executors/what-changed"
import { getQueryLensDataAccess } from "@/lib/querylens/server/repositories"
import { getQueryLensRetrievalStore } from "@/lib/querylens/server/retrieval"
import type {
  Phase1AnalysisResponse,
  QueryRequestBody,
  QueryIntent,
  RetrievalContext,
  StructuredQueryPlan,
} from "@/lib/querylens/types"

interface IntentExecutor {
  execute(args: {
    plan: StructuredQueryPlan
    weeklyRows: Awaited<ReturnType<Awaited<ReturnType<typeof getQueryLensDataAccess>>["listWeeklyMetrics"]>>
    dataAccess: Awaited<ReturnType<typeof getQueryLensDataAccess>>
    composeNarrative: ReturnType<typeof getQueryEngineProvider>["composeNarrative"]
    retrievalContext: RetrievalContext
  }): Promise<Phase1AnalysisResponse>
}

const executors: Partial<Record<QueryIntent, IntentExecutor>> = {
  compare: {
    execute: executeComparePlan,
  },
  breakdown: {
    execute: executeBreakdownPlan,
  },
  discovery: {
    execute: executeDiscoveryPlan,
  },
  what_changed: {
    execute: executeWhatChangedPlan,
  },
}

export async function analyzeQuery(
  input: QueryRequestBody,
  options: { executionContext?: QueryLensExecutionContext } = {}
): Promise<Phase1AnalysisResponse> {
  const executionContext = options.executionContext ?? "interactive"
  const dataAccess = await getQueryLensDataAccess()
  const weeklyRows = await dataAccess.listWeeklyMetrics()
  const retrievalStore = await getQueryLensRetrievalStore()
  const chatId =
    input.chatId?.trim() ||
    (executionContext === "bootstrap" ? "bootstrap" : "querylens-session")
  const retrievalContext =
    executionContext === "bootstrap"
      ? {
          datasetMatches: [],
          memoryMatches: [],
          recentMessages: [],
        }
      : await retrievalStore.retrieveContext({
          chatId,
          question: input.question,
        })
  const provider = getQueryEngineProvider({
    executionContext,
  })
  const parseResult = await provider.planQuery(
    input.question,
    input.scope,
    retrievalContext
  )

  if (!parseResult.parsed) {
    if (
      executionContext === "interactive" &&
      canUseGemini(executionContext) &&
      parseResult.failureKind !== "model_unavailable"
    ) {
      if (dataAccess.sourceMode !== "database") {
        return buildWhatChangedFallbackResponse({
          fallbackReason:
            "This custom live-query fallback needs QueryLens connected to live Postgres and MongoDB sources. In fixture mode, QueryLens can still answer the built-in discovery, what-changed, breakdown, and compare questions.",
          sourceMode: dataAccess.sourceMode,
          rows: weeklyRows,
        })
      }

      const agenticResponse = await executeAgenticFallback({
        question: input.question,
        dataAccess,
        retrievalContext,
      })

      const enrichedAgenticResponse = {
        ...agenticResponse,
        conversationContextUsed:
          retrievalContext.memoryMatches.length > 0 ||
          retrievalContext.recentMessages.length > 0,
        retrievalTrace: {
          datasetMatches: retrievalContext.datasetMatches.map((match) => match.title),
          memoryMatches: retrievalContext.memoryMatches.map((match) => match.title),
          recentMessagesCount: retrievalContext.recentMessages.length,
        },
      }

      if (input.chatId) {
        try {
          await retrievalStore.persistConversation({
            chatId,
            question: input.question,
            response: enrichedAgenticResponse,
          })
        } catch (error) {
          console.warn("QueryLens could not persist conversational memory.", error)
        }
      }

      return enrichedAgenticResponse
    }

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
    retrievalContext,
  })

  const enrichedResponse = {
    ...response,
    metric: response.metric ?? parseResult.parsed.metricId,
    conversationContextUsed:
      retrievalContext.memoryMatches.length > 0 ||
      retrievalContext.recentMessages.length > 0,
    retrievalTrace: {
      datasetMatches: retrievalContext.datasetMatches.map((match) => match.title),
      memoryMatches: retrievalContext.memoryMatches.map((match) => match.title),
      recentMessagesCount: retrievalContext.recentMessages.length,
    },
  }

  if (executionContext !== "bootstrap" && input.chatId) {
    try {
      await retrievalStore.persistConversation({
        chatId,
        question: input.question,
        response: enrichedResponse,
      })
    } catch (error) {
      console.warn("QueryLens could not persist conversational memory.", error)
    }
  }

  return enrichedResponse
}
