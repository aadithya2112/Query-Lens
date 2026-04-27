import type { QueryLensExecutionContext } from "@/lib/querylens/server/ai-config"
import { executeBuiltInPlan } from "@/lib/querylens/server/built-in-pipeline/execution"
import { buildPlanningFallbackExecutionTrace } from "@/lib/querylens/server/built-in-pipeline/execution-plan"
import { planBuiltInAnalysis } from "@/lib/querylens/server/built-in-pipeline/planning"
import {
  presentBuiltInExecution,
  presentBuiltInFallback,
} from "@/lib/querylens/server/built-in-pipeline/presentation"
import type {
  BuiltInPipelineResult,
} from "@/lib/querylens/server/built-in-pipeline/types"
import type { QueryLensDataAccess } from "@/lib/querylens/server/repositories"
import type {
  DatasetProfileSnapshot,
  QueryRequestBody,
  RetrievalContext,
  WeeklyMetricRow,
} from "@/lib/querylens/types"

export async function runBuiltInAnalysisPipeline(args: {
  input: QueryRequestBody
  executionContext: QueryLensExecutionContext
  dataAccess: QueryLensDataAccess
  profileSnapshot: DatasetProfileSnapshot
  weeklyRows: WeeklyMetricRow[]
  dateCoverage: {
    startDate: string
    endDate: string
  }
  retrievalContext: RetrievalContext
}): Promise<BuiltInPipelineResult> {
  const planning = await planBuiltInAnalysis({
    input: args.input,
    executionContext: args.executionContext,
    retrievalContext: args.retrievalContext,
    weeklyRows: args.weeklyRows,
    dateCoverage: args.dateCoverage,
  })

  if (planning.kind === "failure") {
    if (planning.allowAgenticFallback) {
      return {
        kind: "needs_agentic",
        fallbackReason: planning.fallbackReason,
      }
    }

    return {
      kind: "response",
      response: presentBuiltInFallback({
        fallbackReason:
          planning.fallbackReason ??
          "The question could not be matched to the phase-1 vertical slice safely.",
        sourceMode: args.dataAccess.sourceMode,
        weeklyRows: args.weeklyRows,
        retrievalContext: args.retrievalContext,
        inputQuestion: args.input.question,
        interpretation: planning.interpretation,
        executionTrace: buildPlanningFallbackExecutionTrace({
          inputQuestion: args.input.question,
          fallbackReason:
            planning.fallbackReason ??
            "The question could not be matched to the phase-1 vertical slice safely.",
        }),
      }),
    }
  }

  const execution = await executeBuiltInPlan({
    executionPlan: planning.executionPlan,
    dataAccess: args.dataAccess,
    profileSnapshot: args.profileSnapshot,
    weeklyRows: args.weeklyRows,
    retrievalContext: args.retrievalContext,
  })

  if (execution.kind === "failure") {
    return {
      kind: "response",
      response: presentBuiltInFallback({
        fallbackReason: execution.fallbackReason,
        sourceMode: args.dataAccess.sourceMode,
        weeklyRows: args.weeklyRows,
        retrievalContext: args.retrievalContext,
        inputQuestion: args.input.question,
        interpretation: execution.interpretation ?? planning.interpretation,
        executionTrace: execution.executionTrace ?? planning.executionPlan.trace,
      }),
    }
  }

  return {
    kind: "response",
    response: await presentBuiltInExecution({
      execution,
      retrievalContext: args.retrievalContext,
      inputQuestion: args.input.question,
      interpretation: planning.interpretation,
      executionContext: args.executionContext,
    }),
  }
}
