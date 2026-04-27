import { buildDefaultFollowUpActions, buildBreakdownFollowUpActions, buildBreakdownFollowUps, buildCompareFollowUpActions, buildCompareFollowUps, buildWhatChangedFollowUpActions, buildWhatChangedFollowUps } from "@/lib/querylens/follow-ups"
import { buildBuiltInFallbackResponse } from "@/lib/querylens/server/built-in-pipeline/fallbacks"
import { getQueryEngineProvider } from "@/lib/querylens/server/query-engine-provider"
import {
  buildInterpretation,
  buildTrustArtifacts,
} from "@/lib/querylens/server/response-enrichment"
import type { QueryLensExecutionContext } from "@/lib/querylens/server/ai-config"
import type {
  BreakdownExecutionPayload,
  BuiltInExecutionPayload,
  BuiltInInterpretationSeed,
  BuiltInPresentationResult,
  CompareExecutionPayload,
  DiscoveryExecutionPayload,
  WhatChangedExecutionPayload,
} from "@/lib/querylens/server/built-in-pipeline/types"
import type { ExecutionTrace, RetrievalContext } from "@/lib/querylens/types"

function buildRetrievalTrace(retrievalContext: RetrievalContext) {
  return {
    datasetMatches: retrievalContext.datasetMatches.map((match) => match.title),
    memoryMatches: retrievalContext.memoryMatches.map((match) => match.title),
    recentMessagesCount: retrievalContext.recentMessages.length,
  }
}

export function enrichPhase1Response(args: {
  response: BuiltInPresentationResult
  retrievalContext: RetrievalContext
  inputQuestion: string
  interpretation: BuiltInInterpretationSeed
}) {
  return {
    ...args.response,
    followUpActions:
      args.response.followUpActions && args.response.followUpActions.length > 0
        ? args.response.followUpActions
        : buildDefaultFollowUpActions(args.response.supportedFollowUps),
    interpretation:
      args.response.interpretation ??
      buildInterpretation({
        mode: args.interpretation.mode,
        originalQuestion: args.inputQuestion,
        resolvedQuestion: args.interpretation.resolvedQuestion,
        explanation: args.interpretation.explanation,
      }),
    trustArtifacts:
      args.response.trustArtifacts ?? buildTrustArtifacts(args.response),
    presentationMode: args.response.presentationMode ?? "default",
    conversationContextUsed:
      args.retrievalContext.memoryMatches.length > 0 ||
      args.retrievalContext.recentMessages.length > 0,
    retrievalTrace: buildRetrievalTrace(args.retrievalContext),
  }
}

function presentWhatChanged(args: {
  execution: WhatChangedExecutionPayload
  executionContext: QueryLensExecutionContext
}) {
  const allowedFollowUps = buildWhatChangedFollowUps({
    targetWindow: args.execution.presentation.targetWindow,
    comparisonWindow: args.execution.presentation.comparisonWindow,
  })

  return getQueryEngineProvider({
    executionContext: args.executionContext,
  }).composeNarrative({
    parsed: args.execution.plan,
    activeScopeLabel: args.execution.activeScope,
    currentScore: args.execution.presentation.currentScore,
    previousScore: args.execution.presentation.previousScore,
    drivers: args.execution.drivers,
    contextEvents: args.execution.presentation.contextEvents,
    allowedFollowUps,
  })
}

function buildCompareHeadlineAndSummary(execution: CompareExecutionPayload) {
  const compareSpec = execution.plan.compareSpec

  if (!compareSpec) {
    return {
      headline: "QueryLens could not complete that request safely",
      summary:
        "The compare request could not be resolved into a supported side-by-side view.",
    }
  }

  if (execution.comparisonSummary.tie) {
    return {
      headline: `${compareSpec.leftLabel} and ${compareSpec.rightLabel} are effectively level`,
      summary: `${compareSpec.leftLabel} and ${compareSpec.rightLabel} both scored ${execution.comparisonSummary.leftValue.toFixed(1)} in the selected compare view, so the main differences come from component mix rather than the headline score. QueryLens therefore focuses the explanation on which grounded components still separate the two sides even though the headline metric is level.`,
    }
  }

  return {
    headline: `${execution.comparisonSummary.winnerLabel} leads the cashflow comparison`,
    summary: `${execution.comparisonSummary.winnerLabel} leads by ${execution.comparisonSummary.delta.toFixed(1)} points in the selected compare view. QueryLens highlights where payment coverage, balance resilience, and stress indicators create the clearest separation. The comparison stays anchored to the validated windows and scopes defined in this side-by-side view.`,
  }
}

function buildBreakdownHeadlineAndSummary(execution: BreakdownExecutionPayload) {
  if (execution.presentation.topBucketLabel) {
    return {
      headline: `${execution.presentation.topBucketLabel} leads the at-risk account mix`,
      summary: `${execution.presentation.totalAtRisk} of ${execution.presentation.totalAccounts} accounts were flagged at risk in ${execution.activeScope.toLowerCase()} for ${execution.presentation.targetWindow.label}. ${execution.presentation.topBucketLabel} accounted for the highest concentration of low-balance and overdue stress. The breakdown ranks the selected ${execution.presentation.dimension.replace("_", " ")} buckets by observed account stress so the largest pressure pocket appears first.`,
    }
  }

  return {
    headline: "No concentrated at-risk pocket was found in the selected range",
    summary: `No accounts met the at-risk threshold in ${execution.activeScope.toLowerCase()} for ${execution.presentation.targetWindow.label}. QueryLens still checked the selected ${execution.presentation.dimension.replace("_", " ")} view against the grounded low-balance and overdue rules for that window.`,
  }
}

function buildDiscoverySummary(execution: DiscoveryExecutionPayload) {
  return `QueryLens currently has ${execution.presentation.metricCount} analytical metrics across ${execution.presentation.supportedIntentCount} intent families for the ${execution.presentation.datasetLabel} dataset. The active source stack includes ${execution.presentation.sourceHealth.map((source) => source.name).join(", ")}, with weekly coverage from ${execution.presentation.coverageLabel}. That means discovery answers can stay grounded in explicit source coverage, retrieved catalog metadata, and the current sample-dataset boundaries before analytical planning begins.`
}

export async function presentBuiltInExecution(args: {
  execution: BuiltInExecutionPayload
  retrievalContext: RetrievalContext
  inputQuestion: string
  interpretation: BuiltInInterpretationSeed
  executionContext: QueryLensExecutionContext
}): Promise<BuiltInPresentationResult> {
  switch (args.execution.intent) {
    case "what_changed": {
      const narrative = await presentWhatChanged({
        execution: args.execution,
        executionContext: args.executionContext,
      })

      return enrichPhase1Response({
        response: {
          intent: "what_changed",
          headline: narrative.headline,
          summary: narrative.summary,
          metric: args.execution.metric,
          timeframe: args.execution.timeframe,
          comparisonBasis: args.execution.comparisonBasis,
          confidence: args.execution.confidence,
          activeScope: args.execution.activeScope,
          drivers: args.execution.drivers,
          chartSpec: args.execution.chartSpec,
          evidence: args.execution.evidence,
          assumptions: args.execution.assumptions,
          supportedFollowUps: narrative.supportedFollowUps,
          followUpActions: buildWhatChangedFollowUpActions({
            targetWindow: args.execution.presentation.targetWindow,
            scope: args.execution.plan.scope,
            weakestRegionLabel: args.execution.presentation.weakestRegionLabel,
            weakestSectorLabel: args.execution.presentation.weakestSectorLabel,
            healthyPeerLabel: args.execution.presentation.healthyPeerLabel,
          }),
          executionTrace: args.execution.executionTrace,
          sourceMode: args.execution.sourceMode,
        },
        retrievalContext: args.retrievalContext,
        inputQuestion: args.inputQuestion,
        interpretation: args.interpretation,
      })
    }
    case "compare": {
      const { headline, summary } = buildCompareHeadlineAndSummary(args.execution)

      return enrichPhase1Response({
        response: {
          intent: "compare",
          headline,
          summary,
          metric: args.execution.metric,
          timeframe: args.execution.timeframe,
          comparisonBasis: args.execution.comparisonBasis,
          confidence: args.execution.confidence,
          activeScope: args.execution.activeScope,
          drivers: args.execution.drivers,
          chartSpec: args.execution.chartSpec,
          evidence: args.execution.evidence,
          assumptions: args.execution.assumptions,
          supportedFollowUps: buildCompareFollowUps({
            targetWindow: args.execution.presentation.targetWindow,
            comparisonWindow: args.execution.presentation.comparisonWindow,
          }),
          followUpActions: buildCompareFollowUpActions({
            targetWindow: args.execution.presentation.targetWindow,
            weakerLabel: args.execution.presentation.weakerLabel,
            compareDimension: args.execution.presentation.compareDimension,
          }),
          comparisonSummary: args.execution.comparisonSummary,
          executionTrace: args.execution.executionTrace,
          sourceMode: args.execution.sourceMode,
        },
        retrievalContext: args.retrievalContext,
        inputQuestion: args.inputQuestion,
        interpretation: args.interpretation,
      })
    }
    case "breakdown": {
      const { headline, summary } = buildBreakdownHeadlineAndSummary(args.execution)

      return enrichPhase1Response({
        response: {
          intent: "breakdown",
          headline,
          summary,
          metric: args.execution.metric,
          timeframe: args.execution.timeframe,
          comparisonBasis: args.execution.comparisonBasis,
          confidence: args.execution.confidence,
          activeScope: args.execution.activeScope,
          drivers: args.execution.drivers,
          chartSpec: args.execution.chartSpec,
          evidence: args.execution.evidence,
          assumptions: args.execution.assumptions,
          supportedFollowUps: buildBreakdownFollowUps({
            targetWindow: args.execution.presentation.targetWindow,
          }),
          followUpActions: buildBreakdownFollowUpActions({
            targetWindow: args.execution.presentation.targetWindow,
            dimension: args.execution.presentation.dimension,
            topBucketLabel: args.execution.presentation.topBucketLabel,
            healthyPeerLabel: args.execution.presentation.healthyPeerLabel,
            topBucketRegionLabel: args.execution.presentation.topBucketRegionLabel,
            topBucketSectorLabel: args.execution.presentation.topBucketSectorLabel,
          }),
          executionTrace: args.execution.executionTrace,
          sourceMode: args.execution.sourceMode,
        },
        retrievalContext: args.retrievalContext,
        inputQuestion: args.inputQuestion,
        interpretation: args.interpretation,
      })
    }
    case "discovery":
    default:
      return enrichPhase1Response({
        response: {
          intent: "discovery",
          headline: `QueryLens is currently grounded on the ${args.execution.presentation.datasetLabel} dataset`,
          summary: buildDiscoverySummary(args.execution),
          metric: args.execution.metric,
          timeframe: args.execution.timeframe,
          comparisonBasis: args.execution.comparisonBasis,
          confidence: args.execution.confidence,
          activeScope: args.execution.activeScope,
          drivers: args.execution.drivers,
          chartSpec: args.execution.chartSpec,
          evidence: args.execution.evidence,
          assumptions: args.execution.assumptions,
          supportedFollowUps: [
            "What metrics are available?",
            "Which sources are connected?",
            "Why did SME cashflow health drop last week?",
            "Compare cashflow health this week vs last week",
          ],
          discoverySummary: args.execution.discoverySummary,
          catalogSections: args.execution.catalogSections,
          executionTrace: args.execution.executionTrace,
          sourceMode: args.execution.sourceMode,
        },
        retrievalContext: args.retrievalContext,
        inputQuestion: args.inputQuestion,
        interpretation: args.interpretation,
      })
  }
}

export function presentBuiltInFallback(args: {
  fallbackReason: string
  sourceMode: BuiltInPresentationResult["sourceMode"]
  weeklyRows: Parameters<typeof buildBuiltInFallbackResponse>[0]["rows"]
  retrievalContext: RetrievalContext
  inputQuestion: string
  interpretation: BuiltInInterpretationSeed
  executionTrace?: ExecutionTrace
}) {
  return enrichPhase1Response({
    response: buildBuiltInFallbackResponse({
      fallbackReason: args.fallbackReason,
      sourceMode: args.sourceMode,
      rows: args.weeklyRows,
      executionTrace: args.executionTrace,
    }),
    retrievalContext: args.retrievalContext,
    inputQuestion: args.inputQuestion,
    interpretation: args.interpretation,
  })
}
