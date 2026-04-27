import {
  formatDateCoverage,
  isDateWindowWithinCoverage,
} from "@/lib/querylens/date-windows"
import { getDatasetDefinition } from "@/lib/querylens/datasets"
import type { ExecutionTrace, ExecutionTraceEntry, StructuredQueryPlan } from "@/lib/querylens/types"
import type {
  BuiltInAllowedOperation,
  BuiltInAllowedSource,
  BuiltInExecutionCapability,
  BuiltInExecutionPlan,
  BuiltInExecutionPlanValidationResult,
  BuiltInIntent,
} from "@/lib/querylens/server/built-in-pipeline/types"

interface DateCoverage {
  startDate: string
  endDate: string
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

function buildPlanId(plan: StructuredQueryPlan) {
  return [
    plan.datasetId,
    plan.intent,
    plan.metricId,
    plan.dateWindow.startDate,
    plan.dateWindow.endDate,
    plan.scope.region ?? "portfolio",
    plan.scope.sector ?? "all",
  ].join(":")
}

function getCapabilities(intent: BuiltInIntent): BuiltInExecutionCapability[] {
  switch (intent) {
    case "what_changed":
      return ["aggregate_metric", "explain_change", "retrieve_context"]
    case "compare":
      return ["aggregate_metric", "compare_slices", "explain_change", "retrieve_context"]
    case "breakdown":
      return ["aggregate_metric", "retrieve_context"]
    case "discovery":
      return ["profile_dataset", "retrieve_context"]
  }
}

function getAllowedSources(intent: BuiltInIntent): BuiltInAllowedSource[] {
  switch (intent) {
    case "what_changed":
      return ["postgres", "mongodb"]
    case "compare":
    case "breakdown":
      return ["postgres", "mongodb"]
    case "discovery":
      return ["manifest", "postgres", "mongodb"]
  }
}

function getAllowedOperations(intent: BuiltInIntent): BuiltInAllowedOperation[] {
  switch (intent) {
    case "what_changed":
      return ["read_only_aggregate", "read_only_lookup", "contextual_retrieval"]
    case "compare":
    case "breakdown":
      return ["read_only_aggregate", "read_only_lookup", "contextual_retrieval"]
    case "discovery":
      return ["catalog_profile_read", "read_only_lookup", "contextual_retrieval"]
  }
}

function buildValidationResults(args: {
  plan: StructuredQueryPlan
  allowedSources: BuiltInAllowedSource[]
  dateCoverage: DateCoverage
}): BuiltInExecutionPlanValidationResult[] {
  const dataset = getDatasetDefinition(args.plan.datasetId)
  const metric = dataset.metrics.find((candidate) => candidate.id === args.plan.metricId)
  const metricSupported =
    args.plan.intent === "discovery" && args.plan.metricId === "dataset_catalog"
      ? true
      : metric?.supportedIntents.includes(args.plan.intent) === true
  const outOfCoverageWindow = getPlanDateWindows(args.plan).find(
    (window) => !isDateWindowWithinCoverage(window, args.dateCoverage),
  )
  const results: BuiltInExecutionPlanValidationResult[] = [
    {
      check: "dataset_support",
      status: dataset.id === args.plan.datasetId ? "passed" : "failed",
      message:
        dataset.id === args.plan.datasetId
          ? `${dataset.label} is an approved execution dataset.`
          : "The requested dataset is not registered for built-in execution.",
    },
    {
      check: "intent_support",
      status: dataset.supportedIntentIds.includes(args.plan.intent) ? "passed" : "failed",
      message: dataset.supportedIntentIds.includes(args.plan.intent)
        ? `${args.plan.intent} is supported for this dataset.`
        : `The ${dataset.label} dataset does not support that intent yet.`,
    },
    {
      check: "metric_support",
      status: metricSupported ? "passed" : "failed",
      message: metricSupported
        ? `${args.plan.metricId} is approved for ${args.plan.intent}.`
        : `The ${dataset.label} dataset does not support that metric/intent pair yet.`,
    },
    {
      check: "timeframe_support",
      status: dataset.supportedTimeframes.includes(args.plan.timeframe) ? "passed" : "failed",
      message: dataset.supportedTimeframes.includes(args.plan.timeframe)
        ? `${args.plan.timeframe} is an approved timeframe.`
        : `The ${dataset.label} dataset does not support that timeframe yet.`,
    },
    {
      check: "source_permission",
      status: args.allowedSources.length > 0 ? "passed" : "failed",
      message:
        args.allowedSources.length > 0
          ? `Execution is restricted to ${args.allowedSources.join(", ")}.`
          : "No approved sources were registered for this execution path.",
    },
    {
      check: "coverage",
      status: outOfCoverageWindow ? "failed" : "passed",
      message: outOfCoverageWindow
        ? `That request falls outside the dataset coverage window of ${formatDateCoverage(args.dateCoverage)}.`
        : `All requested windows are inside ${formatDateCoverage(args.dateCoverage)}.`,
    },
  ]

  if (args.plan.intent === "compare" && !args.plan.compareSpec) {
    results.push({
      check: "intent_metadata",
      status: "failed",
      message:
        "The compare request could not be resolved into a supported side-by-side view.",
    })
  }

  if (args.plan.intent === "breakdown" && !args.plan.breakdownDimension) {
    results.push({
      check: "intent_metadata",
      status: "failed",
      message:
        "The breakdown request could not be resolved into a supported dimension.",
    })
  }

  return results
}

function buildTrace(args: {
  planId: string
  plan: StructuredQueryPlan
  validationStatus: BuiltInExecutionPlan["validation"]["status"]
  validationResults: BuiltInExecutionPlanValidationResult[]
  allowedSources: BuiltInAllowedSource[]
}) {
  const entries: ExecutionTraceEntry[] = [
    {
      id: "planning.structured_plan",
      stage: "planning",
      status: "approved",
      message: "Planning produced a structured built-in query plan.",
      metadata: {
        intent: args.plan.intent,
        metric: args.plan.metricId,
        dataset: args.plan.datasetId,
      },
    },
    {
      id: "validation.execution_plan",
      stage: "validation",
      status: args.validationStatus === "approved" ? "approved" : "blocked",
      message:
        args.validationStatus === "approved"
          ? "Execution plan validation approved deterministic dispatch."
          : "Execution plan validation blocked deterministic dispatch.",
      metadata: {
        failedChecks: args.validationResults.filter((result) => result.status === "failed").length,
      },
    },
    ...args.allowedSources.map<ExecutionTraceEntry>((source) => ({
      id: `source_read.${source}`,
      stage: "source_read",
      status: "approved",
      message: `${source} reads are approved for this execution plan.`,
      metadata: {
        source,
      },
    })),
  ]

  if (args.validationStatus === "rejected") {
    entries.push({
      id: "fallback.validation",
      stage: "fallback",
      status: "fallback",
      message: "Built-in fallback response is required because validation rejected the execution plan.",
    })
  }

  return {
    planId: args.planId,
    entries,
  }
}

export function appendExecutionTrace(
  trace: ExecutionTrace,
  entry: ExecutionTraceEntry,
): ExecutionTrace {
  return {
    planId: trace.planId,
    entries: [...trace.entries, entry],
  }
}

export function buildPlanningFallbackExecutionTrace(args: {
  inputQuestion: string
  fallbackReason: string
}): ExecutionTrace {
  return {
    planId: `unplanned:${args.inputQuestion}`,
    entries: [
      {
        id: "planning.no_structured_plan",
        stage: "planning",
        status: "blocked",
        message: "Planning could not produce an approved structured built-in query plan.",
      },
      {
        id: "fallback.planning",
        stage: "fallback",
        status: "fallback",
        message: args.fallbackReason,
      },
    ],
  }
}

export function buildBuiltInExecutionPlan(args: {
  plan: StructuredQueryPlan
  dateCoverage: DateCoverage
  allowAgenticFallback?: boolean
}): BuiltInExecutionPlan {
  const intent = args.plan.intent as BuiltInIntent
  const planId = buildPlanId(args.plan)
  const selectedCapabilities = getCapabilities(intent)
  const allowedSources = getAllowedSources(intent)
  const allowedOperations = getAllowedOperations(intent)
  const validationResults = buildValidationResults({
    plan: args.plan,
    allowedSources,
    dateCoverage: args.dateCoverage,
  })
  const failedValidation = validationResults.find((result) => result.status === "failed")
  const validationStatus = failedValidation ? "rejected" : "approved"

  return {
    planId,
    datasetId: args.plan.datasetId,
    intent,
    rawQuestion: args.plan.rawQuestion,
    structuredPlan: args.plan,
    semanticTargets: {
      metricId: args.plan.metricId,
      scope: args.plan.scope,
      scopeDimensions: args.plan.scopeDimensions,
      dateWindow: args.plan.dateWindow,
      comparisonWindow: args.plan.comparisonWindow,
      breakdownDimension: args.plan.breakdownDimension,
      compareSpec: args.plan.compareSpec,
      discoveryFocus: args.plan.discoveryFocus,
    },
    selectedCapabilities,
    allowedSources,
    allowedOperations,
    validation: {
      status: validationStatus,
      results: validationResults,
      fallbackReason: failedValidation?.message,
    },
    fallbackPolicy: {
      builtInFallback: true,
      allowAgenticFallback: args.allowAgenticFallback ?? false,
    },
    trace: buildTrace({
      planId,
      plan: args.plan,
      validationStatus,
      validationResults,
      allowedSources,
    }),
  }
}
