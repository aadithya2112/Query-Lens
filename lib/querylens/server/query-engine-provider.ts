import { FunctionCallingConfigMode, type FunctionDeclaration } from "@google/genai"
import { z } from "zod"

import {
  getDefaultDatasetId,
} from "@/lib/querylens/datasets"
import {
  type QueryLensExecutionContext,
  shouldUseGemini,
} from "@/lib/querylens/server/ai-config"
import { generateGeminiResponse } from "@/lib/querylens/server/gemini-client"
import { resolvePhase1Scope } from "@/lib/querylens/server/parser"
import { planDeterministicQuery } from "@/lib/querylens/server/query-planner"
import { roundTo } from "@/lib/querylens/scoring"
import type {
  ContextEvent,
  DriverItem,
  Phase1AnalysisResponse,
  QueryPlanResult,
  ScopeFilter,
  StructuredQueryPlan,
} from "@/lib/querylens/types"

export const DEFAULT_FLAGSHIP_QUESTION = "Why did SME cashflow health drop last week?"
export const SUPPORTED_QUERY_FOLLOW_UPS = [
  "Focus on the North West contribution to last week's drop",
  "Focus on hospitality SMEs last week",
  "What changed this week instead?",
] as const

const narrativeResponseSchema = z.object({
  headline: z.string().min(1),
  summary: z.string().min(1),
  supportedFollowUps: z
    .array(z.enum(SUPPORTED_QUERY_FOLLOW_UPS))
    .length(SUPPORTED_QUERY_FOLLOW_UPS.length),
})

const submitWhatChangedSchema = z.object({
  metric: z.literal("cashflow_health_score"),
  timeframe: z.enum(["this_week", "last_week"]),
  region: z.string().min(1).optional(),
  sector: z.string().min(1).optional(),
})

interface NarrativeInput {
  parsed: StructuredQueryPlan
  activeScopeLabel: string
  currentScore: number
  previousScore: number
  drivers: DriverItem[]
  contextEvents: ContextEvent[]
}

export interface QueryEngineProvider {
  planQuery: (
    question: string,
    scopeOverride?: ScopeFilter
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
  activeScopeLabel,
  currentScore,
  previousScore,
  drivers,
  contextEvents,
}: NarrativeInput) {
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
    summaryParts.push(`${leadContext.summary} ${leadContext.detail}`)
  }

  return {
    headline: buildHeadline(activeScopeLabel, currentScore, previousScore),
    summary: summaryParts.join(" "),
    supportedFollowUps: [...SUPPORTED_QUERY_FOLLOW_UPS],
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
- Timeframe: ${input.parsed.timeframe}
- Current score: ${input.currentScore.toFixed(1)}
- Previous score: ${input.previousScore.toFixed(1)}
- Default grounded headline: ${deterministic.headline}
- Allowed follow-ups: ${SUPPORTED_QUERY_FOLLOW_UPS.join(" | ")}

Drivers:
${driverLines}

Context:
${contextLines}

Write:
- a concise headline
- a 2-3 sentence summary grounded in the supplied drivers and context
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
      minItems: SUPPORTED_QUERY_FOLLOW_UPS.length,
      maxItems: SUPPORTED_QUERY_FOLLOW_UPS.length,
      items: {
        type: "string",
        enum: [...SUPPORTED_QUERY_FOLLOW_UPS],
      },
    },
  },
} as const

async function buildGeminiNarrative(input: NarrativeInput) {
  const result = await generateGeminiResponse({
    prompt: buildNarrativePrompt(input),
    responseJsonSchema: narrativeJsonSchema,
  })

  return narrativeResponseSchema.parse(result.json)
}

const plannerTools: FunctionDeclaration[] = [
  {
    name: "submit_analytics_query_plan",
    description:
      "Submit a supported QueryLens query plan for the current what-changed analytics flow.",
    parametersJsonSchema: {
      type: "object",
      additionalProperties: false,
      required: ["metric", "timeframe"],
      properties: {
        metric: {
          type: "string",
          enum: ["cashflow_health_score"],
        },
        timeframe: {
          type: "string",
          enum: ["this_week", "last_week"],
        },
        region: {
          type: "string",
        },
        sector: {
          type: "string",
        },
      },
    },
  },
  {
    name: "reject_analytics_query_plan",
    description:
      "Reject requests that are outside the supported QueryLens scope or too ambiguous to parse safely.",
    parametersJsonSchema: {
      type: "object",
      additionalProperties: false,
      required: ["reason"],
      properties: {
        reason: {
          type: "string",
        },
      },
    },
  },
]

function buildPlannerPrompt(question: string) {
  return `
You are planning a QueryLens analytics query.

You must choose exactly one function call.

Supported product boundaries:
- intent: what changed
- metric: cashflow_health_score only
- timeframe: this_week or last_week only
- optional scope dimensions: region and sector
- supported regions: North West, London & South East, Midlands
- supported sectors: Hospitality, Retail, Professional Services

Reject requests about unsupported metrics, unsupported time windows, comparisons, briefings, uploads, or anything outside the phase-1 "what changed" flow.

Question:
${question}
`.trim()
}

function resolveScopeDimensions(scope: ScopeFilter) {
  if (scope.region && scope.sector) {
    return ["region", "sector"] as const
  }

  if (scope.region) {
    return ["region"] as const
  }

  if (scope.sector) {
    return ["sector"] as const
  }

  return ["portfolio"] as const
}

async function planQueryWithGemini(
  question: string,
  scopeOverride?: ScopeFilter
) {
  const result = await generateGeminiResponse({
    prompt: buildPlannerPrompt(question),
    tools: [{ functionDeclarations: plannerTools }],
    toolConfig: {
      functionCallingConfig: {
        mode: FunctionCallingConfigMode.ANY,
        allowedFunctionNames: [
          "submit_analytics_query_plan",
          "reject_analytics_query_plan",
        ],
      },
    },
  })

  const call = result.functionCalls?.[0]

  if (!call?.name) {
    return undefined
  }

  if (call.name === "reject_analytics_query_plan") {
    const reason =
      typeof call.args?.reason === "string" && call.args.reason.trim()
        ? call.args.reason
        : undefined

    return {
      fallbackReason: reason,
    }
  }

  if (call.name !== "submit_analytics_query_plan") {
    return undefined
  }

  const parsedArgs = submitWhatChangedSchema.safeParse(call.args)

  if (!parsedArgs.success) {
    return undefined
  }

  const extractedScope = resolvePhase1Scope({
    region: parsedArgs.data.region,
    sector: parsedArgs.data.sector,
  })
  const overrideScope = resolvePhase1Scope(scopeOverride ?? {})

  if (
    (parsedArgs.data.region && extractedScope.invalidRegion) ||
    (parsedArgs.data.sector && extractedScope.invalidSector) ||
    overrideScope.invalidRegion ||
    overrideScope.invalidSector
  ) {
    return undefined
  }

  const scope = {
    ...extractedScope.scope,
    ...overrideScope.scope,
  }
  const parsed = {
    datasetId: getDefaultDatasetId(),
    rawQuestion: question,
    intent: "what_changed" as const,
    metricId: parsedArgs.data.metric,
    timeframe: parsedArgs.data.timeframe,
    scope,
    scopeDimensions: [...resolveScopeDimensions(scope)],
    comparisonWindow: {
      timeframe: parsedArgs.data.timeframe,
      comparisonBasis: "prior_period" as const,
    },
  }

  return {
    plan: parsed,
    parsed,
  }
}

export const deterministicQueryEngineProvider: QueryEngineProvider = {
  planQuery: async (question, scopeOverride) =>
    planDeterministicQuery(question, scopeOverride),
  composeNarrative: async (input) => buildDeterministicNarrative(input),
}

export function getQueryEngineProvider(args: {
  executionContext: QueryLensExecutionContext
}): QueryEngineProvider {
  if (!shouldUseGemini(args.executionContext)) {
    return deterministicQueryEngineProvider
  }

  return {
    planQuery: async (question, scopeOverride) => {
      const deterministicResult = await deterministicQueryEngineProvider.planQuery(
        question,
        scopeOverride
      )

      try {
        const geminiResult = await Promise.race([
          planQueryWithGemini(question, scopeOverride),
          new Promise<undefined>((resolve) => {
            setTimeout(() => resolve(undefined), 6_000)
          }),
        ])

        if (geminiResult?.parsed) {
          return geminiResult
        }

        if (!deterministicResult.parsed && geminiResult?.fallbackReason) {
          return {
            fallbackReason: geminiResult.fallbackReason,
          }
        }
      } catch {
        return deterministicResult
      }

      return deterministicResult
    },
    composeNarrative: async (input) => {
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
