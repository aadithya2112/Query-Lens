import {
  formatContextualDateWindowLabel,
  getRelativeDateWindow,
} from "@/lib/querylens/date-windows"
import { filterRowsForScope } from "@/lib/querylens/server/built-in-pipeline/common"
import { aggregateMetricCapability } from "@/lib/querylens/server/built-in-pipeline/capabilities/aggregate-metric"
import type { CompareSpec, DateWindow, WeeklyMetricRow } from "@/lib/querylens/types"
import {
  assertBuiltInCapability,
  type BuiltInCapabilityContext,
} from "@/lib/querylens/server/built-in-pipeline/capabilities/types"

export async function compareSlicesCapability(args: {
  context: BuiltInCapabilityContext
  compareSpec: CompareSpec
}): Promise<{
  leftRow?: WeeklyMetricRow
  rightRow?: WeeklyMetricRow
  timeframeLabel: string
  leftWindow: DateWindow
  rightWindow?: DateWindow
  selectedWindow?: DateWindow
}> {
  assertBuiltInCapability(args.context, "compare_slices")

  if (args.compareSpec.mode === "timeframe") {
    const leftWindow =
      args.compareSpec.leftWindow ??
      getRelativeDateWindow(args.compareSpec.leftTimeframe ?? "this_week")
    const rightWindow =
      args.compareSpec.rightWindow ??
      getRelativeDateWindow(args.compareSpec.rightTimeframe ?? "last_week")
    const [leftAggregate, rightAggregate] = await Promise.all([
      aggregateMetricCapability({
        context: args.context,
        window: leftWindow,
        scope: args.compareSpec.leftScope,
      }),
      aggregateMetricCapability({
        context: args.context,
        window: rightWindow,
        scope: args.compareSpec.rightScope,
      }),
    ])

    return {
      leftRow: leftAggregate.scopedRow,
      rightRow: rightAggregate.scopedRow,
      timeframeLabel: `${leftWindow.label} vs ${rightWindow.label}`,
      leftWindow,
      rightWindow,
    }
  }

  const selectedWindow =
    args.compareSpec.selectedWindow ??
    getRelativeDateWindow(args.compareSpec.selectedTimeframe ?? "last_week")
  const [leftAggregate, rightAggregate] = await Promise.all([
    aggregateMetricCapability({
      context: args.context,
      window: selectedWindow,
      scope: args.compareSpec.leftScope,
    }),
    aggregateMetricCapability({
      context: args.context,
      window: selectedWindow,
      scope: args.compareSpec.rightScope,
    }),
  ])

  return {
    leftRow: filterRowsForScope(
      leftAggregate.rows,
      args.compareSpec.leftScope,
    )[0],
    rightRow: filterRowsForScope(
      rightAggregate.rows,
      args.compareSpec.rightScope,
    )[0],
    timeframeLabel:
      args.compareSpec.mode === "peer"
        ? formatContextualDateWindowLabel(selectedWindow)
        : selectedWindow.label,
    leftWindow: selectedWindow,
    selectedWindow,
  }
}
