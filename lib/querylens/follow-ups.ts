import type { DateWindow, FollowUpAction, ScopeFilter } from "@/lib/querylens/types"

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

function createQuestionAction(args: {
  id: string
  label: string
  question: string
  intentHint?: FollowUpAction["intentHint"]
}): FollowUpAction {
  return {
    id: args.id,
    label: args.label,
    question: args.question,
    actionType: "run_follow_up_question",
    intentHint: args.intentHint,
  }
}

export function createLeadershipSummaryAction(): FollowUpAction {
  return {
    id: "leadership-summary",
    label: "Summarize for leadership",
    question: "Summarize this for leadership",
    actionType: "leadership_summary",
    intentHint: "leadership_summary",
  }
}

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

export function buildDefaultFollowUpActions(
  supportedFollowUps: string[],
): FollowUpAction[] {
  return supportedFollowUps.map((question, index) =>
    createQuestionAction({
      id: `default-follow-up-${index + 1}`,
      label:
        index === 0
          ? "Next step"
          : index === 1
            ? "Drill deeper"
            : "Try another view",
      question,
    }),
  )
}

function scopeQuestionPhrase(scope: ScopeFilter) {
  if (scope.region && scope.sector) {
    return ` in the ${scope.region} ${scope.sector} pocket`
  }

  if (scope.region) {
    return ` in ${scope.region}`
  }

  if (scope.sector) {
    return ` for ${scope.sector}`
  }

  return ""
}

export function buildWhatChangedFollowUpActions(args: {
  targetWindow: DateWindow
  scope: ScopeFilter
  weakestRegionLabel?: string
  weakestSectorLabel?: string
  healthyPeerLabel?: string
}) {
  const phrase = buildWindowQuestionPhrase(args.targetWindow)
  const actions: FollowUpAction[] = []

  if (!args.scope.region && args.weakestRegionLabel) {
    actions.push(
      createQuestionAction({
        id: "what-changed-weakest-region",
        label: "Show weakest region",
        question: `Why did ${args.weakestRegionLabel} cashflow health drop ${phrase}?`,
        intentHint: "what_changed",
      }),
    )
    actions.push(
      createQuestionAction({
        id: "what-changed-breakdown-sector",
        label: "Break it down by sector",
        question: `Break down at-risk accounts by sector in ${args.weakestRegionLabel} ${phrase}.`,
        intentHint: "breakdown",
      }),
    )
  }

  if (!args.scope.sector && args.weakestSectorLabel) {
    actions.push(
      createQuestionAction({
        id: "what-changed-weakest-sector",
        label: "Show weakest sector",
        question: `Why did ${args.weakestSectorLabel} cashflow health drop ${phrase}${scopeQuestionPhrase(args.scope)}?`,
        intentHint: "what_changed",
      }),
    )
  }

  if (args.weakestRegionLabel && args.healthyPeerLabel) {
    actions.push(
      createQuestionAction({
        id: "what-changed-compare-peer",
        label: "Compare to healthy peer",
        question: `Compare ${args.weakestRegionLabel} vs ${args.healthyPeerLabel} cashflow health ${phrase}.`,
        intentHint: "compare",
      }),
    )
  }

  actions.push(createLeadershipSummaryAction())

  return actions
}

export function buildBreakdownFollowUpActions(args: {
  targetWindow: DateWindow
  dimension: "region" | "sector" | "region_sector"
  topBucketLabel?: string
  healthyPeerLabel?: string
  topBucketRegionLabel?: string
  topBucketSectorLabel?: string
}) {
  const phrase = buildWindowQuestionPhrase(args.targetWindow)
  const actions: FollowUpAction[] = []

  if (args.dimension === "region" && args.topBucketLabel) {
    actions.push(
      createQuestionAction({
        id: "breakdown-explain-region",
        label: "Explain this region",
        question: `Why did ${args.topBucketLabel} cashflow health drop ${phrase}?`,
        intentHint: "what_changed",
      }),
    )
  }

  if (args.dimension === "sector" && args.topBucketLabel) {
    actions.push(
      createQuestionAction({
        id: "breakdown-explain-sector",
        label: "Explain this sector",
        question: `Why did ${args.topBucketLabel} cashflow health drop ${phrase}?`,
        intentHint: "what_changed",
      }),
    )
  }

  if (
    args.dimension === "region_sector" &&
    args.topBucketRegionLabel &&
    args.topBucketSectorLabel
  ) {
    actions.push(
      createQuestionAction({
        id: "breakdown-explain-pocket",
        label: "Explain this pocket",
        question: `Why did ${args.topBucketSectorLabel} cashflow health drop ${phrase} in ${args.topBucketRegionLabel}?`,
        intentHint: "what_changed",
      }),
    )
    actions.push(
      createQuestionAction({
        id: "breakdown-region-sector",
        label: "View region split",
        question: `Break down at-risk accounts by region ${phrase}.`,
        intentHint: "breakdown",
      }),
    )
  }

  if (args.topBucketLabel && args.healthyPeerLabel) {
    actions.push(
      createQuestionAction({
        id: "breakdown-compare-peer",
        label: "Compare to healthy peer",
        question: `Compare ${args.topBucketLabel} vs ${args.healthyPeerLabel} cashflow health ${phrase}.`,
        intentHint: "compare",
      }),
    )
  }

  actions.push(createLeadershipSummaryAction())

  return actions
}

export function buildCompareFollowUpActions(args: {
  targetWindow: DateWindow
  weakerLabel: string
  compareDimension?: "region" | "sector"
}) {
  const phrase = buildWindowQuestionPhrase(args.targetWindow)
  const actions: FollowUpAction[] = [
    createQuestionAction({
      id: "compare-explain-weaker",
      label: "Explain weaker side",
      question: `Why did ${args.weakerLabel} cashflow health drop ${phrase}?`,
      intentHint: "what_changed",
    }),
  ]

  if (args.compareDimension === "region") {
    actions.push(
      createQuestionAction({
        id: "compare-breakdown-weaker-region",
        label: "Break it down by sector",
        question: `Break down at-risk accounts by sector in ${args.weakerLabel} ${phrase}.`,
        intentHint: "breakdown",
      }),
    )
  }

  if (args.compareDimension === "sector") {
    actions.push(
      createQuestionAction({
        id: "compare-breakdown-weaker-sector",
        label: "Break it down by region",
        question: `Break down at-risk accounts by region in ${args.weakerLabel} ${phrase}.`,
        intentHint: "breakdown",
      }),
    )
  }

  actions.push(createLeadershipSummaryAction())

  return actions
}
