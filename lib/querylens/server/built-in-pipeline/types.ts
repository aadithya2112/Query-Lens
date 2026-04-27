import type {
  BreakdownDimension,
  CatalogSection,
  ChartSpec,
  CompareDimension,
  ComparisonSummary,
  ContextEvent,
  DateWindow,
  DiscoverySummary,
  DriverItem,
  EvidenceItem,
  ExecutionTrace,
  InterpretationMode,
  MetricId,
  Phase1AnalysisResponse,
  QueryPlanFailureKind,
  ScopeFilter,
  SourceHealth,
  StructuredQueryPlan,
} from "@/lib/querylens/types"

export type BuiltInIntent = "what_changed" | "breakdown" | "compare" | "discovery"
export type BuiltInPresentationResult = Phase1AnalysisResponse

export type BuiltInExecutionCapability =
  | "profile_dataset"
  | "aggregate_metric"
  | "compare_slices"
  | "explain_change"
  | "retrieve_context"

export type BuiltInAllowedSource = "postgres" | "mongodb" | "manifest"

export type BuiltInAllowedOperation =
  | "read_only_aggregate"
  | "read_only_lookup"
  | "catalog_profile_read"
  | "contextual_retrieval"

export type BuiltInValidationCheck =
  | "dataset_support"
  | "metric_support"
  | "intent_support"
  | "timeframe_support"
  | "source_permission"
  | "coverage"
  | "intent_metadata"

export interface BuiltInExecutionPlanValidationResult {
  check: BuiltInValidationCheck
  status: "passed" | "failed"
  message: string
}

export interface BuiltInExecutionPlan {
  planId: string
  datasetId: StructuredQueryPlan["datasetId"]
  intent: BuiltInIntent
  rawQuestion: string
  structuredPlan: StructuredQueryPlan
  semanticTargets: {
    metricId: MetricId
    scope: ScopeFilter
    scopeDimensions: StructuredQueryPlan["scopeDimensions"]
    dateWindow: DateWindow
    comparisonWindow: StructuredQueryPlan["comparisonWindow"]
    breakdownDimension?: BreakdownDimension
    compareSpec?: StructuredQueryPlan["compareSpec"]
    discoveryFocus?: StructuredQueryPlan["discoveryFocus"]
  }
  selectedCapabilities: BuiltInExecutionCapability[]
  allowedSources: BuiltInAllowedSource[]
  allowedOperations: BuiltInAllowedOperation[]
  validation: {
    status: "approved" | "rejected"
    results: BuiltInExecutionPlanValidationResult[]
    fallbackReason?: string
  }
  fallbackPolicy: {
    builtInFallback: boolean
    allowAgenticFallback: boolean
  }
  trace: ExecutionTrace
}

export interface BuiltInInterpretationSeed {
  mode: InterpretationMode
  explanation: string
  resolvedQuestion?: string
}

export interface BuiltInPlanningSuccess {
  kind: "success"
  plan: StructuredQueryPlan
  executionPlan: BuiltInExecutionPlan
  interpretation: BuiltInInterpretationSeed
}

export interface BuiltInPlanningFailure {
  kind: "failure"
  fallbackReason?: string
  failureKind?: QueryPlanFailureKind
  interpretation: BuiltInInterpretationSeed
  allowAgenticFallback: boolean
}

export type BuiltInPlanningResult =
  | BuiltInPlanningSuccess
  | BuiltInPlanningFailure

export interface BuiltInExecutionFailure {
  kind: "failure"
  fallbackReason: string
  interpretation?: BuiltInInterpretationSeed
  executionTrace?: ExecutionTrace
}

interface BuiltInExecutionSuccessBase {
  kind: "success"
  intent: BuiltInIntent
  plan: StructuredQueryPlan
  metric: MetricId
  timeframe: string
  comparisonBasis: string
  confidence: number
  activeScope: string
  drivers: DriverItem[]
  chartSpec?: ChartSpec
  evidence: EvidenceItem[]
  assumptions: string[]
  sourceMode: Phase1AnalysisResponse["sourceMode"]
  executionTrace?: ExecutionTrace
}

export interface WhatChangedExecutionPayload
  extends BuiltInExecutionSuccessBase {
  intent: "what_changed"
  metric: "cashflow_health_score"
  presentation: {
    currentScore: number
    previousScore: number
    contextEvents: ContextEvent[]
    targetWindow: DateWindow
    comparisonWindow: DateWindow
    weakestRegionLabel?: string
    weakestSectorLabel?: string
    healthyPeerLabel?: string
  }
}

export interface CompareExecutionPayload extends BuiltInExecutionSuccessBase {
  intent: "compare"
  metric: "cashflow_health_score"
  comparisonSummary: ComparisonSummary
  presentation: {
    targetWindow: DateWindow
    comparisonWindow?: DateWindow
    weakerLabel: string
    compareDimension?: CompareDimension
  }
}

export interface BreakdownExecutionPayload
  extends BuiltInExecutionSuccessBase {
  intent: "breakdown"
  metric: "at_risk_account_count"
  presentation: {
    targetWindow: DateWindow
    dimension: BreakdownDimension
    totalAtRisk: number
    totalAccounts: number
    topBucketLabel?: string
    healthyPeerLabel?: string
    topBucketRegionLabel?: string
    topBucketSectorLabel?: string
  }
}

export interface DiscoveryExecutionPayload extends BuiltInExecutionSuccessBase {
  intent: "discovery"
  metric: "dataset_catalog"
  discoverySummary: DiscoverySummary
  catalogSections: CatalogSection[]
  presentation: {
    datasetLabel: string
    metricCount: number
    supportedIntentCount: number
    sourceHealth: SourceHealth[]
    coverageLabel: string
  }
}

export type BuiltInExecutionPayload =
  | WhatChangedExecutionPayload
  | CompareExecutionPayload
  | BreakdownExecutionPayload
  | DiscoveryExecutionPayload

export type BuiltInExecutionResult =
  | BuiltInExecutionFailure
  | BuiltInExecutionPayload

export interface BuiltInNarrativeInput {
  parsed: StructuredQueryPlan
  activeScopeLabel: string
  currentScore: number
  previousScore: number
  drivers: DriverItem[]
  contextEvents: ContextEvent[]
  allowedFollowUps: string[]
}

export type BuiltInNarrativeComposer = (
  input: BuiltInNarrativeInput,
) => Promise<
  Pick<Phase1AnalysisResponse, "headline" | "summary" | "supportedFollowUps">
>

export type BuiltInPipelineResult =
  | {
      kind: "response"
      response: BuiltInPresentationResult
    }
  | {
      kind: "needs_agentic"
      fallbackReason?: string
    }
