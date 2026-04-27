import { describe, expect, it } from "vitest"

import {
  buildBuiltInTrustModel,
  buildTrustArtifactsFromModel,
} from "@/lib/querylens/server/trust-model"
import type { Phase1AnalysisResponse } from "@/lib/querylens/types"

function createBaseResponse(
  overrides: Partial<
    Pick<
      Phase1AnalysisResponse,
      | "activeScope"
      | "assumptions"
      | "drivers"
      | "evidence"
      | "fallback"
      | "headline"
      | "intent"
      | "summary"
    >
  > = {},
) {
  return {
    intent: "what_changed" as const,
    headline: "North West cashflow health fell last week",
    summary: "Grounded weekly metrics and context events explain the decline.",
    activeScope: "North West",
    evidence: [
      {
        sourceType: "postgres" as const,
        sourceName: "weekly_portfolio_metrics",
        timeRange: "Last week",
        scope: "North West",
        supportingFact: "North West cashflow health declined by 4.2 points week over week.",
        queryTemplateId: "weekly_delta_v1",
      },
      {
        sourceType: "mongodb" as const,
        sourceName: "service_incidents",
        timeRange: "Last week",
        scope: "North West",
        supportingFact: "Incident volume increased in the same weekly window.",
        queryTemplateId: "context_incident_v1",
      },
    ],
    drivers: [
      {
        id: "driver-1",
        title: "Payment coverage weakened",
        impactLabel: "-2.8 pts",
        direction: "negative" as const,
        description: "Payment coverage weakened relative to the previous validated week.",
      },
    ],
    assumptions: ["Weeks run Monday to Sunday across the phase-1 dataset."],
    fallback: false,
    ...overrides,
  }
}

describe("built-in trust model", () => {
  it("scores direct cross-source built-in responses highly", () => {
    const trust = buildBuiltInTrustModel({
      response: createBaseResponse(),
      interpretation: {
        mode: "direct",
        explanation: "Matched directly to a supported built-in flow.",
      },
      executionTrace: {
        planId: "trust-test",
        entries: [
          {
            id: "dispatch.success",
            stage: "dispatch",
            status: "completed",
            message: "Deterministic executor completed.",
          },
        ],
      },
      context: {
        allowedSources: ["postgres", "mongodb"],
        observedSources: ["postgres", "mongodb"],
        coverageKind: "validated_analytics",
        validationStatus: "approved",
        validationResults: [
          {
            check: "coverage",
            status: "passed",
            message: "All requested windows are inside the supported coverage window.",
          },
        ],
      },
    })

    expect(trust.overall.score).toBeGreaterThanOrEqual(90)
    expect(trust.components.sourceCorroboration.label).toBe("high")
    expect(trust.trace).toHaveLength(4)
  })

  it("downgrades corroboration for single-source analytic answers", () => {
    const trust = buildBuiltInTrustModel({
      response: createBaseResponse({
        evidence: createBaseResponse().evidence.slice(0, 1),
      }),
      interpretation: {
        mode: "direct",
        explanation: "Matched directly to a supported built-in flow.",
      },
      executionTrace: {
        planId: "trust-test-single-source",
        entries: [
          {
            id: "dispatch.success",
            stage: "dispatch",
            status: "completed",
            message: "Deterministic executor completed.",
          },
        ],
      },
      context: {
        allowedSources: ["postgres", "mongodb"],
        observedSources: ["postgres"],
        coverageKind: "validated_analytics",
        validationStatus: "approved",
        validationResults: [
          {
            check: "coverage",
            status: "passed",
            message: "All requested windows are inside the supported coverage window.",
          },
        ],
      },
    })

    expect(trust.components.sourceCorroboration.label).toBe("medium")
    expect(trust.overall.score).toBeLessThan(90)
    expect(trust.limitationNotes.some((note) => note.includes("cross-source"))).toBe(
      true,
    )
  })

  it("lowers interpretation confidence for guided reroutes", () => {
    const direct = buildBuiltInTrustModel({
      response: createBaseResponse(),
      interpretation: {
        mode: "direct",
        explanation: "Matched directly to a supported built-in flow.",
      },
      executionTrace: {
        planId: "trust-direct",
        entries: [
          {
            id: "dispatch.success",
            stage: "dispatch",
            status: "completed",
            message: "Deterministic executor completed.",
          },
        ],
      },
      context: {
        allowedSources: ["postgres", "mongodb"],
        observedSources: ["postgres", "mongodb"],
        coverageKind: "validated_analytics",
        validationStatus: "approved",
      },
    })
    const rerouted = buildBuiltInTrustModel({
      response: createBaseResponse(),
      interpretation: {
        mode: "guided_reroute",
        explanation: "Rerouted to the closest supported built-in flow.",
      },
      executionTrace: {
        planId: "trust-rerouted",
        entries: [
          {
            id: "dispatch.success",
            stage: "dispatch",
            status: "completed",
            message: "Deterministic executor completed.",
          },
        ],
      },
      context: {
        allowedSources: ["postgres", "mongodb"],
        observedSources: ["postgres", "mongodb"],
        coverageKind: "validated_analytics",
        validationStatus: "approved",
      },
    })

    expect(rerouted.components.interpretation.score).toBeLessThan(
      direct.components.interpretation.score,
    )
    expect(rerouted.uncertaintyNotes.some((note) => note.includes("rerouted"))).toBe(
      true,
    )
  })

  it("keeps built-in fallback trust low", () => {
    const trust = buildBuiltInTrustModel({
      response: createBaseResponse({
        fallback: true,
        summary: "Unsupported question.",
        evidence: [],
        drivers: [],
      }),
      interpretation: {
        mode: "fallback",
        explanation: "Could not safely map the request to a built-in flow.",
      },
      context: {
        allowedSources: [],
        observedSources: [],
        coverageKind: "fallback",
        limitationNotes: ["Unsupported question."],
      },
    })

    expect(trust.overall.score).toBeLessThan(30)
    expect(trust.components.execution.label).toBe("low")
  })

  it("treats discovery as metadata-first without pretending to be fully corroborated analytics", () => {
    const trust = buildBuiltInTrustModel({
      response: createBaseResponse({
        intent: "discovery",
        activeScope: "SME portfolio",
        headline: "QueryLens is grounded on the SME portfolio dataset",
        summary: "Discovery is based on source health and retrieved metadata.",
        drivers: [
          {
            id: "discovery-1",
            title: "Source layers are active",
            impactLabel: "3 sources",
            direction: "positive",
            description: "The dataset exposes structured facts, contextual signals, and manifest metadata.",
          },
        ],
      }),
      interpretation: {
        mode: "direct",
        explanation: "Matched directly to a supported built-in flow.",
      },
      executionTrace: {
        planId: "trust-discovery",
        entries: [
          {
            id: "dispatch.success",
            stage: "dispatch",
            status: "completed",
            message: "Deterministic executor completed.",
          },
        ],
      },
      context: {
        allowedSources: ["manifest", "postgres", "mongodb"],
        observedSources: ["manifest", "postgres", "mongodb"],
        coverageKind: "metadata_catalog",
        coverageLabel: "Apr 05, 2026 to Apr 12, 2026",
        validationStatus: "approved",
        sourceHealth: [
          {
            id: "semantic_manifest",
            name: "Semantic manifest",
            type: "manifest",
            status: "configured",
            detail: "Manifest-backed metric definitions are available.",
          },
          {
            id: "weekly_metrics",
            name: "Weekly portfolio metrics",
            type: "postgres",
            status: "sample-fixture",
            detail: "Weekly facts are available.",
          },
        ],
      },
    })

    const trustArtifacts = buildTrustArtifactsFromModel(trust)

    expect(trust.components.dataCoverage.score).toBeGreaterThanOrEqual(80)
    expect(trust.components.sourceCorroboration.label).toBe("medium")
    expect(trust.sources.some((source) => source.sourceType === "manifest")).toBe(true)
    expect(trustArtifacts.sourcesUsed.length).toBe(trust.sources.length)
  })
})
