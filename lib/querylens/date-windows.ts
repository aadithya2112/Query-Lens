import {
  addDays,
  differenceInCalendarDays,
  endOfWeek,
  format,
  isValid,
  parse,
  parseISO,
  startOfWeek,
} from "date-fns"

import { getReferenceDate, toIsoDate } from "@/lib/querylens/reference-date"
import type { DateWindow, SupportedTimeframe } from "@/lib/querylens/types"

interface DateCoverage {
  startDate: string
  endDate: string
}

interface ResolvedCompareWindows {
  leftWindow: DateWindow
  rightWindow: DateWindow
}

export interface ResolvedQuestionDateWindows {
  primaryWindow?: DateWindow
  compareWindows?: ResolvedCompareWindows
}

const MONTH_DATE_PATTERN =
  "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\s+\\d{1,2}(?:,?\\s+\\d{4})?"
const ISO_DATE_PATTERN = "\\d{4}-\\d{2}-\\d{2}"
const DATE_PATTERN = `(${ISO_DATE_PATTERN}|${MONTH_DATE_PATTERN})`
const RANGE_SEGMENT_PATTERN = `(?:from\\s+${DATE_PATTERN}\\s+to\\s+${DATE_PATTERN}|between\\s+${DATE_PATTERN}\\s+and\\s+${DATE_PATTERN})`

function normalizeRangeDate(dateValue: string) {
  return dateValue.replace(/\s+/g, " ").replace(/\s+,/g, ",").trim()
}

function parseNaturalDate(rawValue: string) {
  const value = normalizeRangeDate(rawValue)
  const referenceDate = getReferenceDate()
  const formats = [
    "yyyy-MM-dd",
    "MMM d, yyyy",
    "MMM d yyyy",
    "MMMM d, yyyy",
    "MMMM d yyyy",
    "MMM d",
    "MMMM d",
  ]

  for (const formatString of formats) {
    const parsed = parse(value, formatString, referenceDate)
    if (isValid(parsed)) {
      if (!/\b\d{4}\b/.test(value) && formatString !== "yyyy-MM-dd") {
        parsed.setFullYear(referenceDate.getFullYear())
      }

      return parsed
    }
  }

  const isoParsed = parseISO(value)
  if (isValid(isoParsed)) {
    return isoParsed
  }

  return undefined
}

export function formatDateWindowLabel(startDate: string, endDate: string) {
  const start = parseISO(startDate)
  const end = parseISO(endDate)

  if (startDate === endDate) {
    return format(start, "MMM d, yyyy")
  }

  if (format(start, "MMM yyyy") === format(end, "MMM yyyy")) {
    return `${format(start, "MMM d")} - ${format(end, "d, yyyy")}`
  }

  return `${format(start, "MMM d, yyyy")} - ${format(end, "MMM d, yyyy")}`
}

export function buildDateWindow(args: {
  startDate: string
  endDate: string
  relativeTimeframe?: SupportedTimeframe
}): DateWindow {
  const start = parseISO(args.startDate)
  const end = parseISO(args.endDate)

  return {
    startDate: args.startDate,
    endDate: args.endDate,
    dayCount: differenceInCalendarDays(end, start) + 1,
    label: formatDateWindowLabel(args.startDate, args.endDate),
    relativeTimeframe: args.relativeTimeframe,
  }
}

export function shiftDateWindow(window: DateWindow, days: number) {
  return buildDateWindow({
    startDate: toIsoDate(addDays(parseISO(window.startDate), days)),
    endDate: toIsoDate(addDays(parseISO(window.endDate), days)),
  })
}

export function buildPriorEqualDateWindow(window: DateWindow) {
  return shiftDateWindow(window, -window.dayCount)
}

export function getRelativeDateWindow(timeframe: SupportedTimeframe) {
  const referenceDate = getReferenceDate()
  const currentWeekStart = startOfWeek(referenceDate, { weekStartsOn: 1 })
  const currentWeekEnd = endOfWeek(referenceDate, { weekStartsOn: 1 })

  if (timeframe === "this_week") {
    return buildDateWindow({
      startDate: toIsoDate(currentWeekStart),
      endDate: toIsoDate(currentWeekEnd),
      relativeTimeframe: timeframe,
    })
  }

  const lastWeekStart = addDays(currentWeekStart, -7)
  const lastWeekEnd = endOfWeek(lastWeekStart, { weekStartsOn: 1 })

  return buildDateWindow({
    startDate: toIsoDate(lastWeekStart),
    endDate: toIsoDate(lastWeekEnd),
    relativeTimeframe: timeframe,
  })
}

function parseWeekOfWindow(rawDate: string) {
  const parsedDate = parseNaturalDate(rawDate)
  if (!parsedDate) {
    return undefined
  }

  const start = startOfWeek(parsedDate, { weekStartsOn: 1 })
  const end = endOfWeek(parsedDate, { weekStartsOn: 1 })

  return buildDateWindow({
    startDate: toIsoDate(start),
    endDate: toIsoDate(end),
  })
}

function parseRangeWindow(rawStartDate: string, rawEndDate: string) {
  const start = parseNaturalDate(rawStartDate)
  const end = parseNaturalDate(rawEndDate)

  if (!start || !end || end < start) {
    return undefined
  }

  return buildDateWindow({
    startDate: toIsoDate(start),
    endDate: toIsoDate(end),
  })
}

function extractRangeWindows(question: string) {
  const matches = Array.from(
    question.matchAll(new RegExp(RANGE_SEGMENT_PATTERN, "gi"))
  )

  return matches
    .map((match) => {
      const rawStartDate = match[1] ?? match[3]
      const rawEndDate = match[2] ?? match[4]
      if (!rawStartDate || !rawEndDate) {
        return undefined
      }

      return parseRangeWindow(rawStartDate, rawEndDate)
    })
    .filter((window): window is DateWindow => Boolean(window))
}

function extractWeekOfWindows(question: string) {
  const matches = Array.from(
    question.matchAll(new RegExp(`week\\s+of\\s+${DATE_PATTERN}`, "gi"))
  )

  return matches
    .map((match) => parseWeekOfWindow(match[1]))
    .filter((window): window is DateWindow => Boolean(window))
}

function extractSingleDateWindows(question: string) {
  const matches = Array.from(
    question.matchAll(new RegExp(`(?:on|for)\\s+${DATE_PATTERN}`, "gi"))
  )

  return matches
    .map((match) => {
      const parsed = parseNaturalDate(match[1])

      if (!parsed) {
        return undefined
      }

      const isoDate = toIsoDate(parsed)

      return buildDateWindow({
        startDate: isoDate,
        endDate: isoDate,
      })
    })
    .filter((window): window is DateWindow => Boolean(window))
}

export function resolveQuestionDateWindows(
  question: string
): ResolvedQuestionDateWindows {
  const normalizedQuestion = question.toLowerCase()

  if (
    normalizedQuestion.includes("this week vs last week") ||
    normalizedQuestion.includes("this week versus last week")
  ) {
    return {
      compareWindows: {
        leftWindow: getRelativeDateWindow("this_week"),
        rightWindow: getRelativeDateWindow("last_week"),
      },
    }
  }

  if (
    normalizedQuestion.includes("last week vs this week") ||
    normalizedQuestion.includes("last week versus this week")
  ) {
    return {
      compareWindows: {
        leftWindow: getRelativeDateWindow("last_week"),
        rightWindow: getRelativeDateWindow("this_week"),
      },
    }
  }

  const rangeWindows = extractRangeWindows(question)
  if (rangeWindows.length >= 2 && /\b(vs|versus|compare)\b/i.test(question)) {
    return {
      compareWindows: {
        leftWindow: rangeWindows[0],
        rightWindow: rangeWindows[1],
      },
    }
  }

  if (rangeWindows[0]) {
    return {
      primaryWindow: rangeWindows[0],
    }
  }

  const weekOfWindows = extractWeekOfWindows(question)
  if (weekOfWindows.length >= 2 && /\b(vs|versus|compare)\b/i.test(question)) {
    return {
      compareWindows: {
        leftWindow: weekOfWindows[0],
        rightWindow: weekOfWindows[1],
      },
    }
  }

  if (weekOfWindows[0]) {
    return {
      primaryWindow: weekOfWindows[0],
    }
  }

  const singleDateWindows = extractSingleDateWindows(question)
  if (singleDateWindows.length >= 2 && /\b(vs|versus|compare)\b/i.test(question)) {
    return {
      compareWindows: {
        leftWindow: singleDateWindows[0],
        rightWindow: singleDateWindows[1],
      },
    }
  }

  if (singleDateWindows[0]) {
    return {
      primaryWindow: singleDateWindows[0],
    }
  }

  if (normalizedQuestion.includes("last week")) {
    return {
      primaryWindow: getRelativeDateWindow("last_week"),
    }
  }

  if (normalizedQuestion.includes("this week")) {
    return {
      primaryWindow: getRelativeDateWindow("this_week"),
    }
  }

  return {}
}

export function isDateWindowWithinCoverage(
  window: DateWindow,
  coverage: DateCoverage
) {
  return (
    window.startDate >= coverage.startDate && window.endDate <= coverage.endDate
  )
}

export function formatDateCoverage(coverage: DateCoverage) {
  return formatDateWindowLabel(coverage.startDate, coverage.endDate)
}
