import { canUseGemini } from "@/lib/querylens/server/ai-config"
import { executeAgenticFallback } from "@/lib/querylens/server/agentic-query"
import type { QueryLensExecutionContext } from "@/lib/querylens/server/ai-config"
import {
  formatDateCoverage,
  getRelativeDateWindow,
  isDateWindowWithinCoverage,
} from "@/lib/querylens/date-windows"
import { buildDefaultFollowUpActions } from "@/lib/querylens/follow-ups"
import { getQueryEngineProvider } from "@/lib/querylens/server/query-engine-provider"
import { executeComparePlan } from "@/lib/querylens/server/executors/compare"
import { executeBreakdownPlan } from "@/lib/querylens/server/executors/breakdown"
import { executeDiscoveryPlan } from "@/lib/querylens/server/executors/discovery"
import {
  buildWhatChangedFallbackResponse,
  executeWhatChangedPlan,
} from "@/lib/querylens/server/executors/what-changed"
import { planDeterministicQuery } from "@/lib/querylens/server/query-planner"
import {
  buildInterpretation,
  buildLeadershipSummaryResponse,
  buildTrustArtifacts,
} from "@/lib/querylens/server/response-enrichment"
import { getQueryLensDataAccess } from "@/lib/querylens/server/repositories"
import { getQueryLensRetrievalStore } from "@/lib/querylens/server/retrieval"
import type {
  Phase1AnalysisResponse,
  QueryRequestBody,
  QueryIntent,
  RetrievalContext,
  StructuredQueryPlan,
  WeeklyMetricRow,
} from "@/lib/querylens/types"

interface IntentExecutor {
  execute(args: {
    plan: StructuredQueryPlan
    weeklyRows: Awaited<
      ReturnType<
        Awaited<ReturnType<typeof getQueryLensDataAccess>>["listWeeklyMetrics"]
      >
    >
    dataAccess: Awaited<ReturnType<typeof getQueryLensDataAccess>>
    composeNarrative: ReturnType<
      typeof getQueryEngineProvider
    >["composeNarrative"]
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

function getPlanDateWindows(plan: StructuredQueryPlan) {
  const windows = [plan.dateWindow, plan.comparisonWindow.targetWindow]

  if (plan.comparisonWindow.comparisonDateWindow) {
    windows.push(plan.comparisonWindow.comparisonDateWindow)
  }

  if (plan.compareSpec?.leftWindow) {
    windows.push(plan.compareSpec.leftWindow)
  }

  if (plan.compareSpec?.rightWindow) {
    windows.push(plan.compareSpec.rightWindow)
  }

  if (plan.compareSpec?.selectedWindow) {
    windows.push(plan.compareSpec.selectedWindow)
  }

  return windows
}

function buildRetrievalTrace(retrievalContext: RetrievalContext) {
  return {
    datasetMatches: retrievalContext.datasetMatches.map((match) => match.title),
    memoryMatches: retrievalContext.memoryMatches.map((match) => match.title),
    recentMessagesCount: retrievalContext.recentMessages.length,
  }
}

function finalizeResponse(args: {
  response: Phase1AnalysisResponse
  retrievalContext: RetrievalContext
  inputQuestion: string
  interpretationMode: "direct" | "guided_reroute" | "fallback"
  interpretationExplanation: string
  resolvedQuestion?: string
}) {
  const response = {
    ...args.response,
    followUpActions:
      args.response.followUpActions && args.response.followUpActions.length > 0
        ? args.response.followUpActions
        : buildDefaultFollowUpActions(args.response.supportedFollowUps),
    interpretation:
      args.response.interpretation ??
      buildInterpretation({
        mode: args.interpretationMode,
        originalQuestion: args.inputQuestion,
        resolvedQuestion: args.resolvedQuestion,
        explanation: args.interpretationExplanation,
      }),
    trustArtifacts:
      args.response.trustArtifacts ?? buildTrustArtifacts(args.response),
    presentationMode: args.response.presentationMode ?? "default",
    conversationContextUsed:
      args.retrievalContext.memoryMatches.length > 0 ||
      args.retrievalContext.recentMessages.length > 0,
    retrievalTrace: buildRetrievalTrace(args.retrievalContext),
  }

  return response
}

function buildGuidedReroute(args: {
  question: string
  weeklyRows: WeeklyMetricRow[]
}) {
  const normalizedQuestion = args.question.toLowerCase()
  const timeframe =
    normalizedQuestion.includes("this week") ? "this_week" : "last_week"
  const targetWindow = getRelativeDateWindow(timeframe)

  if (
    /(worst|weakest|biggest drag).*(region)|region.*(worst|weakest|biggest drag)/.test(
      normalizedQuestion,
    )
  ) {
    const weakestRegion = args.weeklyRows
      .filter(
        (row) =>
          row.recordType === "region" && row.weekStart === targetWindow.startDate,
      )
      .sort((left, right) => left.cashflowHealthScore - right.cashflowHealthScore)[0]

    if (weakestRegion?.regionName) {
      return {
        resolvedQuestion: `Why did ${weakestRegion.regionName} cashflow health drop ${timeframe === "this_week" ? "this week" : "last week"}?`,
        explanation:
          "QueryLens interpreted your request as a what-changed investigation for the weakest validated region in the requested weekly window.",
      }
    }
  }

  if (
    /(worst|weakest|biggest drag).*(sector)|sector.*(worst|weakest|biggest drag)/.test(
      normalizedQuestion,
    )
  ) {
    const weakestSector = args.weeklyRows
      .filter(
        (row) =>
          row.recordType === "sector" && row.weekStart === targetWindow.startDate,
      )
      .sort((left, right) => left.cashflowHealthScore - right.cashflowHealthScore)[0]

    if (weakestSector?.sectorName) {
      return {
        resolvedQuestion: `Why did ${weakestSector.sectorName} cashflow health drop ${timeframe === "this_week" ? "this week" : "last week"}?`,
        explanation:
          "QueryLens interpreted your request as a what-changed investigation for the weakest validated sector in the requested weekly window.",
      }
    }
  }

  return undefined
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
    const leadershipSummary = finalizeResponse({
      response: buildLeadershipSummaryResponse({
        question: input.question,
        sourceAnalysis: input.followUpContext.sourceAnalysis,
      }),
      retrievalContext,
      inputQuestion: input.question,
      interpretationMode: "direct",
      interpretationExplanation:
        "QueryLens turned the current grounded analysis into a short leadership-ready summary without rerunning the underlying analytics.",
    })

    if (executionContext !== "bootstrap" && input.chatId) {
      try {
        await retrievalStore.persistConversation({
          chatId,
          question: input.question,
          response: leadershipSummary,
        })
      } catch (error) {
        console.warn("QueryLens could not persist conversational memory.", error)
      }
    }

    return leadershipSummary
  }

  const provider = getQueryEngineProvider({
    executionContext,
  })
  const parseResult = await provider.planQuery(
    input.question,
    input.scope,
    retrievalContext,
  )
  let interpretationMode: "direct" | "guided_reroute" | "fallback" = "direct"
  let interpretationExplanation =
    "QueryLens matched your request directly to a supported analytics flow."
  let resolvedQuestionForInterpretation: string | undefined

  const deterministicParseResult =
    !parseResult.parsed &&
    executionContext === "interactive" &&
    canUseGemini(executionContext) &&
    parseResult.failureKind !== "model_unavailable"
      ? planDeterministicQuery(input.question, input.scope)
      : undefined

  let resolvedParseResult = deterministicParseResult?.parsed
    ? deterministicParseResult
    : parseResult

  if (!resolvedParseResult.parsed) {
    const guidedReroute = buildGuidedReroute({
      question: input.question,
      weeklyRows,
    })

    if (guidedReroute) {
      const reroutedParseResult = planDeterministicQuery(
        guidedReroute.resolvedQuestion,
        input.scope,
      )

      if (reroutedParseResult.plan) {
        resolvedParseResult = {
          plan: reroutedParseResult.plan,
          parsed: reroutedParseResult.plan,
        }
        interpretationMode = "guided_reroute"
        interpretationExplanation = guidedReroute.explanation
        resolvedQuestionForInterpretation = guidedReroute.resolvedQuestion
      }
    }
  }

  if (!resolvedParseResult.parsed) {
    if (
      executionContext === "interactive" &&
      canUseGemini(executionContext) &&
      resolvedParseResult.failureKind !== "model_unavailable"
    ) {
      if (dataAccess.sourceMode !== "database") {
        return finalizeResponse({
          response: buildWhatChangedFallbackResponse({
            fallbackReason:
              "This custom live-query fallback needs QueryLens connected to live Postgres and MongoDB sources. In fixture mode, QueryLens can still answer the built-in discovery, what-changed, breakdown, and compare questions.",
            sourceMode: dataAccess.sourceMode,
            rows: weeklyRows,
          }),
          retrievalContext,
          inputQuestion: input.question,
          interpretationMode: "fallback",
          interpretationExplanation:
            "QueryLens could not safely map that request into a built-in flow and did not have live databases available for the guarded custom-query path.",
        })
      }

      const agenticResponse = await executeAgenticFallback({
        question: input.question,
        dataAccess,
        retrievalContext,
      })

      const enrichedAgenticResponse = {
        ...finalizeResponse({
          response: agenticResponse,
          retrievalContext,
          inputQuestion: input.question,
          interpretationMode: "fallback",
          interpretationExplanation:
            "QueryLens could not match the question to a built-in validated slice, so it used the guarded read-only custom-query path.",
        }),
      }

      if (input.chatId) {
        try {
          await retrievalStore.persistConversation({
            chatId,
            question: input.question,
            response: enrichedAgenticResponse,
          })
        } catch (error) {
          console.warn(
            "QueryLens could not persist conversational memory.",
            error,
          )
        }
      }

      return enrichedAgenticResponse
    }

    return finalizeResponse({
      response: buildWhatChangedFallbackResponse({
        fallbackReason:
          resolvedParseResult.fallbackReason ??
          "The question could not be matched to the phase-1 vertical slice safely.",
        sourceMode: dataAccess.sourceMode,
        rows: weeklyRows,
      }),
      retrievalContext,
      inputQuestion: input.question,
      interpretationMode: "fallback",
      interpretationExplanation:
        "QueryLens could not safely translate that request into one of the currently supported built-in analytics flows.",
    })
  }

  const outOfCoverageWindow = getPlanDateWindows(
    resolvedParseResult.parsed,
  ).find((window) => !isDateWindowWithinCoverage(window, dateCoverage))

  if (outOfCoverageWindow) {
    return finalizeResponse({
      response: buildWhatChangedFallbackResponse({
        fallbackReason: `That request falls outside the dataset coverage window of ${formatDateCoverage(dateCoverage)}.`,
        sourceMode: dataAccess.sourceMode,
        rows: weeklyRows,
      }),
      retrievalContext,
      inputQuestion: input.question,
      interpretationMode: "fallback",
      interpretationExplanation:
        "QueryLens kept the request inside the validated dataset coverage window and declined to answer outside that range.",
    })
  }

  const executor = executors[resolvedParseResult.parsed.intent]

  if (!executor) {
    return finalizeResponse({
      response: buildWhatChangedFallbackResponse({
        fallbackReason:
          "That query intent is not registered yet for the current dataset.",
        sourceMode: dataAccess.sourceMode,
        rows: weeklyRows,
      }),
      retrievalContext,
      inputQuestion: input.question,
      interpretationMode: "fallback",
      interpretationExplanation:
        "QueryLens recognized the request shape but the dataset does not currently ship that built-in flow.",
    })
  }

  const response = await executor.execute({
    plan: resolvedParseResult.parsed,
    weeklyRows,
    dataAccess,
    composeNarrative: provider.composeNarrative,
    retrievalContext,
  })

  const enrichedResponse = finalizeResponse({
    response: {
    ...response,
    metric: response.metric ?? resolvedParseResult.parsed.metricId,
    },
    retrievalContext,
    inputQuestion: input.question,
    interpretationMode,
    interpretationExplanation,
    resolvedQuestion: resolvedQuestionForInterpretation,
  })

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
