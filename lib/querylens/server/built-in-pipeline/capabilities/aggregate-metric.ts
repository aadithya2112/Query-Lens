import { filterRowsForScope } from "@/lib/querylens/server/built-in-pipeline/common"
import {
  aggregateAccountStressRows,
  aggregateMetricWindowRows,
} from "@/lib/querylens/server/range-aggregation"
import type {
  DateWindow,
  ScopeFilter,
  WeeklyMetricRow,
} from "@/lib/querylens/types"
import {
  assertBuiltInCapability,
  type BuiltInCapabilityContext,
} from "@/lib/querylens/server/built-in-pipeline/capabilities/types"

export async function aggregateMetricCapability(args: {
  context: BuiltInCapabilityContext
  window: DateWindow
  scope: ScopeFilter
}) {
  assertBuiltInCapability(args.context, "aggregate_metric")

  const dailyMetrics = await args.context.dataAccess.listDailyMetrics({
    startDate: args.window.startDate,
    endDate: args.window.endDate,
    scope: args.scope,
  })
  const rows = aggregateMetricWindowRows({
    dailyMetrics,
    startDate: args.window.startDate,
    endDate: args.window.endDate,
  })

  return {
    dailyMetrics,
    rows,
    scopedRows: filterRowsForScope(rows, args.scope),
    scopedRow: filterRowsForScope(rows, args.scope)[0] as WeeklyMetricRow | undefined,
  }
}

export async function aggregateAccountStressCapability(args: {
  context: BuiltInCapabilityContext
  window: DateWindow
  scope: ScopeFilter
}) {
  const aggregate = await aggregateMetricCapability(args)

  return {
    ...aggregate,
    stressRows: aggregateAccountStressRows(
      aggregate.dailyMetrics,
      args.window.startDate,
    ),
  }
}
