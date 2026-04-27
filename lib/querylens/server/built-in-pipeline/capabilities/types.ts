import type {
  BuiltInExecutionCapability,
  BuiltInExecutionPlan,
} from "@/lib/querylens/server/built-in-pipeline/types"
import type { QueryLensDataAccess } from "@/lib/querylens/server/repositories"
import type { RetrievalContext, WeeklyMetricRow } from "@/lib/querylens/types"

export type BuiltInCapabilityName = BuiltInExecutionCapability

export interface BuiltInCapabilityContext {
  executionPlan: BuiltInExecutionPlan
  dataAccess: QueryLensDataAccess
  weeklyRows: WeeklyMetricRow[]
  retrievalContext: RetrievalContext
}

export function assertBuiltInCapability(
  context: BuiltInCapabilityContext,
  capability: BuiltInCapabilityName,
) {
  if (!context.executionPlan.selectedCapabilities.includes(capability)) {
    throw new Error(
      `Built-in execution plan ${context.executionPlan.planId} did not approve the ${capability} capability.`,
    )
  }
}
