import { DEFAULT_FLAGSHIP_QUESTION } from "@/lib/querylens/server/query-engine-provider"
import { buildCashflowHistoryChartSpec, filterRowsForScope } from "@/lib/querylens/server/built-in-pipeline/common"
import { calculateConfidenceScore } from "@/lib/querylens/scoring"
import type { ExecutionTrace, Phase1AnalysisResponse, WeeklyMetricRow } from "@/lib/querylens/types"

export function buildBuiltInFallbackResponse(args: {
  fallbackReason: string
  sourceMode: Phase1AnalysisResponse["sourceMode"]
  rows: WeeklyMetricRow[]
  executionTrace?: ExecutionTrace
  isConversational?: boolean
}): Phase1AnalysisResponse {
  if (args.isConversational) {
    return {
      intent: "what_changed",
      headline: "Hi - I can help with your portfolio data",
      summary:
        "I can answer grounded questions about cashflow health, region or sector stress, comparisons, data coverage, and connected sources. Try one of the suggested prompts to start.",
      metric: "cashflow_health_score",
      timeframe: "Conversation",
      comparisonBasis: "Conversational guidance (no analytical query was run)",
      confidence: 0,
      activeScope: "Conversation",
      drivers: [],
      evidence: [],
      assumptions: [],
      supportedFollowUps: [
        DEFAULT_FLAGSHIP_QUESTION,
        "What data is currently stored?",
        "Which sources are connected right now?",
        "Compare cashflow health this week vs last week",
      ],
      fallback: true,
      executionTrace: args.executionTrace,
      sourceMode: args.sourceMode,
    }
  }

  return {
    intent: "what_changed",
    headline: "QueryLens could not complete that request safely",
    summary: args.fallbackReason,
    metric: "cashflow_health_score",
    timeframe: "Ask about this week or last week",
    comparisonBasis:
      "The current sample dataset supports grounded weekly analysis over adjacent windows",
    confidence: calculateConfidenceScore({
      evidenceCount: 0,
      driverCount: 0,
      hasCrossSourceEvidence: false,
      fallback: true,
    }),
    activeScope: "Portfolio",
    drivers: [],
    chartSpec: buildCashflowHistoryChartSpec(
      filterRowsForScope(args.rows, {}),
      "Portfolio",
    ),
    evidence: [],
    assumptions: [
      "QueryLens stays within the current sample dataset, supported metrics, and validated weekly windows.",
    ],
    supportedFollowUps: [
      DEFAULT_FLAGSHIP_QUESTION,
      "What makes up at-risk accounts by region and sector last week?",
      "Compare cashflow health this week vs last week",
      "Compare North West vs London & South East cashflow health last week",
    ],
    fallback: true,
    executionTrace: args.executionTrace,
    sourceMode: args.sourceMode,
  }
}
