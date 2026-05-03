import { describe, expect, it } from "vitest"

import {
  getTrustCueSummary,
  getVisibleConfidenceScore,
  isConversationalReply,
  shouldShowFollowUpActions,
} from "@/components/querylens/chat-panel"
import type { Phase1AnalysisResponse } from "@/lib/querylens/types"

function createAnalysis(overrides: Partial<Phase1AnalysisResponse> = {}): Phase1AnalysisResponse {
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

describe("chat-panel trust helpers", () => {
  it("prefers the first-class trust score when it exists", () => {
    const analysis = createAnalysis({
      confidence: 92,
      trust: {
        overall: {
          score: 41,
          label: "low",
        },
        components: {
          interpretation: {
            score: 24,
            label: "low",
            reason: "Fallback.",
          },
          dataCoverage: {
            score: 68,
            label: "medium",
            reason: "Partial coverage.",
          },
          sourceCorroboration: {
            score: 24,
            label: "low",
            reason: "No corroboration.",
          },
          execution: {
            score: 24,
            label: "low",
            reason: "No completed dispatch.",
          },
        },
        trace: [],
        howProduced: [],
        uncertaintyNotes: [],
        limitationNotes: [],
        sources: [],
        observedFacts: [],
        inferredFindings: [],
        assumptions: [],
      },
    })

    expect(getVisibleConfidenceScore(analysis)).toBe(41)
  })

  it("keeps follow-up actions visible for grounded responses", () => {
    const analysis = createAnalysis({
      trust: {
        overall: {
          score: 88,
          label: "high",
        },
        components: {
          interpretation: {
            score: 92,
            label: "high",
            reason: "Direct match.",
          },
          dataCoverage: {
            score: 92,
            label: "high",
            reason: "Coverage approved.",
          },
          sourceCorroboration: {
            score: 68,
            label: "medium",
            reason: "Single-source evidence.",
          },
          execution: {
            score: 92,
            label: "high",
            reason: "Dispatch completed.",
          },
        },
        trace: [],
        howProduced: [],
        uncertaintyNotes: [],
        limitationNotes: [],
        sources: [],
        observedFacts: [],
        inferredFindings: [],
        assumptions: [],
      },
    })

    expect(
      shouldShowFollowUpActions({
        analysis,
        messageText: analysis.summary,
        followUpCount: 1,
      }),
    ).toBe(true)
  })

  it("hides follow-up actions for low-trust fallback responses", () => {
    const analysis = createAnalysis({
      confidence: 92,
      trust: {
        overall: {
          score: 24,
          label: "low",
        },
        components: {
          interpretation: {
            score: 24,
            label: "low",
            reason: "Fallback.",
          },
          dataCoverage: {
            score: 24,
            label: "low",
            reason: "Fallback.",
          },
          sourceCorroboration: {
            score: 24,
            label: "low",
            reason: "Fallback.",
          },
          execution: {
            score: 24,
            label: "low",
            reason: "Fallback.",
          },
        },
        trace: [],
        howProduced: [],
        uncertaintyNotes: [],
        limitationNotes: [],
        sources: [],
        observedFacts: [],
        inferredFindings: [],
        assumptions: [],
      },
    })

    expect(
      shouldShowFollowUpActions({
        analysis,
        messageText: "QueryLens could not complete that custom analysis safely",
        followUpCount: 1,
      }),
    ).toBe(false)
  })

  it("builds a trust cue summary from first-class trust metadata", () => {
    const analysis = createAnalysis({
      queryRuns: [
        {
          id: "run-1",
          title: "Weekly trend",
          sourceId: "built_in_postgres",
          sourceLabel: "Built-in Postgres facts",
          sourceType: "postgres",
          language: "sql",
          statement: "select 1",
          status: "completed",
          rowCount: 2,
          summary: "Returned 2 rows.",
        },
      ],
      trust: {
        overall: {
          score: 88,
          label: "high",
        },
        components: {
          interpretation: {
            score: 92,
            label: "high",
            reason: "Direct match.",
          },
          dataCoverage: {
            score: 92,
            label: "high",
            reason: "Coverage approved.",
          },
          sourceCorroboration: {
            score: 68,
            label: "medium",
            reason: "Single-source evidence.",
          },
          execution: {
            score: 92,
            label: "high",
            reason: "Dispatch completed.",
          },
        },
        trace: [],
        howProduced: [],
        uncertaintyNotes: [],
        limitationNotes: [],
        sources: [
          {
            sourceType: "postgres",
            sourceName: "Built-in Postgres facts",
            scope: "Portfolio",
            timeRange: "Last week",
            note: "Used in answer synthesis.",
          },
        ],
        observedFacts: [],
        inferredFindings: [],
        assumptions: [],
      },
    })

    expect(getTrustCueSummary(analysis)).toEqual({
      trustLabel: "high",
      confidenceScore: 88,
      usedSources: 1,
      queries: 1,
    })
  })

  it("detects conversational fallback replies", () => {
    const analysis = createAnalysis({
      fallback: true,
      timeframe: "Conversation",
    })

    expect(isConversationalReply(analysis)).toBe(true)
    expect(
      isConversationalReply(
        createAnalysis({
          fallback: true,
          timeframe: "Last week",
        }),
      ),
    ).toBe(false)
  })
})
