import { parsePhase1Question } from "@/lib/querylens/server/parser"
import { roundTo } from "@/lib/querylens/scoring"
import type {
  ContextEvent,
  DriverItem,
  ParsedPhase1Query,
  Phase1AnalysisResponse,
  ScopeFilter,
} from "@/lib/querylens/types"

export const DEFAULT_FLAGSHIP_QUESTION = "Why did SME cashflow health drop last week?"

interface NarrativeInput {
  parsed: ParsedPhase1Query
  activeScopeLabel: string
  currentScore: number
  previousScore: number
  drivers: DriverItem[]
  contextEvents: ContextEvent[]
}

export interface Phase1Provider {
  parseQuestion: (
    question: string,
    scopeOverride?: ScopeFilter
  ) => ReturnType<typeof parsePhase1Question>
  composeNarrative: (
    input: NarrativeInput
  ) => Pick<Phase1AnalysisResponse, "headline" | "summary" | "supportedFollowUps">
}

function buildHeadline(activeScopeLabel: string, currentScore: number, previousScore: number) {
  const delta = roundTo(currentScore - previousScore)
  const direction = delta < 0 ? "fell" : "improved"
  return `${activeScopeLabel} cashflow health ${direction} ${Math.abs(delta).toFixed(1)} points`
}

export const deterministicPhase1Provider: Phase1Provider = {
  parseQuestion: parsePhase1Question,
  composeNarrative: ({ activeScopeLabel, currentScore, previousScore, drivers, contextEvents }) => {
    const delta = roundTo(currentScore - previousScore)
    const worstDriver = drivers[0]
    const leadContext = contextEvents[0]
    const direction = delta < 0 ? "down" : "up"

    const summaryParts = [
      `${activeScopeLabel} moved ${direction} from ${previousScore.toFixed(1)} to ${currentScore.toFixed(1)} week over week.`,
    ]

    if (worstDriver) {
      summaryParts.push(worstDriver.description)
    }

    if (leadContext) {
      summaryParts.push(
        `${leadContext.summary} ${leadContext.detail}`
      )
    }

    return {
      headline: buildHeadline(activeScopeLabel, currentScore, previousScore),
      summary: summaryParts.join(" "),
      supportedFollowUps: [
        "Focus on the North West contribution to last week's drop",
        "Focus on hospitality SMEs last week",
        "What changed this week instead?",
      ],
    }
  },
}
