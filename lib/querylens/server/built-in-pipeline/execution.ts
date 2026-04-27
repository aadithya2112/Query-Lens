import { formatDateCoverage, isDateWindowWithinCoverage } from "@/lib/querylens/date-windows"
import { executeComparePlan } from "@/lib/querylens/server/executors/compare"
import { executeBreakdownPlan } from "@/lib/querylens/server/executors/breakdown"
import { executeDiscoveryPlan } from "@/lib/querylens/server/executors/discovery"
import { executeWhatChangedPlan } from "@/lib/querylens/server/executors/what-changed"
import type {
  BuiltInExecutionResult,
} from "@/lib/querylens/server/built-in-pipeline/types"
import type { QueryLensDataAccess } from "@/lib/querylens/server/repositories"
import type {
  RetrievalContext,
  StructuredQueryPlan,
  WeeklyMetricRow,
} from "@/lib/querylens/types"

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

export async function executeBuiltInPlan(args: {
  plan: StructuredQueryPlan
  dataAccess: QueryLensDataAccess
  weeklyRows: WeeklyMetricRow[]
  retrievalContext: RetrievalContext
  dateCoverage: {
    startDate: string
    endDate: string
  }
}): Promise<BuiltInExecutionResult> {
  const outOfCoverageWindow = getPlanDateWindows(args.plan).find(
    (window) => !isDateWindowWithinCoverage(window, args.dateCoverage),
  )

  if (outOfCoverageWindow) {
    return {
      kind: "failure",
      fallbackReason: `That request falls outside the dataset coverage window of ${formatDateCoverage(args.dateCoverage)}.`,
      interpretation: {
        mode: "fallback",
        explanation:
          "QueryLens kept the request inside the validated dataset coverage window and declined to answer outside that range.",
      },
    }
  }

  switch (args.plan.intent) {
    case "what_changed":
      return executeWhatChangedPlan({
        dataAccess: args.dataAccess,
        plan: args.plan,
        weeklyRows: args.weeklyRows,
      })
    case "compare":
      return executeComparePlan({
        dataAccess: args.dataAccess,
        plan: args.plan,
      })
    case "breakdown":
      return executeBreakdownPlan({
        dataAccess: args.dataAccess,
        plan: args.plan,
      })
    case "discovery":
      return executeDiscoveryPlan({
        plan: args.plan,
        weeklyRows: args.weeklyRows,
        dataAccess: args.dataAccess,
        retrievalContext: args.retrievalContext,
      })
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
      }
  }
}
