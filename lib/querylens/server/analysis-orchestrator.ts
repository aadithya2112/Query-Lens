import { canUseGemini } from "@/lib/querylens/server/ai-config"
import type { QueryLensExecutionContext } from "@/lib/querylens/server/ai-config"
import { executeAgenticFallback } from "@/lib/querylens/server/agentic-query"
import { runBuiltInAnalysisPipeline } from "@/lib/querylens/server/built-in-pipeline"
import { presentBuiltInFallback, enrichPhase1Response } from "@/lib/querylens/server/built-in-pipeline/presentation"
import { buildLeadershipSummaryResponse } from "@/lib/querylens/server/response-enrichment"
import { getQueryLensDataAccess } from "@/lib/querylens/server/repositories"
import { getQueryLensRetrievalStore } from "@/lib/querylens/server/retrieval"
import type {
  Phase1AnalysisResponse,
  QueryRequestBody,
} from "@/lib/querylens/types"

async function persistConversationIfPossible(args: {
  chatId?: string
  executionContext: QueryLensExecutionContext
  question: string
  response: Phase1AnalysisResponse
  retrievalStore: Awaited<ReturnType<typeof getQueryLensRetrievalStore>>
}) {
  if (args.executionContext === "bootstrap" || !args.chatId) {
    return
  }

  try {
    await args.retrievalStore.persistConversation({
      chatId: args.chatId,
      question: args.question,
      response: args.response,
    })
  } catch (error) {
    console.warn("QueryLens could not persist conversational memory.", error)
  }
}

export async function analyzeQuery(
  input: QueryRequestBody,
  options: { executionContext?: QueryLensExecutionContext } = {},
): Promise<Phase1AnalysisResponse> {
  const executionContext = options.executionContext ?? "interactive"
  const dataAccess = await getQueryLensDataAccess()
  const weeklyRows = await dataAccess.listWeeklyMetrics()
  const dateCoverage = await dataAccess.getDateCoverage()
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

  if (input.action === "leadership_summary" && input.followUpContext?.sourceAnalysis) {
    const leadershipSummary = enrichPhase1Response({
      response: buildLeadershipSummaryResponse({
        question: input.question,
        sourceAnalysis: input.followUpContext.sourceAnalysis,
      }),
      retrievalContext,
      inputQuestion: input.question,
      interpretation: {
        mode: "direct",
        explanation:
          "QueryLens turned the current grounded analysis into a short leadership-ready summary without rerunning the underlying analytics.",
      },
    })

    await persistConversationIfPossible({
      chatId: input.chatId,
      executionContext,
      question: input.question,
      response: leadershipSummary,
      retrievalStore,
    })

    return leadershipSummary
  }

  const builtInResult = await runBuiltInAnalysisPipeline({
    input,
    executionContext,
    dataAccess,
    weeklyRows,
    dateCoverage,
    retrievalContext,
  })

  if (builtInResult.kind === "response") {
    await persistConversationIfPossible({
      chatId: input.chatId,
      executionContext,
      question: input.question,
      response: builtInResult.response,
      retrievalStore,
    })

    return builtInResult.response
  }

  if (
    executionContext === "interactive" &&
    canUseGemini(executionContext)
  ) {
    if (dataAccess.sourceMode !== "database") {
      return presentBuiltInFallback({
        fallbackReason:
          "This custom live-query fallback needs QueryLens connected to live Postgres and MongoDB sources. In fixture mode, QueryLens can still answer the built-in discovery, what-changed, breakdown, and compare questions.",
        sourceMode: dataAccess.sourceMode,
        weeklyRows,
        retrievalContext,
        inputQuestion: input.question,
        interpretation: {
          mode: "fallback",
          explanation:
            "QueryLens could not safely map that request into a built-in flow and did not have live databases available for the guarded custom-query path.",
        },
      })
    }

    const agenticResponse = await executeAgenticFallback({
      question: input.question,
      dataAccess,
      retrievalContext,
    })

    const enrichedAgenticResponse = enrichPhase1Response({
      response: agenticResponse,
      retrievalContext,
      inputQuestion: input.question,
      interpretation: {
        mode: "fallback",
        explanation:
          "QueryLens could not match the question to a built-in validated slice, so it used the guarded read-only custom-query path.",
      },
    })

    await persistConversationIfPossible({
      chatId: input.chatId,
      executionContext,
      question: input.question,
      response: enrichedAgenticResponse,
      retrievalStore,
    })

    return enrichedAgenticResponse
  }

  return presentBuiltInFallback({
    fallbackReason:
      builtInResult.fallbackReason ??
      "The question could not be matched to the phase-1 vertical slice safely.",
    sourceMode: dataAccess.sourceMode,
    weeklyRows,
    retrievalContext,
    inputQuestion: input.question,
    interpretation: {
      mode: "fallback",
      explanation:
        "QueryLens could not safely translate that request into one of the currently supported built-in analytics flows.",
    },
  })
}
