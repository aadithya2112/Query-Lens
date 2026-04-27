import type { QueryLensExecutionContext } from "@/lib/querylens/server/ai-config"
import { executeBuiltInPlan } from "@/lib/querylens/server/built-in-pipeline/execution"
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
  QueryRequestBody,
  RetrievalContext,
  WeeklyMetricRow,
} from "@/lib/querylens/types"

export async function runBuiltInAnalysisPipeline(args: {
  input: QueryRequestBody
  executionContext: QueryLensExecutionContext
  dataAccess: QueryLensDataAccess
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
      }),
    }
  }

  const execution = await executeBuiltInPlan({
    plan: planning.plan,
    dataAccess: args.dataAccess,
    weeklyRows: args.weeklyRows,
    retrievalContext: args.retrievalContext,
    dateCoverage: args.dateCoverage,
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
