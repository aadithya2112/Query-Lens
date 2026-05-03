import { canUseReasoningProvider } from "@/lib/querylens/server/ai-config"
import { isBuiltInDatasetId } from "@/lib/querylens/datasets"
import type { QueryLensExecutionContext } from "@/lib/querylens/server/ai-config"
import { executeAgenticFallback } from "@/lib/querylens/server/agentic-query"
import { buildAgenticSourceCatalog } from "@/lib/querylens/server/agentic-source-catalog"
import { answerBroadQuestion } from "@/lib/querylens/server/broad-query-responses"
import { runBuiltInAnalysisPipeline } from "@/lib/querylens/server/built-in-pipeline"
import { isConversationalSmallTalk } from "@/lib/querylens/server/conversational-detection"
import { getQueryLensDatasetRuntime } from "@/lib/querylens/server/dataset-runtime"
import { analyzeOnboardedDatasetQuery } from "@/lib/querylens/server/onboarded-analysis"
import { presentBuiltInFallback, enrichPhase1Response } from "@/lib/querylens/server/built-in-pipeline/presentation"
import { buildLeadershipSummaryResponse } from "@/lib/querylens/server/response-enrichment"
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
  if (!isBuiltInDatasetId(input.datasetId)) {
    const onboardedResponse = await analyzeOnboardedDatasetQuery({
      input,
      executionContext,
    })

    if (onboardedResponse) {
      return onboardedResponse
    }
  }

  const { dataAccess, profileStore } = await getQueryLensDatasetRuntime()
  const profileSnapshot = await profileStore.getProfileSnapshot()
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

  if (isConversationalSmallTalk(input.question)) {
    const conversationalResponse = presentBuiltInFallback({
      fallbackReason:
        "Your message looked conversational rather than analytical. Ask a portfolio question and I can ground the response in live evidence.",
      sourceMode: dataAccess.sourceMode,
      weeklyRows,
      retrievalContext,
      inputQuestion: input.question,
      interpretation: {
        mode: "fallback",
        explanation:
          "QueryLens detected a greeting or small-talk message and returned conversational guidance instead of running bounded analytics.",
      },
      isConversational: true,
    })

    await persistConversationIfPossible({
      chatId: input.chatId,
      executionContext,
      question: input.question,
      response: conversationalResponse,
      retrievalStore,
    })

    return conversationalResponse
  }

  const broadResponse = await answerBroadQuestion({
    input,
    profileSnapshot,
    weeklyRows,
  })

  if (broadResponse) {
    const enrichedBroadResponse = enrichPhase1Response({
      response: broadResponse,
      retrievalContext,
      inputQuestion: input.question,
      interpretation: {
        mode: "direct",
        explanation:
          "QueryLens matched this broad request to a deterministic data-preview, source-catalog, or visual-overview flow before using the bounded custom agent.",
      },
    })

    await persistConversationIfPossible({
      chatId: input.chatId,
      executionContext,
      question: input.question,
      response: enrichedBroadResponse,
      retrievalStore,
    })

    return enrichedBroadResponse
  }

  const builtInResult = await runBuiltInAnalysisPipeline({
    input,
    executionContext,
    dataAccess,
    profileSnapshot,
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
    canUseReasoningProvider(executionContext)
  ) {
    const sourceCatalog = await buildAgenticSourceCatalog({
      profileSnapshot,
    })
    const activeDatasetId = input.datasetId ?? profileSnapshot.datasetId
    const agenticResponse = await executeAgenticFallback({
      question: input.question,
      dataAccess,
      sourceCatalog,
      retrievalContext,
      activeDatasetId,
      activeDatasetLabel: profileSnapshot.datasetLabel ?? activeDatasetId,
      fallbackReason:
        builtInResult.fallbackReason ??
        "The deterministic route declined the question and handed it to the bounded multi-source agent.",
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
