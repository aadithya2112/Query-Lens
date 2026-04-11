import { addWeeks, endOfWeek, format, parseISO, startOfWeek } from "date-fns"

import type { SupportedTimeframe } from "@/lib/querylens/types"

const DEFAULT_REFERENCE_DATE = "2026-04-11"

export function getReferenceDate(): Date {
  return parseISO(process.env.QUERYLENS_REFERENCE_DATE ?? DEFAULT_REFERENCE_DATE)
}

export function toIsoDate(date: Date): string {
  return format(date, "yyyy-MM-dd")
}

export function getWeekWindow(timeframe: SupportedTimeframe) {
  const referenceDate = getReferenceDate()
  const currentWeekStart = startOfWeek(referenceDate, { weekStartsOn: 1 })
  const currentWeekEnd = endOfWeek(referenceDate, { weekStartsOn: 1 })
  const lastWeekStart = addWeeks(currentWeekStart, -1)
  const lastWeekEnd = endOfWeek(lastWeekStart, { weekStartsOn: 1 })
  const previousWeekStart = addWeeks(currentWeekStart, -2)
  const previousWeekEnd = endOfWeek(previousWeekStart, { weekStartsOn: 1 })

  if (timeframe === "this_week") {
    return {
      targetStart: toIsoDate(currentWeekStart),
      targetEnd: toIsoDate(currentWeekEnd),
      comparisonStart: toIsoDate(lastWeekStart),
      comparisonEnd: toIsoDate(lastWeekEnd),
      timeframeLabel: `This week (${formatRange(currentWeekStart, currentWeekEnd)})`,
      comparisonLabel: `Compared with last week (${formatRange(lastWeekStart, lastWeekEnd)})`,
    }
  }

  return {
    targetStart: toIsoDate(lastWeekStart),
    targetEnd: toIsoDate(lastWeekEnd),
    comparisonStart: toIsoDate(previousWeekStart),
    comparisonEnd: toIsoDate(previousWeekEnd),
    timeframeLabel: `Last week (${formatRange(lastWeekStart, lastWeekEnd)})`,
    comparisonLabel: `Compared with the prior week (${formatRange(previousWeekStart, previousWeekEnd)})`,
  }
}

export function formatRange(start: Date, end: Date): string {
  if (format(start, "MMM yyyy") === format(end, "MMM yyyy")) {
    return `${format(start, "MMM d")} - ${format(end, "d, yyyy")}`
  }

  return `${format(start, "MMM d, yyyy")} - ${format(end, "MMM d, yyyy")}`
}
