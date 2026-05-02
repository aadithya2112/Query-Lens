import { describe, expect, it } from "vitest"

import {
  shouldAutoOpenTruthPane,
  shouldCenterChatColumn,
} from "@/components/querylens/workspace"
import type { Phase1AnalysisResponse } from "@/lib/querylens/types"

function createAnalysis(
  overrides: Partial<Phase1AnalysisResponse> = {},
): Phase1AnalysisResponse {
  return {
    intent: "what_changed",
    headline: "Cashflow health fell last week",
    summary: "Grounded evidence explains the decline.",
    metric: "cashflow_health_score",
    timeframe: "Last week",
    comparisonBasis: "Compared with the immediately preceding grounded period",
    confidence: 92,
    activeScope: "Portfolio",
    drivers: [],
    evidence: [],
    assumptions: [],
    supportedFollowUps: ["Break this down by region"],
    sourceMode: "database",
    ...overrides,
  }
}

describe("workspace layout helpers", () => {
  it("auto-opens truth only for desktop replies with analysis", () => {
    expect(
      shouldAutoOpenTruthPane({
        analysis: createAnalysis(),
        isMobile: false,
      }),
    ).toBe(true)

    expect(
      shouldAutoOpenTruthPane({
        analysis: createAnalysis(),
        isMobile: true,
      }),
    ).toBe(false)

    expect(
      shouldAutoOpenTruthPane({
        analysis: undefined,
        isMobile: false,
      }),
    ).toBe(false)
  })

  it("centers the chat column only when both desktop side rails are collapsed", () => {
    expect(
      shouldCenterChatColumn({
        isMobile: false,
        isChatSidebarCollapsed: true,
        isTruthCollapsed: true,
      }),
    ).toBe(true)

    expect(
      shouldCenterChatColumn({
        isMobile: false,
        isChatSidebarCollapsed: false,
        isTruthCollapsed: true,
      }),
    ).toBe(false)

    expect(
      shouldCenterChatColumn({
        isMobile: true,
        isChatSidebarCollapsed: true,
        isTruthCollapsed: true,
      }),
    ).toBe(false)
  })
})
