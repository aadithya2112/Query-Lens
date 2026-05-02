import { z } from "zod"

import { formatContextualDateWindowLabel } from "@/lib/querylens/date-windows"
import { DEFAULT_WHAT_CHANGED_FOLLOW_UPS } from "@/lib/querylens/follow-ups"
import {
  getSemanticManifest,
  getSupportedEntityLabels,
} from "@/lib/querylens/semantic-manifest"
import {
  canUseReasoningProvider,
  type QueryLensExecutionContext,
  requiresGeminiPlanning,
} from "@/lib/querylens/server/ai-config"
import { generateStructuredData } from "@/lib/querylens/server/reasoning-provider"
import {
  planDeterministicQuery,
} from "@/lib/querylens/server/query-planner"
import { roundTo } from "@/lib/querylens/scoring"
import type {
  ContextEvent,
  DriverItem,
  Phase1AnalysisResponse,
  QueryPlanResult,
  RetrievalContext,
  ScopeFilter,
  StructuredQueryPlan,
} from "@/lib/querylens/types"

export const DEFAULT_FLAGSHIP_QUESTION = "Why did SME cashflow health drop last week?"
export const SUPPORTED_QUERY_FOLLOW_UPS = [...DEFAULT_WHAT_CHANGED_FOLLOW_UPS] as const

const narrativeResponseSchema = z.object({
  headline: z.string().min(1),
  summary: z.string().min(1),
  supportedFollowUps: z.array(z.string().min(1)).min(1),
})

const submitWhatChangedSchema = z.object({
  intent: z.literal("what_changed"),
  metric: z.literal("cashflow_health_score"),
})

const submitBreakdownSchema = z.object({
  intent: z.literal("breakdown"),
  metric: z.literal("at_risk_account_count"),
  breakdownDimension: z.enum(["region", "sector", "region_sector"]).optional(),
})

const submitCompareSchema = z.object({
  intent: z.literal("compare"),
  metric: z.literal("cashflow_health_score"),
  compareMode: z.enum(["timeframe", "peer"]).optional(),
  compareDimension: z.enum(["region", "sector"]).optional(),
})

const submitDiscoverySchema = z.object({
  intent: z.literal("discovery"),
  metric: z.literal("dataset_catalog"),
  discoveryFocus: z
    .enum(["overview", "metrics", "sources", "dimensions", "time_coverage", "questions"])
    .optional(),
})

const submitQueryPlanSchema = z.discriminatedUnion("intent", [
  submitWhatChangedSchema,
  submitBreakdownSchema,
  submitCompareSchema,
  submitDiscoverySchema,
])

interface NarrativeInput {
  parsed: StructuredQueryPlan
  activeScopeLabel: string
  currentScore: number
  previousScore: number
  drivers: DriverItem[]
  contextEvents: ContextEvent[]
  allowedFollowUps: string[]
}

export interface QueryEngineProvider {
  planQuery: (
    question: string,
    scopeOverride?: ScopeFilter,
    retrievalContext?: RetrievalContext
  ) => Promise<QueryPlanResult>
  composeNarrative: (
    input: NarrativeInput
  ) => Promise<
    Pick<Phase1AnalysisResponse, "headline" | "summary" | "supportedFollowUps">
  >
}

function buildHeadline(activeScopeLabel: string, currentScore: number, previousScore: number) {
  const delta = roundTo(currentScore - previousScore)
  const direction = delta < 0 ? "fell" : "improved"
  return `${activeScopeLabel} cashflow health ${direction} ${Math.abs(delta).toFixed(1)} points`
}

function buildDeterministicNarrative({
  parsed,
  activeScopeLabel,
  currentScore,
  previousScore,
  drivers,
  contextEvents,
  allowedFollowUps,
}: NarrativeInput) {
  const delta = roundTo(currentScore - previousScore)
  const worstDriver = drivers[0]
  const leadContext = contextEvents[0]
  const direction = delta < 0 ? "down" : "up"
  const timeframeLabel = formatContextualDateWindowLabel(parsed.dateWindow)

  const summaryParts = [
    `${activeScopeLabel} moved ${direction} from ${previousScore.toFixed(1)} to ${currentScore.toFixed(1)} over ${timeframeLabel}.`,
  ]

  if (worstDriver) {
    summaryParts.push(worstDriver.description)
  }

  if (leadContext) {
    summaryParts.push(`${leadContext.summary} ${leadContext.detail}`)
  }

  summaryParts.push(
    `This answer compares the selected window with the immediately preceding grounded period in the same scope.`
  )

  return {
    headline: buildHeadline(activeScopeLabel, currentScore, previousScore),
    summary: summaryParts.join(" "),
    supportedFollowUps: allowedFollowUps,
  }
}

function buildNarrativePrompt(input: NarrativeInput) {
  const deterministic = buildDeterministicNarrative(input)
  const driverLines = input.drivers.length
    ? input.drivers
        .map(
          (driver, index) =>
            `${index + 1}. ${driver.title} (${driver.impactLabel}, ${driver.direction}): ${driver.description}`
        )
        .join("\n")
    : "No ranked drivers were found."

  const contextLines = input.contextEvents.length
    ? input.contextEvents
        .map(
          (event, index) =>
            `${index + 1}. [${event.collection}] ${event.summary} ${event.detail}`
        )
        .join("\n")
    : "No corroborating context events were found."

  return `
You are writing the user-facing narrative for QueryLens, a trust-first analytics app.

Return JSON only and use only the facts below. Do not invent new metrics, timeframes, evidence, follow-up questions, or remediation advice.

Facts:
- Scope: ${input.activeScopeLabel}
- Metric: cashflow_health_score
- Timeframe: ${formatContextualDateWindowLabel(input.parsed.dateWindow)}
- Current score: ${input.currentScore.toFixed(1)}
- Previous score: ${input.previousScore.toFixed(1)}
- Default grounded headline: ${deterministic.headline}
- Allowed follow-ups: ${input.allowedFollowUps.join(" | ")}

Drivers:
${driverLines}

Context:
${contextLines}

Write:
- a concise headline
- a single readable summary paragraph of 3-4 grounded sentences
- make the summary a little fuller than a terse recap: include the outcome, the clearest driver, any corroborating context if present, and a brief framing of the comparison window
- stay factual and evidence-linked, with no advice or speculation
- the full allowed follow-up list exactly as provided
`.trim()
}

const narrativeJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["headline", "summary", "supportedFollowUps"],
  properties: {
    headline: { type: "string" },
    summary: { type: "string" },
    supportedFollowUps: {
      type: "array",
      minItems: 1,
      items: {
        type: "string",
      },
    },
  },
} as const

function buildGeminiRequiredFallback(
  reason = "QueryLens needs Gemini enabled to interpret interactive questions right now."
): QueryPlanResult {
  return {
    fallbackReason: reason,
    failureKind: "model_unavailable",
  }
}

function buildGuidedPlanningFailure(
  reason = "QueryLens could not safely interpret that question right now."
): QueryPlanResult {
  return {
    fallbackReason: reason,
    failureKind: "guided_failure",
  }
}

async function buildGeminiNarrative(input: NarrativeInput) {
  const result = await generateStructuredData(
    {
      prompt: buildNarrativePrompt(input),
      responseJsonSchema: narrativeJsonSchema,
      schemaName: "querylens_narrative",
    },
    narrativeResponseSchema
  )

  if (!result.data) {
    throw new Error("QueryLens could not validate the narrative response.")
  }

  return result.data
}

const plannerDecisionSchema = z.object({
  decision: z.enum(["submit", "reject"]),
  intent: z
    .enum(["what_changed", "breakdown", "compare", "discovery"])
    .optional(),
  metric: z
    .enum(["cashflow_health_score", "at_risk_account_count", "dataset_catalog"])
    .optional(),
  breakdownDimension: z.enum(["region", "sector", "region_sector"]).optional(),
  compareMode: z.enum(["timeframe", "peer"]).optional(),
  compareDimension: z.enum(["region", "sector"]).optional(),
  discoveryFocus: z
    .enum(["overview", "metrics", "sources", "dimensions", "time_coverage", "questions"])
    .optional(),
  reason: z.string().optional(),
})

function formatRetrievedContext(retrievalContext?: RetrievalContext) {
  if (!retrievalContext) {
    return "No retrieved context was available."
  }

  const datasetContext = retrievalContext.datasetMatches.length
    ? retrievalContext.datasetMatches
        .map((match, index) => `${index + 1}. ${match.title}: ${match.content}`)
        .join("\n")
    : "No dataset metadata matches were retrieved."
  const memoryContext = retrievalContext.memoryMatches.length
    ? retrievalContext.memoryMatches
        .map((match, index) => `${index + 1}. ${match.title}: ${match.content}`)
        .join("\n")
    : "No conversation memory matches were retrieved."
  const recentMessages = retrievalContext.recentMessages.length
    ? retrievalContext.recentMessages
        .map((message) => `${message.role}: ${message.text}`)
        .join("\n")
    : "No recent conversation turns were available."

  return `Dataset context:\n${datasetContext}\n\nConversation memory:\n${memoryContext}\n\nRecent conversation:\n${recentMessages}`
}

export function buildPlannerPrompt(
  question: string,
  retrievalContext?: RetrievalContext,
) {
  const manifest = getSemanticManifest()
  const supportedEntities = getSupportedEntityLabels()
  const supportedMetricLines = manifest.metrics
    .map(
      (metric) =>
        `- ${metric.id}: ${metric.label}. Supported intents: ${metric.supportedIntents.join(", ")}. Supported dimensions: ${metric.supportedDimensions.join(", ")}.`,
    )
    .join("\n")
  const supportedDimensionLabels = manifest.dimensions
    .map((dimension) => `${dimension.id} (${dimension.label})`)
    .join(", ")
  const exampleQuestionCoverage = manifest.supportedQuestions.join(" | ")

  return `
You are planning a QueryLens analytics query.

Return JSON only.

Supported product boundaries:
- dataset: ${manifest.dataset.label}
- supported dimensions: ${supportedDimensionLabels}
- supported metrics:
${supportedMetricLines}
- intent: what changed
  - metric: cashflow_health_score
  - supported date inputs are resolved deterministically from the question: this week, last week, exact dates, date ranges, or week-of phrasing
- intent: breakdown
  - metric: at_risk_account_count
  - supported date inputs are resolved deterministically from the question
  - breakdownDimension: region, sector, or region_sector when the wording makes it clear
- intent: compare
  - metric: cashflow_health_score
  - compareMode: timeframe or peer
  - compareDimension: region or sector for peer compare
  - supported date inputs are resolved deterministically from the question
- intent: discovery
  - metric: dataset_catalog
  - discoveryFocus: overview, metrics, sources, dimensions, time_coverage, or questions
- deterministic parsing resolves exact dates, date ranges, week-of phrases, region, sector, and peer entities after you choose the intent and mode
- supported regions: ${supportedEntities.regions.join(", ")}
- supported sectors: ${supportedEntities.sectors.join(", ")}
- example question coverage: ${exampleQuestionCoverage}

Use retrieved context to resolve references like "that", "there", "those metrics", or "that region".

Reject requests about unsupported metrics, unsupported time windows, uploads, or anything outside the current discovery, what-changed, breakdown, and compare flows.

Return an object with:
- decision: "submit" or "reject"
- if decision is "submit", include intent and metric
- include breakdownDimension, compareMode, compareDimension, or discoveryFocus only when needed
- if decision is "reject", include a concise reason

Retrieved context:
${formatRetrievedContext(retrievalContext)}

Question:
${question}
`.trim()
}

function plansAlign(args: {
  question: string
  scopeOverride?: ScopeFilter
  data: z.infer<typeof submitQueryPlanSchema>
}) {
  const deterministicResult = planDeterministicQuery(args.question, args.scopeOverride)

  if (!deterministicResult.parsed) {
    return undefined
  }

  if (deterministicResult.parsed.intent !== args.data.intent) {
    return undefined
  }

  if (
    args.data.intent === "breakdown" &&
    args.data.breakdownDimension &&
    deterministicResult.parsed.breakdownDimension !== args.data.breakdownDimension
  ) {
    return undefined
  }

  if (args.data.intent === "compare") {
    if (
      args.data.compareMode &&
      deterministicResult.parsed.compareSpec?.mode !== args.data.compareMode
    ) {
      return undefined
    }

    if (
      args.data.compareDimension &&
      deterministicResult.parsed.compareSpec?.dimension &&
      deterministicResult.parsed.compareSpec.dimension !== args.data.compareDimension
    ) {
      return undefined
    }
  }

  if (
    args.data.intent === "discovery" &&
    args.data.discoveryFocus &&
    deterministicResult.parsed.discoveryFocus &&
    deterministicResult.parsed.discoveryFocus !== args.data.discoveryFocus
  ) {
    return undefined
  }

  return deterministicResult
}

async function planQueryWithReasoningProvider(
  question: string,
  scopeOverride?: ScopeFilter,
  retrievalContext?: RetrievalContext
) {
  const result = await generateStructuredData(
    {
      prompt: buildPlannerPrompt(question, retrievalContext),
      responseJsonSchema: {
        type: "object",
        additionalProperties: false,
        required: ["decision"],
        properties: {
          decision: {
            type: "string",
            enum: ["submit", "reject"],
          },
          intent: {
            type: "string",
            enum: ["what_changed", "breakdown", "compare", "discovery"],
          },
          metric: {
            type: "string",
            enum: ["cashflow_health_score", "at_risk_account_count", "dataset_catalog"],
          },
          breakdownDimension: {
            type: "string",
            enum: ["region", "sector", "region_sector"],
          },
          compareMode: {
            type: "string",
            enum: ["timeframe", "peer"],
          },
          compareDimension: {
            type: "string",
            enum: ["region", "sector"],
          },
          discoveryFocus: {
            type: "string",
            enum: ["overview", "metrics", "sources", "dimensions", "time_coverage", "questions"],
          },
          reason: {
            type: "string",
          },
        },
      },
      schemaName: "querylens_built_in_plan",
    },
    plannerDecisionSchema
  )

  if (!result.data) {
    return undefined
  }

  if (result.data.decision === "reject") {
    const reason = result.data.reason?.trim() || undefined

    return {
      fallbackReason: reason,
      failureKind: "unsupported" as const,
    }
  }

  const parsedArgs = submitQueryPlanSchema.safeParse(result.data)

  if (!parsedArgs.success) {
    return undefined
  }

  return plansAlign({
    question,
    scopeOverride,
    data: parsedArgs.data,
  })
}

export const deterministicQueryEngineProvider: QueryEngineProvider = {
  planQuery: async (question, scopeOverride) =>
    planDeterministicQuery(question, scopeOverride),
  composeNarrative: async (input) => buildDeterministicNarrative(input),
}

export function getQueryEngineProvider(args: {
  executionContext: QueryLensExecutionContext
}): QueryEngineProvider {
  const geminiPlanningRequired = requiresGeminiPlanning(args.executionContext)
  const reasoningProviderAvailable = canUseReasoningProvider(args.executionContext)

  if (!geminiPlanningRequired) {
    return deterministicQueryEngineProvider
  }

  return {
    planQuery: async (question, scopeOverride, retrievalContext) => {
      if (!reasoningProviderAvailable) {
        return buildGeminiRequiredFallback()
      }

      try {
        const providerResult = await Promise.race([
          planQueryWithReasoningProvider(question, scopeOverride, retrievalContext),
          new Promise<undefined>((resolve) => {
            setTimeout(() => resolve(undefined), 6_000)
          }),
        ])

        if (providerResult?.parsed) {
          return providerResult
        }

        if (providerResult?.fallbackReason) {
          return providerResult
        }

        return buildGuidedPlanningFailure(
          "QueryLens could not validate Gemini's interpretation for that request."
        )
      } catch {
        return buildGeminiRequiredFallback(
          "QueryLens could not reach Gemini to interpret that question right now."
        )
      }
    },
    composeNarrative: async (input) => {
      if (!reasoningProviderAvailable) {
        return buildDeterministicNarrative(input)
      }

      try {
        return await Promise.race([
          buildGeminiNarrative(input),
          new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error("Gemini narrative timed out.")), 6_000)
          }),
        ])
      } catch {
        return buildDeterministicNarrative(input)
      }
    },
  }
}
