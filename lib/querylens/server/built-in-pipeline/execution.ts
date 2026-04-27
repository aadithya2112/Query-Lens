import { appendExecutionTrace } from "@/lib/querylens/server/built-in-pipeline/execution-plan"
import type { BuiltInCapabilityContext } from "@/lib/querylens/server/built-in-pipeline/capabilities"
import { executeComparePlan } from "@/lib/querylens/server/executors/compare"
import { executeBreakdownPlan } from "@/lib/querylens/server/executors/breakdown"
import { executeDiscoveryPlan } from "@/lib/querylens/server/executors/discovery"
import { executeWhatChangedPlan } from "@/lib/querylens/server/executors/what-changed"
import type {
  BuiltInExecutionPlan,
  BuiltInExecutionResult,
} from "@/lib/querylens/server/built-in-pipeline/types"
import type { QueryLensDataAccess } from "@/lib/querylens/server/repositories"
import type {
  RetrievalContext,
  WeeklyMetricRow,
} from "@/lib/querylens/types"

export async function executeBuiltInPlan(args: {
  executionPlan: BuiltInExecutionPlan
  dataAccess: QueryLensDataAccess
  weeklyRows: WeeklyMetricRow[]
  retrievalContext: RetrievalContext
}): Promise<BuiltInExecutionResult> {
  const plan = args.executionPlan.structuredPlan
  const capabilityContext: BuiltInCapabilityContext = {
    executionPlan: args.executionPlan,
    dataAccess: args.dataAccess,
    weeklyRows: args.weeklyRows,
    retrievalContext: args.retrievalContext,
  }

  if (args.executionPlan.validation.status === "rejected") {
    return {
      kind: "failure",
      fallbackReason:
        args.executionPlan.validation.fallbackReason ??
        "QueryLens could not approve that execution plan safely.",
      interpretation: {
        mode: "fallback",
        explanation:
          "QueryLens validated the execution plan before dispatch and declined to run an unapproved deterministic path.",
      },
      executionTrace: appendExecutionTrace(args.executionPlan.trace, {
        id: "fallback.execution_validation",
        stage: "fallback",
        status: "fallback",
        message:
          args.executionPlan.validation.fallbackReason ??
          "Execution plan validation rejected deterministic dispatch.",
      }),
    }
  }

  let result: BuiltInExecutionResult

  switch (args.executionPlan.intent) {
    case "what_changed":
      result = await executeWhatChangedPlan({
        context: capabilityContext,
        dataAccess: args.dataAccess,
        plan,
        weeklyRows: args.weeklyRows,
      })
      break
    case "compare":
      result = await executeComparePlan({
        context: capabilityContext,
        dataAccess: args.dataAccess,
        plan,
      })
      break
    case "breakdown":
      result = await executeBreakdownPlan({
        context: capabilityContext,
        dataAccess: args.dataAccess,
        plan,
      })
      break
    case "discovery":
      result = await executeDiscoveryPlan({
        context: capabilityContext,
        plan,
        weeklyRows: args.weeklyRows,
        dataAccess: args.dataAccess,
        retrievalContext: args.retrievalContext,
      })
      break
    default:
      return {
        kind: "failure",
        fallbackReason:
          "That query intent is not registered yet for the current dataset.",
        interpretation: {
          mode: "fallback",
          explanation:
            "QueryLens recognized the request shape but the dataset does not currently ship that built-in flow.",
        },
        executionTrace: appendExecutionTrace(args.executionPlan.trace, {
          id: "fallback.unregistered_intent",
          stage: "fallback",
          status: "fallback",
          message:
            "That query intent is not registered yet for the current dataset.",
        }),
      }
  }

  const executionTrace = appendExecutionTrace(args.executionPlan.trace, {
    id: `dispatch.${args.executionPlan.intent}`,
    stage: "dispatch",
    status: result.kind === "success" ? "completed" : "fallback",
    message:
      result.kind === "success"
        ? `${args.executionPlan.intent} dispatched through the approved deterministic executor.`
        : result.fallbackReason,
  })

  if (result.kind === "failure") {
    return {
      ...result,
      executionTrace,
    }
  }

  return {
    ...result,
    executionTrace,
  }
}
