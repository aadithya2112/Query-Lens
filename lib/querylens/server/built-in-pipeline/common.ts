import { formatWeekLabel } from "@/lib/querylens/seed-data"
import type {
  ScopeFilter,
  WeeklyMetricRow,
} from "@/lib/querylens/types"

export function filterRowsForScope(rows: WeeklyMetricRow[], scope: ScopeFilter) {
  if (scope.region && scope.sector) {
    return rows.filter(
      (row) =>
        row.recordType === "region_sector" &&
        row.regionId === scope.region &&
        row.sectorId === scope.sector,
    )
  }

  if (scope.region) {
    return rows.filter(
      (row) => row.recordType === "region" && row.regionId === scope.region,
    )
  }

  if (scope.sector) {
    return rows.filter(
      (row) => row.recordType === "sector" && row.sectorId === scope.sector,
    )
  }

  return rows.filter((row) => row.recordType === "portfolio")
}

export function buildCashflowHistoryChartSpec(
  rows: WeeklyMetricRow[],
  activeScopeLabel: string,
) {
  const series = rows.map((row) => ({
    label: formatWeekLabel(row.weekStart),
    weekStart: row.weekStart,
    weekEnd: row.weekEnd,
    score: row.cashflowHealthScore,
  }))

  return {
    type: "line" as const,
    title: `${activeScopeLabel} cashflow health over the last 12 weeks`,
    xKey: "label" as const,
    yKey: "score" as const,
    data: series,
    explanation:
      "The chart tracks the sample dataset's weekly cashflow health score so the drop can be read in context, not as a one-off number.",
  }
}
