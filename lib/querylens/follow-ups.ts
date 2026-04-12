import type { DateWindow } from "@/lib/querylens/types"

export const DEFAULT_WHAT_CHANGED_FOLLOW_UPS = [
  "Focus on the North West contribution to last week's drop",
  "Focus on hospitality SMEs last week",
  "What changed this week instead?",
] as const

export const DEFAULT_BREAKDOWN_FOLLOW_UPS = [
  "Break down at-risk accounts by region this week",
  "Break down at-risk accounts by sector last week",
  "Why did SME cashflow health drop last week?",
] as const

export const DEFAULT_COMPARE_FOLLOW_UPS = [
  "Compare cashflow health this week vs last week",
  "Compare North West vs London & South East cashflow health last week",
  "Compare hospitality vs retail cashflow health this week",
] as const

function buildWindowQuestionPhrase(window: DateWindow) {
  if (window.relativeTimeframe === "this_week") {
    return "this week"
  }

  if (window.relativeTimeframe === "last_week") {
    return "last week"
  }

  if (window.dayCount === 1) {
    return `on ${window.startDate}`
  }

  return `from ${window.startDate} to ${window.endDate}`
}

function buildTimeframeCompareQuestion(leftWindow: DateWindow, rightWindow: DateWindow) {
  if (
    leftWindow.relativeTimeframe === "this_week" &&
    rightWindow.relativeTimeframe === "last_week"
  ) {
    return DEFAULT_COMPARE_FOLLOW_UPS[0]
  }

  return `Compare cashflow health from ${leftWindow.startDate} to ${leftWindow.endDate} vs from ${rightWindow.startDate} to ${rightWindow.endDate}`
}

export function buildWhatChangedFollowUps(args: {
  targetWindow: DateWindow
  comparisonWindow: DateWindow
}) {
  if (
    args.targetWindow.relativeTimeframe === "last_week" &&
    args.comparisonWindow.relativeTimeframe !== undefined
  ) {
    return [...DEFAULT_WHAT_CHANGED_FOLLOW_UPS]
  }

  return [
    `Why did North West cashflow health drop ${buildWindowQuestionPhrase(args.targetWindow)}?`,
    `Why did hospitality cashflow health drop ${buildWindowQuestionPhrase(args.targetWindow)}?`,
    buildTimeframeCompareQuestion(args.targetWindow, args.comparisonWindow),
  ]
}

export function buildBreakdownFollowUps(args: {
  targetWindow: DateWindow
}) {
  if (args.targetWindow.relativeTimeframe) {
    return [...DEFAULT_BREAKDOWN_FOLLOW_UPS]
  }

  return [
    `Break down at-risk accounts by region ${buildWindowQuestionPhrase(args.targetWindow)}`,
    `Break down at-risk accounts by sector ${buildWindowQuestionPhrase(args.targetWindow)}`,
    `Why did SME cashflow health drop ${buildWindowQuestionPhrase(args.targetWindow)}?`,
  ]
}

export function buildCompareFollowUps(args: {
  targetWindow: DateWindow
  comparisonWindow?: DateWindow
}) {
  if (
    args.targetWindow.relativeTimeframe === "this_week" ||
    args.targetWindow.relativeTimeframe === "last_week"
  ) {
    return [...DEFAULT_COMPARE_FOLLOW_UPS]
  }

  return [
    args.comparisonWindow
      ? buildTimeframeCompareQuestion(args.targetWindow, args.comparisonWindow)
      : `Compare cashflow health ${buildWindowQuestionPhrase(args.targetWindow)}`,
    `Compare North West vs London & South East cashflow health ${buildWindowQuestionPhrase(args.targetWindow)}`,
    `Compare hospitality vs retail cashflow health ${buildWindowQuestionPhrase(args.targetWindow)}`,
  ]
}
